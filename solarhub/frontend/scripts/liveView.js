import DOM from "./dom.js";
import { getConfig, getLiveData, getPeakValues, getWifiNetworks, predictBatteryRemainingTime, updateWifi } from "./com.js";
import { constants } from "./helper.js";
import StateBar from "./stateBar.js";

// Variables
const liveContainer = DOM.create("div.sideContainer#liveContainer");
const timeTextView = DOM.create("t#time");
const dateTextView = DOM.create("t#date");
const sunPowerBar = new StateBar();
const loadPowerBar = new StateBar();
const batterySocBar = new StateBar();
const gridPowerBar = new StateBar();
let weatherCode = 0;

export async function build(mainContainer) {
   liveContainer.appendTo(mainContainer);

   DOM.create("img#weatherImage [src=/assets/images/weather/day_rainy.jpg]").appendTo(liveContainer);

   DOM.create("div").setStyle({ flexGrow: 1 }).appendTo(liveContainer);
   //buildSettingsButton();
   DOM.create("div#dateTimeContainer").append(timeTextView).append(dateTextView).appendTo(liveContainer);
   //DOM.create("div#liveBadgeBox").append(DOM.create("div")).append(DOM.create("t").setText("LIVE")).appendTo(liveContainer);

   DOM.create("div").setStyle({ flexGrow: 1 }).appendTo(liveContainer);

   sunPowerBar.setIcon("sun.png");
   sunPowerBar.setColor({ r: 255, g: 199, b: 0 });
   sunPowerBar.setUnit("Watt");
   sunPowerBar.container.appendTo(liveContainer);

   loadPowerBar.setIcon("house.png");
   loadPowerBar.setColor({ r: 96, g: 183, b: 255 });
   loadPowerBar.setUnit("Watt");
   loadPowerBar.container.appendTo(liveContainer);

   batterySocBar.setIcon("battery.png");
   batterySocBar.setColor({ r: 0, g: 210, b: 140 });
   batterySocBar.setUnit("%");
   batterySocBar.setMax(100);
   batterySocBar.addMarker(100 * constants.battery.discharge.limit);
   batterySocBar.addMarker(100 * constants.battery.charge.limit);
   batterySocBar.container.appendTo(liveContainer);

   gridPowerBar.setUnit("Watt");
   gridPowerBar.container.appendTo(liveContainer);

   DOM.create("div").setStyle({ flexGrow: 2 }).appendTo(liveContainer);

   updateLiveData();
   setInterval(updateLiveData, 500);
   updateMaxValues();
   setInterval(updateMaxValues, 60 * 1000);
}

// Update Live Data & Time every Second
function updateLiveData() {
   getLiveData().then((data) => {
      if (!data) return;
      const serverTime = new Date(data.timestamp);
      const hours = String(serverTime.getHours()).padStart(2, "0");
      const minutes = String(serverTime.getMinutes()).padStart(2, "0");
      const day = String(serverTime.getDate()).padStart(2, "0");
      const month = serverTime.toLocaleString("default", { month: "long" });
      const year = serverTime.getFullYear();
      timeTextView.setText(`${hours}:${minutes}`);
      dateTextView.setText(`${day}. ${month} ${year}`);

      sunPowerBar.setValue(data.p_sun);
      loadPowerBar.setValue(data.p_load);
      batterySocBar.setValue(data.batt_soc);

      if (data.batt_soc >= 100 * constants.battery.charge.limit) {
         batterySocBar.setInfoText("Batterie voll");
      } else if (data.batt_soc <= 100 * constants.battery.discharge.limit) {
         batterySocBar.setInfoText("Batterie leer");
      } else {
         const power = -data.p_batt;
         const powerString = (power > 0 ? "+" : "") + power.toLocaleString("de-DE");
         predictBatteryRemainingTime(data.batt_soc).then((prediction) => {
            if (Math.abs(prediction.averagePower) <= 15) {
               batterySocBar.setInfoText(`${powerString} Watt`);
               return;
            }
            const timePredString = `${prediction.hours}:${prediction.minutes.toString().padStart(2, "0")} Std. bis ${prediction.charging ? "voll" : "leer"}`;
            batterySocBar.setInfoText(`${powerString} Watt ➜ ${timePredString}`);
         });
      }
      gridPowerBar.setValue(Math.abs(data.p_grid));
      if (data.p_grid <= 0) {
         gridPowerBar.setIcon("grid_export.png");
         gridPowerBar.setColor({ r: 0, g: 176, b: 155 });
         gridPowerBar.setInfoText(`+${constants.earningsPerKwh.toEuroString()} / kWh`);
      } else {
         gridPowerBar.setIcon("grid_import.png");
         gridPowerBar.setColor({ r: 255, g: 44, b: 133 });
         gridPowerBar.setInfoText(`-${constants.costPerKwh.toEuroString()} / kWh`);
      }
   });

   const weatherImagePath = getWeatherImage(weatherCode);
   const img = DOM.select("weatherImage");
   img.attr({ src: weatherImagePath });
}

// Update all the stuff that don't need to be updated every second.
function updateMaxValues() {
   getCurrentWeatherCode().then((code) => {
      weatherCode = code;
   });
   const end = Date.now();
   const start = end - 7 * 24 * 60 * 60 * 1000;
   let maxSunPower, maxLoadPower;
   getPeakValues("p_sun", start, end).then((res) => {
      maxSunPower = Math.round(res.max);
      sunPowerBar.setInfoText(`Max. ${maxSunPower.toLocaleString("de-DE")} Watt`);
   });
   getPeakValues("p_load", start, end).then((res) => {
      maxLoadPower = Math.round(res.max);
      loadPowerBar.setInfoText(`Max. ${maxLoadPower.toLocaleString("de-DE")} Watt`);
   });
   const interval = setInterval(() => {
      if (!maxSunPower || !maxLoadPower) return;
      clearInterval(interval);
      const peakPower = Math.max(maxSunPower, maxLoadPower);
      sunPowerBar.setMax(peakPower);
      loadPowerBar.setMax(peakPower);
      gridPowerBar.setMax(peakPower);
   }, 50);
}

// Builds the Settings button
function buildSettingsButton() {
   DOM.create("div#settingsButton")
      .append(DOM.create("img"))
      .appendTo(liveContainer)
      .onClick(() => {
         window.location.href = "/settings";
         return;
      });
}

async function getCurrentWeatherCode() {
   const location = constants.location;
   const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=weather_code`);
   const obj = await res.json();
   const weatherCode = obj.current.weather_code;
   return weatherCode;
}

function getWeatherImage(weatherCode) {
   const basePath = "/assets/images/weather/";

   if (sunPowerBar.val <= 20) {
      return basePath + "night.jpg";
   }

   switch (weatherCode) {
      case 0:
         return basePath + "day_clear.jpg";
      case 1:
      case 2:
         return basePath + "day_mainly_clear.jpg";
      case 3:
         return basePath + "day_overcast.jpg";
      case 4:
         return basePath + "day_mainly_clear.jpg";
      default:
         return basePath + "unknown.jpg";
   }
}
