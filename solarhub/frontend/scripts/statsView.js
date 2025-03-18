import DOM from "./dom.js";
import { getHistoricalData, getOldestTimestamp, getPeakValues } from "./com.js";
import { mod, getWeekNumber, constants, setDateTimeFromUnix } from "./helper.js";
import StateBar from "./stateBar.js";
import PieChart from "./pieChart.js";
import BarGraph from "./barGraph.js";
import LineGraph from "./lineGraph.js";

// Variables
const statsContainer = DOM.create("div.sideContainer#statsContainer");
const barGraph = new BarGraph();
const lineGraph = new LineGraph();
let updateTimeout = setTimeout(() => {}, 1);
let pickerWithTime = 0;
let pickerStartTime = 0;
let pickerEndTime = 0;
const amortizationBar = new StateBar();
const selfSufficiencyBar = new StateBar();
const selfUseBar = new StateBar();
const energyMixPieChart = new PieChart();
const energyDistributionPieChart = new PieChart();
const solarSourcePieChart = new PieChart();
const kmBars = [];
let kmBarsIgnoreHidden = false;
let selectedTabId;

export function build(mainContainer) {
   getOldestTimestamp().then((res) => {
      pickerStartTime = res;
      pickerEndTime = Date.now();
   });
   statsContainer.appendTo(mainContainer);
   statsContainer.append(buildTabs());
   statsContainer.append(buildDatetimePickers());
   statsContainer.append(barGraph.container).append(lineGraph.container);
   DOM.create("div")
      .setStyle({ maxWidth: "550px" })
      .append(
         buildGraphCheckBoxes(),
         buildInfoElements(),
         buildGridRatioBar(),
         buildFinancesContainer(),
         buildEnergyMixContainer(),
         buildEnergyDistributionContainer(),
         buildSolarSourceContainer(),
         buildIndependencyBars(),
         buildBatteryHealthContainer(),
         buildCo2Container(),
         buildComparisonStats(),
         //buildKmBars(),
         DOM.create("t#debugText").setStyle({ display: "block", marginTop: "100px" }),
      )
      .appendTo(statsContainer);
   DOM.select(".tab#days").click();

   lineGraph.data = {
      load: { name: "Verbrauch", color: { r: 96, g: 183, b: 255, a: 1 }, enabled: true, scalingGroup: 0, showInHover: true, unit: "W", values: [] },
      sun: { name: "Produktion", color: { r: 255, g: 199, b: 0, a: 1 }, enabled: true, scalingGroup: 0, showInHover: true, unit: "W", values: [] },
      battSoC: { name: "Batteriestand", color: { r: 0, g: 210, b: 140, a: 1 }, enabled: false, scalingGroup: 1, showInHover: true, unit: "%", values: [] },
      battLimitLower: { name: "MaxSoC", color: { r: 0, g: 210, b: 140, a: 0.3 }, enabled: false, scalingGroup: 1, showInHover: false, values: [] },
      battLimitUpper: { name: "MinSoC", color: { r: 0, g: 210, b: 140, a: 0.3 }, enabled: false, scalingGroup: 1, showInHover: false, values: [] },
      gridImport: { name: "Netzimport", color: { r: 255, g: 44, b: 133, a: 1 }, enabled: false, scalingGroup: 0, showInHover: true, unit: "W", values: [] },
      gridExport: { name: "Netzexport", color: { r: 0, g: 176, b: 155, a: 1 }, enabled: false, scalingGroup: 0, showInHover: true, unit: "W", values: [] },
   };
}

// Builds the Tabs UI
function buildTabs() {
   const tabContainer = DOM.create("div#tabContainer")
      .append(DOM.create("div.tab#days").setText("Tage"))
      .append(DOM.create("div.tab#weeks").setText("Wochen"))
      .append(DOM.create("div.tab#months").setText("Monate"))
      .append(DOM.create("div.tab#years").setText("Jahre"))
      .append(DOM.create("div.tab#custom").setText("Eigene"));
   const tabs = tabContainer.getFirstElement().children;
   for (let tab of tabs) {
      tab = new DOM([tab]);
      tab.onClick(() => {
         for (let activeTab of DOM.select("#tabContainer .selectedTab").elems) {
            new DOM([activeTab]).removeClass("selectedTab");
         }
         tab.addClass("selectedTab");
         const id = tab.getId();
         tabClicked(id);
      });
   }
   return tabContainer;
}

function buildDatetimePickers() {
   const container = DOM.create("div#pickerContainer");
   const pickerStart = DOM.create("input [type=date] #pickerStart");
   container.append(DOM.create("div").append(pickerStart));
   container.append(DOM.create("div#minus"));

   let pickerEnd = DOM.create("input [type=date] #pickerEnd");
   container.append(DOM.create("div").append(pickerEnd));

   let refreshButton = DOM.create("div#refreshButton").setText("Übernehmen");
   refreshButton.onClick(() => {
      refreshButton.setStyle({ opacity: "0", pointerEvents: "none" });
      tabClicked(selectedTabId, true);
   });
   container.append(refreshButton);

   const checkBoxContainer = DOM.create("div").setStyle({ position: "absolute", display: "flex", alignItems: "center", bottom: "-30px", zIndex: "99" }).appendTo(container);
   const box = DOM.create("input [type=checkbox]").setStyle({ marginRight: "7px" });
   const label = DOM.create("label").setText("Inkl. Uhrzeit");
   checkBoxContainer.append(box, label);
   container.append(checkBoxContainer);

   const waitInterval = setInterval(() => {
      if (pickerStartTime == 0 || pickerEndTime == 0) return;
      clearInterval(waitInterval);
      box.onChange(() => {
         pickerWithTime = box.getFirstElement().checked;
         if (pickerWithTime) {
            pickerStart.attr({ type: "datetime-local" });
            pickerEnd.attr({ type: "datetime-local" });
         } else {
            pickerStart.attr({ type: "date" });
            pickerEnd.attr({ type: "date" });
         }
         pickerStart.setValue(setDateTimeFromUnix(pickerStartTime, pickerWithTime));
         pickerEnd.setValue(setDateTimeFromUnix(pickerEndTime, pickerWithTime));
         refreshButton.setStyle({ opacity: "1", pointerEvents: "all" });
      }, true);
      refreshButton.setStyle({ opacity: "0", pointerEvents: "none" });
   }, 100);

   pickerStart.getFirstElement().addEventListener("change", function () {
      let timestamp = new Date(this.value).getTime();
      pickerStartTime = timestamp;
      refreshButton.setStyle({ opacity: "1", pointerEvents: "all" });
   });
   pickerEnd.getFirstElement().addEventListener("change", function () {
      let timestamp = new Date(this.value).getTime();
      pickerEndTime = timestamp;
      refreshButton.setStyle({ opacity: "1", pointerEvents: "all" });
   });

   return container;
}

function buildInfoElements() {
   const container = DOM.create("div").setStyle({ display: "flex", alignItems: "center", justifyContent: "center", marginTop: "40px", flexWrap: "wrap", gap: "15px" });
   DOM.create("div")
      .appendTo(container)
      .append(
         buildSimpleIconTextElement("sun.png", "sunEnergy", "kWh Produziert"),
         buildSimpleIconTextElement("max_sun.png", "maxSunPower", "kW Maximum"),
         buildSimpleIconTextElement("min_sun.png", "minSunPower", "kW Minimum"),
      );
   DOM.create("div")
      .appendTo(container)
      .append(
         buildSimpleIconTextElement("house.png", "loadEnergy", "kWh Verbraucht"),
         buildSimpleIconTextElement("max_load.png", "maxLoadPower", "kW Maximum"),
         buildSimpleIconTextElement("min_load.png", "minLoadPower", "kW Minimum"),
      );
   return container;
}

function buildGraphCheckBoxes() {
   const container = DOM.create("div").setStyle({ width: "100%", display: "flex", justifyContent: "center", flexWrap: "wrap" });
   const checkBoxes = [
      { name: "Produktion", keys: ["sun"], initiallyChecked: true },
      { name: "Verbrauch", keys: ["load"], initiallyChecked: true },
      { name: "Batterie", keys: ["battSoC", "battLimitUpper", "battLimitLower"], initiallyChecked: false },
      { name: "Netz", keys: ["gridImport", "gridExport"], initiallyChecked: false },
   ];
   for (let checkBox of checkBoxes) {
      const checkBoxContainer = DOM.create("div").setStyle({ display: "flex", alignItems: "center", padding: "14px" }).appendTo(container);
      const box = DOM.create("input [type=checkbox]").setStyle({ marginRight: "7px" });
      box.getFirstElement().checked = checkBox.initiallyChecked;
      const label = DOM.create("label").setText(checkBox.name);
      checkBoxContainer.append(box, label);

      box.onChange(() => {
         const isChecked = box.getFirstElement().checked;
         for (let key of checkBox.keys) {
            lineGraph.data[key].enabled = isChecked;
         }
         lineGraph.draw();
      });
   }
   return container;
}

// Builds the Grid Ratio Bar UI
function buildGridRatioBar() {
   const container = DOM.create("div").setStyle({ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" });
   container.append(buildBigTitle("grid_export.png", "Netzbilanz", "So viel Strom wurde ans Netz verkauft und aus dem Netz eingekauft"));
   const ratioContainer = DOM.create("div#ratioContainer").appendTo(container);

   const valuesContainer = DOM.create("div#ratioValuesContainer").appendTo(ratioContainer);
   valuesContainer.append(
      DOM.create("img.icon [src=/assets/images/grid_export.png]").setStyle({ margin: "0px", marginRight: "15px" }),
      DOM.create("t.value#gridExportValue"),
      DOM.create("t.unit").setText("kWh verkauft"),
      DOM.create("div").setStyle({ flexGrow: 1 }),
      DOM.create("t.value#gridImportValue"),
      DOM.create("t.unit").setText("kWh eingekauft"),
      DOM.create("img.icon [src=/assets/images/grid_import.png]").setStyle({ margin: "0px", marginLeft: "15px" }),
   );

   const barContainer = DOM.create("div#ratioBarContainer").appendTo(ratioContainer);
   barContainer.append(DOM.create("div.ratioBar.reflection#ratioBarGreen"), DOM.create("div.ratioBar.reflection#ratioBarRed"));

   const costContainer = DOM.create("div#ratioCostContainer").appendTo(ratioContainer);
   const costBoxIn = DOM.create("div.costBoxGreen").appendTo(costContainer);
   DOM.create("t.costBoxValue#gridExportCostValue").appendTo(costBoxIn);
   DOM.create("div").setStyle({ flexGrow: 1 }).appendTo(costContainer);
   const costBoxOut = DOM.create("div.costBoxRed").appendTo(costContainer);
   DOM.create("t.costBoxValue#gridImportCostValue").appendTo(costBoxOut);
   return container;
}

// Builds the Finances UI
function buildFinancesContainer() {
   const financesContainer = DOM.create("div");
   // financesContainer.append(buildBigTitle("coin.png", "Kosten", "So viel Geld sparen wir uns Dank der Solaranlage"));
   financesContainer.append(buildBigTitle("coin.png", "Kosten", "So viel Geld konnte durch die Solaranlage eingespart werden"));
   const financesInnerContainer = DOM.create("div")
      .setStyle({
         width: "100%",
         display: "flex",
         flexDirection: "column",
         alignItems: "center",
         justifyContent: "center",
      })
      .appendTo(financesContainer);
   const costBoxWithPv = DOM.create("div.costBoxGreen#costBoxWithPv").append(DOM.create("t.costBoxValue#costWithPvValue"));
   const costBoxWithoutPv = DOM.create("div.costBoxRed").append(DOM.create("t.costBoxValue#costWithoutPvValue"));
   DOM.create("div")
      .setStyle({ display: "flex", gap: "10px", marginTop: "20px" })
      .append(DOM.create("div.financesElementContainer").append(DOM.create("img.financesIcon [src=/assets/images/sun.png]")).append(DOM.create("t.financesText").setText("Real")).append(costBoxWithPv))
      .append(
         DOM.create("div.financesElementContainer")
            .append(DOM.create("img.financesIcon [src=/assets/images/no_sun.png]"))
            .append(DOM.create("t.financesText").setText("Fiktiv"))
            .append(costBoxWithoutPv),
      )
      .appendTo(financesInnerContainer);
   DOM.create("img [src=/assets/images/finances_sum_arrow.png]").setStyle({ height: "55px", margin: "20px 0px", objectFit: "contain", opacity: "0.2" }).appendTo(financesInnerContainer);
   const costBoxSaved = DOM.create("div.costBoxGreen").append(DOM.create("t.costBoxValue#costSavedValue"));
   DOM.create("div.financesElementContainer")
      .append(DOM.create("img.financesIcon [src=/assets/images/cash.png]"))
      .append(DOM.create("t.financesText").setText("Gespart"))
      .append(costBoxSaved)
      .appendTo(financesInnerContainer);
   amortizationBar.setColor({ r: 0, g: 176, b: 155 });
   amortizationBar.setIcon("clock.png");
   amortizationBar.setUnit("% Amortisiert");
   amortizationBar.setMax(100);
   amortizationBar.setValue(0);
   amortizationBar.container.setStyle({ marginTop: "60px" });
   financesContainer.append(amortizationBar.container);
   return financesContainer;
}

// Builds the Pie Chart UI
function buildEnergyMixContainer() {
   energyMixPieChart.setIcon("house.png", { r: 96, g: 183, b: 255 }, false);
   const container = DOM.create("div");
   container.append(buildBigTitle("energy_mix.png", "Strommix", "Aus diesen Quellen kommt der von uns verbrauchte Strom"));
   container.append(energyMixPieChart.container);
   return container;
}

// Builds the Pie Chart UI
function buildEnergyDistributionContainer() {
   energyDistributionPieChart.setIcon("sun.png", { r: 255, g: 199, b: 0 }, true);
   const container = DOM.create("div");
   container.append(buildBigTitle("energy_mix.png", "Stromverteilung", "Dahin fließt der von der Solaranlage produzierte Strom"));
   container.append(energyDistributionPieChart.container);
   return container;
}

// Builds the Pie Chart UI
function buildSolarSourceContainer() {
   solarSourcePieChart.setIcon("energy.png", { r: 255, g: 199, b: 0 }, false);
   const container = DOM.create("div");
   container.append(buildBigTitle("energy_mix.png", "Solaraufteilung", "Aus diesen Teilsystemen kommt unser Sonnenstrom"));
   container.append(solarSourcePieChart.container);
   return container;
}

// Builds the CO2 UI
function buildCo2Container() {
   const container = DOM.create("div").setStyle({ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" });
   container.append(buildBigTitle("leaves.png", "Nachhaltigkeit", "Diese Auswirkungen hat die Solaranlage auf Umwelt und Gesundheit"));
   const elemContainer = DOM.create("div").setStyle({ display: "flex", flexDirection: "column" }).appendTo(container);
   elemContainer.append(
      buildSimpleIconTextElement("mass.png", "co2WeightText", "kg CO<sub>2</sub> eingespart"),
      buildSimpleIconTextElement("balloon.png", "co2BalloonsText", "Luftballons voller CO<sub>2</sub>"),
      buildSimpleIconTextElement("car.png", "co2CarKmText", "km Verbrenner äquivalent"),
      buildSimpleIconTextElement("tree.png", "co2TreesText", "Bäume im gleichen Zeitraum"),
      buildSimpleIconTextElement("coal.png", "co2CoalText", "kg Kohle nicht verbrannt"),
      //buildSimpleIconTextElement("", "", "Liter Wasser gespart"),
      //buildSimpleIconTextElement("", "", "Gramm Feinstaub vermieden"),
      //buildSimpleIconTextElement("", "", "Gramm Stick- & Schwefeloxide vermieden"),
      //buildSimpleIconTextElement("", "", "Atemwegserkrankungen vermieden"),
      //buildSimpleIconTextElement("", "", "Tode vermieden"),
      //buildSimpleIconTextElement("", "", "€ öffentliche Gesundheitskosten gespart"),
      //buildSimpleIconTextElement("", "", "Liter Wasser gespart"),
   );

   return container;
}

function buildSimpleIconTextElement(icon, id, description) {
   return DOM.create(`div.simpleIconTextElement#${id}Container`)
      .append(DOM.create(`img [src=/assets/images/${icon}]`))
      .append(DOM.create(`t#${id}`).setContent("0"))
      .append(DOM.create("t").setContent(description));
}

// Builds the Self Sufficiency and Self Use Bar UI
function buildIndependencyBars() {
   const barContainer = DOM.create("div").setStyle({ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" });
   barContainer.append(buildBigTitle("fist.png", "Unabhängigkeit", "So gut würden wir ohne das Stromnetz auskommen"));

   selfSufficiencyBar.center();
   selfSufficiencyBar.setColor({ r: 0, g: 210, b: 140 });
   selfSufficiencyBar.setUnit("%");
   selfSufficiencyBar.setMax(100);
   selfSufficiencyBar.setValue(50);
   selfSufficiencyBar.setInfoText("Autarkiegrad");
   barContainer.append(selfSufficiencyBar.container);

   selfUseBar.center();
   selfUseBar.flip();
   selfUseBar.setColor({ r: 0, g: 176, b: 155 });
   selfUseBar.setUnit("%");
   selfUseBar.setMax(100);
   selfUseBar.setValue(50);
   selfUseBar.setInfoText("Eigenverbrauch");
   barContainer.append(selfUseBar.container);
   return barContainer;
}

// Build Big Title UI
function buildBigTitle(icon, subtitle, title) {
   const container = DOM.create("div").setStyle({ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: "160px" });
   container.append(DOM.create(`img.bigTitleIcon [src=/assets/images/${icon}]`));
   container.append(DOM.create("t.subtitle").setContent(subtitle));
   container.append(DOM.create("t.bigTitle").setContent(title));
   return container;
}

// Build UI für Battery Health
function buildBatteryHealthContainer() {
   const container = DOM.create("div").setStyle({ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: "100px" });
   container.append(buildBigTitle("battery.png", "Batteriegesundheit", "So stark wurde die Batterie beansprucht"));
   const hContainer = DOM.create("div").setStyle({ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", margin: "40px 0px" }).appendTo(container);
   hContainer.append(
      DOM.create("div")
         .setStyle({ display: "flex", flexDirection: "column", alignItems: "flex-end" })
         .append(DOM.create("t.value#batteryChargeText").setStyle({ marginRight: "0" }), DOM.create("t.unit").setStyle({ textAlign: "right" }).setText("kWh geladen")),
      DOM.create("img.batteryArrowImage [src=/assets/images/battery_arrow.png]").setStyle({ marginRight: "20px" }),
   );
   hContainer.append(DOM.create("img [src=/assets/images/battery_large.png]").setStyle({ width: "60px", objectFit: "contain", marginTop: "-10px" }));
   hContainer.append(
      DOM.create("img.batteryArrowImage [src=/assets/images/battery_arrow.png]").setStyle({ marginLeft: "20px" }),
      DOM.create("div").setStyle({ display: "flex", flexDirection: "column" }).append(DOM.create("t.value#batteryDischargeText"), DOM.create("t.unit").setText("kWh entladen")),
   );
   const elemContainer = DOM.create("div").setStyle({ display: "flex", flexDirection: "column" }).appendTo(container);
   elemContainer.append(
      buildSimpleIconTextElement("max_batt.png", "maxBatterySoCText", "% Höchststand"),
      buildSimpleIconTextElement("min_batt.png", "minBatterySoCText", "% Tiefststand"),
      buildSimpleIconTextElement("avg_batt.png", "avgBatterySoCText", "% Durchschnitt"),
      buildSimpleIconTextElement("batt_cycles.png", "batteryCyclesText", "Zyklen"),
      buildSimpleIconTextElement("batt_soh.png", "batterySoHText", "% State of Health"),
      buildSimpleIconTextElement("batt_rte.png", "batteryRteText", "% Round Trip Efficiency"),
   );
   return container;
}

// Build UI for the interesting energy comparison facts
function buildComparisonStats() {
   const container = DOM.create("div").setStyle({ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" });
   container.append(buildBigTitle("gears.png", "Vergleichswerte", "Die produzierte Menge an Energie würde reichen für..."));
   const elemContainer = DOM.create("div").setStyle({ display: "flex", flexDirection: "column" }).appendTo(container);
   elemContainer.append(
      buildSimpleIconTextElement("smartphone.png", "smartphoneCharges", "mal Smartphone laden"),
      buildSimpleIconTextElement("boiling_water.png", "litersOfBoilingWater", "Liter Wasser kochen"),
      buildSimpleIconTextElement("car.png", "kilometersECar", "km E-Auto fahren"),
      buildSimpleIconTextElement("bike.png", "kilometersBike", "km Fahrrad fahren"),
      buildSimpleIconTextElement("coffee.png", "timesCoffee", "mal Kaffee machen"),
      buildSimpleIconTextElement("lightbulb.png", "hoursLight", "Stunden einen Raum beleuchten"),
      buildSimpleIconTextElement("tv.png", "hoursTv", "Stunden Fernsehen"),
      buildSimpleIconTextElement("oven.png", "hoursOven", "Stunden Backofen"),
      buildSimpleIconTextElement("microwave.png", "hoursMicrowave", "Stunden Mikrowelle"),
      buildSimpleIconTextElement("fridge.png", "hoursFridge", "Stunden Kühlschrank"),
      buildSimpleIconTextElement("heater.png", "hoursHeater", "Stunden Heizlüfter"),
      buildSimpleIconTextElement("washing_machine.png", "timesWashing", "mal Wäsche waschen"),
      buildSimpleIconTextElement("vacuum.png", "hoursVacuum", "Stunden Staubsaugen"),
      buildSimpleIconTextElement("windturbine.png", "windRotations", "Windrad-Umdrehungen"),
   );
   return container;
}

// Build Ui for Km Bars
function buildKmBars() {
   const barContainer = DOM.create("div").setStyle({ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" });
   barContainer.append(buildBigTitle("gears.png", "Effizienz der Mobilität", "Die produzierte Menge an Energie würde reichen für..."));
   for (let i = 0; i < 20; i++) {
      const bar = new StateBar();
      bar.setColor({ r: 255, g: 80, b: 122 });
      bar.setUnit("Personenkilometer");
      bar.iconMode();
      kmBars.push(bar);
      barContainer.append(bar.container);
   }
   barContainer.append(DOM.create("div.button#kmBarsAllButton"));
   return barContainer;
}

// When a Tab is clicked
async function tabClicked(tabId, greyOut = true) {
   selectedTabId = tabId;
   clearTimeout(updateTimeout);
   updateTimeout = setTimeout(() => {
      tabClicked(tabId, false);
   }, 60 * 1000);

   if (greyOut) statsContainer.addClass("waiting");
   barGraph.elements = [];
   const now = new Date();

   // Calculate data for different time span options
   let numberOfBars = Math.floor(statsContainer.getWidth() / 25);
   if (tabId == "custom") numberOfBars = 1;
   let doneCounter = 0;
   for (let i = 0; i < numberOfBars; i++) {
      let start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i - numberOfBars + 1).getTime();
      let end = start + 86_400_000 - 1000;
      //let blockLength = 15 * 60 * 1000;
      let blockLength = 10 * 60 * 1000;
      let label = new Date(start).toLocaleString("de-DE", { weekday: "short" });
      const date = new Date((start + end) / 2);
      const daysOfWeek = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
      const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
      let title = `${daysOfWeek[date.getDay()]}`;
      let subTitle = `${String(date.getDate()).padStart(2, "0")}. ${months[date.getMonth()]} ${date.getFullYear()}`;
      let lineGraphLabels = "0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23".split(" ");
      if (tabId == "weeks") {
         let dayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
         start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset - 7 * i).getTime();
         end = start + 7 * 86_400_000 - 1000;
         blockLength = 60 * 60 * 1000;
         label = getWeekNumber((start + end) / 2);
         title = `Kalenderwoche ${getWeekNumber((start + end) / 2)}`;
         subTitle = `${new Date(start).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })} - ${new Date(end).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}`;
         lineGraphLabels = "Mo Di Mi Do Fr Sa So".split(" ");
      }
      if (tabId == "months") {
         start = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime();
         end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0).getTime() + 86_400_000 - 1000;
         blockLength = 3 * 60 * 60 * 1000;
         label = new Date(start).toLocaleString("de-DE", { month: "short" });
         title = `${months[new Date(start).getMonth()]} ${new Date(start).getFullYear()}`;
         subTitle = `${new Date(start).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} - ${new Date(end).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
         lineGraphLabels = Array.from({ length: Math.ceil(new Date(now.getFullYear(), now.getMonth() - i + 1, 0).getDate()) }, (_, index) => (index + 1).toString());
      }
      if (tabId == "years") {
         start = new Date(now.getFullYear() - i, 0, 1).getTime();
         end = new Date(now.getFullYear() - i + 1, 0, 0).getTime() + 86_400_000 - 1000;
         blockLength = 7 * 24 * 60 * 60 * 1000;
         label = new Date(start).getFullYear().toString().slice(-2);
         title = `Das Jahr ${new Date(start).getFullYear()}`;
         subTitle = `${new Date(start).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} - ${new Date(end).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
         lineGraphLabels = "Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez".split(" ");
      }
      if (tabId == "custom") {
         start = pickerStartTime;
         end = pickerEndTime;
         if (!pickerWithTime) {
            start = new Date(start).setHours(0, 0, 0, 0);
            end = new Date(end).setHours(23, 59, 59, 999);
         }
         blockLength = (end - start) / 144;
         title = "";
         subTitle = "";
         const numberOfDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
         lineGraphLabels = [`${numberOfDays} Tage`];
      }
      const rawDataBlockLength = Math.min(blockLength, 1 * 60 * 60 * 1000);
      getHistoricalData(start, end, rawDataBlockLength).then((rawData) => {
         doneCounter++;
         const sunEnergy =
            rawData.reduce((acc, a) => {
               const timeDiff = a.timestamp_end - a.timestamp_start;
               const power = a.p_sun;
               return acc + power * timeDiff;
            }, 0) / 3_600_000;
         const loadEnergy =
            rawData.reduce((acc, a) => {
               const timeDiff = a.timestamp_end - a.timestamp_start;
               const power = Math.max(0, a.p_load);
               return acc + power * timeDiff;
            }, 0) / 3_600_000;
         barGraph.elements.push({
            a: sunEnergy,
            b: loadEnergy,
            label: label,
            data: {
               start: start,
               end: end,
               title: title,
               subTitle: subTitle,
               labels: lineGraphLabels,
               values: rawData,
               blockLength: blockLength,
               sunEnergy: sunEnergy,
               loadEnergy: loadEnergy,
            },
         });
      });
   }
   const interval = setInterval(() => {
      if (doneCounter < numberOfBars) return;
      if (tabId == "custom") {
         DOM.select("pickerContainer").setStyle({ display: "flex" });
         barGraph.setVisibility(false);
      } else {
         DOM.select("pickerContainer").setStyle({ display: "none" });
         barGraph.setVisibility(true);
      }
      barGraph.draw();
      statsContainer.removeClass("waiting");
      clearInterval(interval);
   }, 10);
}

// Called when an Element in the Bar Graph is Clicked
barGraph.elementClicked = (data) => {
   lineGraph.setTitle(data.title);
   lineGraph.setSubTitle(data.subTitle);
   lineGraph.setLabels(data.labels);
   processStatistics(data);

   // Reset Graph Values
   Object.values(lineGraph.data).forEach((a) => {
      a.values = [];
   });

   const numberOfBlocks = Math.round((data.end - data.start) / data.blockLength);
   let prevEnd = 0;
   for (let i = 0; i < numberOfBlocks; i++) {
      const blockStart = data.start + data.blockLength * i;
      const blockEnd = blockStart + data.blockLength;
      let sunPower = 0;
      let loadPower = 0;
      let battSoC = 0;
      let gridExportPower = 0;
      let gridImportPower = 0;
      let cnt = 0;
      for (let j = prevEnd; j < data.values.length; j++) {
         const timestamp = data.values[j].timestamp_start;
         if (timestamp > blockEnd) break;
         if (timestamp >= blockStart) {
            sunPower += data.values[j].p_sun;
            loadPower += Math.max(0, data.values[j].p_load);
            battSoC += data.values[j].batt_soc;
            gridExportPower += data.values[j].p_grid_export ?? Math.abs(Math.min(0, data.values[j].p_grid));
            gridImportPower += data.values[j].p_grid_import ?? Math.max(0, data.values[j].p_grid);
            cnt++;
            prevEnd = j;
         }
      }
      lineGraph.data.sun.values.push(cnt == 0 ? undefined : sunPower / cnt);
      lineGraph.data.load.values.push(cnt == 0 ? undefined : loadPower / cnt);
      lineGraph.data.battSoC.values.push(cnt == 0 ? undefined : battSoC / cnt);
      lineGraph.data.battLimitLower.values.push(100 * constants.battery.discharge.limit);
      lineGraph.data.battLimitUpper.values.push(100 * constants.battery.charge.limit);
      lineGraph.data.gridExport.values.push(cnt == 0 ? undefined : gridExportPower / cnt);
      lineGraph.data.gridImport.values.push(cnt == 0 ? undefined : gridImportPower / cnt);
   }
   lineGraph.draw();
};

// Calculate all the interesting data
function processStatistics(data) {
   const debugText = DOM.select("debugText");
   debugText.setContent("");

   // Ertrag / Verbrauch
   DOM.select("sunEnergy").setText((data.sunEnergy / 1000).toTwoDecimalString(50));
   DOM.select("loadEnergy").setText((data.loadEnergy / 1000).toTwoDecimalString(50));

   // Peak Values
   DOM.select("maxSunPower").setText("0,00");
   DOM.select("minSunPower").setText("0,00");
   getPeakValues("p_sun", data.start, data.end).then((maxSunPower) => {
      DOM.select("maxSunPower").setText((maxSunPower.max / 1000).toTwoDecimalString());
      DOM.select("minSunPower").setText((maxSunPower.min / 1000).toTwoDecimalString());
   });

   DOM.select("maxLoadPower").setText("0,00");
   DOM.select("minLoadPower").setText("0,00");
   getPeakValues("p_load", data.start, data.end).then((maxLoadPower) => {
      DOM.select("maxLoadPower").setText((maxLoadPower.max / 1000).toTwoDecimalString());
      DOM.select("minLoadPower").setText((maxLoadPower.min / 1000).toTwoDecimalString());
   });

   // Grid Bar
   const gridImportEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = a.p_grid_import ?? Math.max(a.p_grid, 0);
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   const gridExportEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = a.p_grid_export ?? Math.abs(Math.min(a.p_grid, 0));
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   const gridImportCost = (gridImportEnergy / 1000) * constants.costPerKwh;
   const gridExportCost = (gridExportEnergy / 1000) * constants.earningsPerKwh;
   DOM.select("gridExportCostValue").setText("+" + gridExportCost.toEuroString());
   DOM.select("gridImportCostValue").setText("-" + gridImportCost.toEuroString());
   DOM.select("gridExportValue").setText((gridExportEnergy / 1000).toTwoDecimalString(50));
   DOM.select("gridImportValue").setText((gridImportEnergy / 1000).toTwoDecimalString(50));
   const totalGridEnergy = gridImportEnergy + gridExportEnergy;
   const ratio = totalGridEnergy == 0 ? 0.5 : gridExportEnergy / totalGridEnergy;
   DOM.select("ratioBarGreen").setStyle({ width: `${Math.round(ratio * 100)}%` });

   // Finances
   const actualCost = gridExportCost - gridImportCost;
   const marketPriceOfEnergyUsed = Math.round((data.loadEnergy / 1000) * constants.costPerKwh * 100) / 100;
   const savedMoney = actualCost + marketPriceOfEnergyUsed;
   DOM.select("costWithoutPvValue").setText(`-${marketPriceOfEnergyUsed.toEuroString()}`);
   DOM.select("costWithPvValue").setText((actualCost > 0 ? "+" : "-") + Math.abs(actualCost).toEuroString());
   if (actualCost < 0) {
      DOM.select("costBoxWithPv").removeClass("costBoxGreen").addClass("costBoxRed");
   } else {
      DOM.select("costBoxWithPv").removeClass("costBoxRed").addClass("costBoxGreen");
   }
   DOM.select("costSavedValue").setText(savedMoney.toEuroString());
   const amortized = (savedMoney / constants.totalSystemCost) * 100;
   amortizationBar.setValue(Math.round(amortized * 100) / 100);
   const timeSpan = data.end - data.start;
   const totalTime = (timeSpan / amortized) * 100;
   const timeLeft = totalTime - timeSpan;
   const endDate = new Date(Date.now() + timeLeft).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
   const years = (Math.round((totalTime / 1000 / 60 / 60 / 24 / 365.25) * 10) / 10).toLocaleString("de-DE");
   amortizationBar.setInfoText(`100% nach ${years} Jahren am ${endDate}`);
   amortizationBar.setVisibility(selectedTabId == "custom");

   // Energy Mix
   const directSunUseEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = Math.min(a.p_sun, Math.max(0, a.p_load));
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   const batteryUseEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = Math.max(a.p_batt - a.p_losses, 0);
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   energyMixPieChart.setData([
      { value: gridImportEnergy, color: { r: 255, g: 44, b: 133 }, description: "Netzbezug" },
      { value: directSunUseEnergy, color: { r: 255, g: 199, b: 0 }, description: "Sonne Direkt" },
      { value: batteryUseEnergy, color: { r: 0, g: 210, b: 140 }, description: "Batterie" },
   ]);

   // Energy Disribution
   const batteryChargeEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = Math.abs(Math.min(a.p_batt, 0));
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   energyDistributionPieChart.setData([
      { value: gridExportEnergy, color: { r: 255, g: 44, b: 133 }, description: "Netzeinspeisung" },
      { value: directSunUseEnergy, color: { r: 48, g: 150, b: 255 }, description: "Direktverbrauch" },
      { value: batteryChargeEnergy, color: { r: 0, g: 210, b: 140 }, description: "Batterieladung" },
   ]);

   // Solar Sources
   const string1Energy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = a.p_string1;
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   const string2Energy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = a.p_string2;
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   const genPortEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = Math.max(0, a.p_gen);
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   solarSourcePieChart.setData([
      { value: string1Energy, color: { r: 255, g: 199, b: 0 }, description: "Dach String 2+3" },
      { value: string2Energy, color: { r: 204, g: 159, b: 0 }, description: "Dach String 1" },
      { value: genPortEnergy, color: { r: 173, g: 135, b: 0 }, description: "Mikrowechselrichter" },
   ]);

   // Autarkiegrad & Eigenverbrauch
   const selfSufficiencyValue = Math.round((100 * (directSunUseEnergy + batteryUseEnergy)) / (gridImportEnergy + directSunUseEnergy + batteryUseEnergy));
   selfSufficiencyBar.setValue(selfSufficiencyValue);
   const selfUseValue = Math.round((100 * (directSunUseEnergy + batteryChargeEnergy)) / (gridExportEnergy + directSunUseEnergy + batteryChargeEnergy));
   selfUseBar.setValue(selfUseValue);

   // CO2 View
   const savedCo2 = Math.round((data.sunEnergy / 1000) * 391);
   const co2ToBalloons = Math.round(savedCo2 / 4.95);
   const co2ToCar = Math.round(savedCo2 / 160);
   const gramsOfCoalPerKwhGermanEnergyMix = 75;
   const gramsOfSavedCoal = (data.sunEnergy / 1000) * gramsOfCoalPerKwhGermanEnergyMix;
   const gramsCo2perTreePerYear = 13_000;
   const timeFrameYears = (Math.max(...data.values.map((value) => value.timestamp_end)) - Math.min(...data.values.map((value) => value.timestamp_start))) / (1000 * 60 * 60 * 24 * 365.25);
   const numberOfTrees = Math.round(savedCo2 / timeFrameYears / gramsCo2perTreePerYear);
   DOM.select("co2WeightText").setText((savedCo2 / 1000).toTwoDecimalString(50));
   DOM.select("co2BalloonsText").setText(co2ToBalloons.toLocaleString("de-DE"));
   DOM.select("co2CarKmText").setText(co2ToCar);
   DOM.select("co2TreesText").setText(numberOfTrees);
   DOM.select("co2CoalText").setText((gramsOfSavedCoal / 1000).toTwoDecimalString(50));

   // Comparison Stats
   const numberOfSmartphoneCharges = Math.round(data.sunEnergy / 15).toLocaleString("de-DE");
   DOM.select("smartphoneCharges").setText(numberOfSmartphoneCharges);
   const numberOfLitersWaterBoiled = Math.round(data.sunEnergy / 93.02).toLocaleString("de-DE");
   DOM.select("litersOfBoilingWater").setText(numberOfLitersWaterBoiled);
   const kilometersECar = Math.round(data.sunEnergy / 180).toLocaleString("de-DE");
   DOM.select("kilometersECar").setText(kilometersECar);
   const kilometersBike = Math.round(data.sunEnergy / 5).toLocaleString("de-DE");
   DOM.select("kilometersBike").setText(kilometersBike);
   const timesCoffee = Math.round(data.sunEnergy / 40).toLocaleString("de-DE");
   DOM.select("timesCoffee").setText(timesCoffee);
   const hoursLight = Math.round(data.sunEnergy / 30).toLocaleString("de-DE");
   DOM.select("hoursLight").setText(hoursLight);
   const hoursTv = Math.round(data.sunEnergy / 70).toLocaleString("de-DE");
   DOM.select("hoursTv").setText(hoursTv);
   const hoursOven = Math.round(data.sunEnergy / 2500).toLocaleString("de-DE");
   DOM.select("hoursOven").setText(hoursOven);
   const hoursMicrowave = Math.round(data.sunEnergy / 900).toLocaleString("de-DE");
   DOM.select("hoursMicrowave").setText(hoursMicrowave);
   const hoursFridge = Math.round(data.sunEnergy / 50).toLocaleString("de-DE");
   DOM.select("hoursFridge").setText(hoursFridge);
   const hoursHeater = Math.round(data.sunEnergy / 3000).toLocaleString("de-DE");
   DOM.select("hoursHeater").setText(hoursHeater);
   const timesWashing = Math.round(data.sunEnergy / 900).toLocaleString("de-DE");
   DOM.select("timesWashing").setText(timesWashing);
   const hoursVacuum = Math.round(data.sunEnergy / 800).toLocaleString("de-DE");
   DOM.select("hoursVacuum").setText(hoursVacuum);
   const windRotations = (Math.round((data.sunEnergy / 4670) * 10) / 10).toLocaleString("de-DE");
   DOM.select("windRotations").setText(windRotations);

   // Km Bars
   /*const ranges = [
      { name: "Privatjet", value: (data.sunEnergy / 4_320_000) * 100, icon: "jet.png", hidden: true },
      { name: "Motorboot", value: (data.sunEnergy / 282_000) * 100, icon: "yacht.png", hidden: true },
      { name: "Verbrenner-SUV", value: (data.sunEnergy / 82_000) * 100, icon: "car.png", hidden: true },
      { name: "Verbrenner-Auto", value: (data.sunEnergy / 48_000) * 100, icon: "car.png" },
      { name: "Verbrenner-Motorrad", value: (data.sunEnergy / 40_000) * 100, icon: "motorcycle.png", hidden: true },
      { name: "Flugzeug", value: (data.sunEnergy / 24_000) * 100, icon: "plane.png" },
      { name: "E-Auto", value: (data.sunEnergy / 12_000) * 100, icon: "car.png" },
      { name: "Verbrenner-Bus", value: (data.sunEnergy / 8_600) * 100, icon: "bus.png" },
      { name: "E-Motorrad", value: (data.sunEnergy / 8_000) * 100, icon: "motorcycle.png", hidden: true },
      { name: "E-Segelflugzeug", value: (data.sunEnergy / 6_150) * 100, icon: "jet.png", hidden: true },
      { name: "E-Bus", value: (data.sunEnergy / 4_000) * 100, icon: "bus.png", hidden: true },
      { name: "Zu Fuß", value: (data.sunEnergy / 2_600) * 100, icon: "pedestrian.png" },
      { name: "Zug", value: (data.sunEnergy / 2_500) * 100, icon: "train.png" },
      { name: "Urbane Seilbahn", value: (data.sunEnergy / 2_000) * 100, icon: "cablecar.png", hidden: true },
      { name: "Lastenrad", value: (data.sunEnergy / 1_400) * 100, icon: "cargobike.png", hidden: true },
      { name: "E-Scooter", value: (data.sunEnergy / 1_350) * 100, icon: "e_scooter.png" },
      { name: "E-Bike", value: (data.sunEnergy / 850) * 100, icon: "bike.png" },
      { name: "Fahrrad", value: (data.sunEnergy / 500) * 100, icon: "bike.png" },
      { name: "Liegerad", value: (data.sunEnergy / 330) * 100, icon: "bike.png", hidden: true },
      { name: "Velomobil", value: (data.sunEnergy / 250) * 100, icon: "velomobile.png", hidden: true },
   ];
   function updateBars() {
      button.setText(kmBarsIgnoreHidden ? "Alle ausblenden" : "Alle einblenden");
      const max = Math.max(...ranges.map((item) => (item.hidden && !kmBarsIgnoreHidden ? 0 : item.value)));
      kmBars.forEach((bar) => bar.setMax(max));
      Object.values(ranges).forEach((data, index) => {
         kmBars[index].setValue(data.value);
         kmBars[index].setValueText(Math.round(data.value));
         kmBars[index].setInfoText(data.name);
         kmBars[index].setIcon(data.icon);
         const isHidden = data.hidden && !kmBarsIgnoreHidden;
         kmBars[index].setVisibility(!isHidden);
      });
   }
   const button = DOM.select("kmBarsAllButton");
   button.onClick(() => {
      kmBarsIgnoreHidden = !kmBarsIgnoreHidden;
      updateBars();
   });
   updateBars();*/

   // Battery Health
   const batteryDischargeEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = Math.max(a.p_batt, 0);
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   const totalEnergy = batteryChargeEnergy + batteryDischargeEnergy;
   const batteryCycles = totalEnergy / (2 * constants.battery.capacity);
   let deltaSoc = 0;
   data.values.forEach((a, index) => {
      if (index > 0) {
         deltaSoc += Math.abs(a.batt_soc - data.values[index - 1].batt_soc);
      }
   });
   const totalCapacity = totalEnergy / (deltaSoc / 100);
   const stateOfHealth = totalCapacity / constants.battery.capacity;
   const maxSoc = Math.max(...data.values.map((a) => a.batt_soc));
   const minSoc = Math.min(...data.values.map((a) => a.batt_soc));
   const avgSoc = data.values.reduce((acc, a) => acc + a.batt_soc, 0) / data.values.length;

   const startSoC = data.values[0].batt_soc;
   const endSoC = data.values[data.values.length - 1].batt_soc;
   const socDiff = endSoC - startSoC;
   const roundTripEfficiency = (batteryDischargeEnergy + (socDiff / 100) * totalCapacity) / batteryChargeEnergy;

   DOM.select("batteryChargeText").setText((batteryChargeEnergy / 1000).toTwoDecimalString(50));
   DOM.select("batteryDischargeText").setText((batteryDischargeEnergy / 1000).toTwoDecimalString(50));
   DOM.select("maxBatterySoCText").setText(Math.round(maxSoc));
   DOM.select("minBatterySoCText").setText(Math.round(minSoc));
   DOM.select("avgBatterySoCText").setText(Math.round(avgSoc));
   DOM.select("batteryCyclesText").setText(batteryCycles.toTwoDecimalString(10));
   DOM.select("batterySoHText").setText(Math.round(100 * stateOfHealth));
   DOM.select("batteryRteText").setText(Math.round(100 * roundTripEfficiency));

   if (totalEnergy < 2 * constants.battery.capacity) {
      DOM.select("batterySoHText").setText("n/a");
      DOM.select("batteryRteText").setText("n/a");
   }

   // Debug Text
   const lossesEnergy =
      data.values.reduce((acc, a) => {
         const timeDiff = a.timestamp_end - a.timestamp_start;
         const power = a.p_losses;
         return acc + power * timeDiff;
      }, 0) / 3_600_000;
   debugText.appendText(`\n${(lossesEnergy / 1000).toTwoDecimalString(50)} kWh Verluste durch Effizienzeinbußen und Eigenverbrauch des Systems`);
}
