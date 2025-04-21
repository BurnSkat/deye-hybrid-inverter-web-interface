import DOM from "/scripts/dom.js";
import { getWifiNetworks } from "/scripts/com.js";

// Build UI
const mainContainer = DOM.select("mainContainer");
DOM.create("t.title").setText("Settings - Beta").setStyle({ marginBottom: "20px" }).appendTo(mainContainer);
DOM.create("div.button")
   .setText("Change Wifi")
   .appendTo(mainContainer)
   .onClick(() => {
      changeWifi();
   });
DOM.create("div.inputButtonContainer").append(DOM.create("div.input [contenteditable=true]").setContent("0")).append(DOM.create("div.button").setText("Read Register")).appendTo(mainContainer);
DOM.create("div.inputButtonContainer")
   .append(DOM.create("div.input [contenteditable=true]").setContent("0"))
   .append(DOM.create("div.input [contenteditable=true]").setContent("0"))
   .append(DOM.create("div.button").setText("Write Register"))
   .appendTo(mainContainer);

// Change Wifi
async function changeWifi() {
   let networks;
   getWifiNetworks().then((res) => {
      networks = res;
   });
   let confirmed = confirm("Möchtest Du eine neue WLAN-Verbindung einrichten?");
   if (!confirmed) return;

   // Wait Until Networks are fetched.
   while (!networks) await new Promise((resolve) => setTimeout(resolve, 10));

   let networksString = "";
   for (let i = 0; i < networks.length; i++) {
      const network = networks[i];
      networksString += `\n${i + 1}. ${network["SSID"]} (${network["RATE"]} Mbit/s, ${network["SIGNAL"]}%)`;
   }
   const ssidIndex = prompt(`Verfügbare Netwerke:${networksString}\n\nIndex der SSID des neuen Netzwerks eingeben (z.B. 3):`);
   if (ssidIndex === null) return;
   const ssid = networks[parseInt(ssidIndex) - 1]["SSID"];
   const password = prompt(`Passwort für ${ssid} eingeben:`);
   if (password === null) return;
   const staticIp = prompt(`Optional: Statische IP-Adresse festlegen (z.B. 192.168.31.7):`);
   let userConfirmed = confirm(`Sicher, dass das Netzwerk zu ${ssid} (PW: ${password}, IP: ${staticIp || "Dynamisch"}) geändert werden soll? Das bisherige Netzwerk funktioniert dann nicht mehr.`);
   if (userConfirmed) {
      updateWifi(ssid, password, staticIp).then((res) => {
         window.alert("System wird neu gestartet und ist danach unter seiner neuen IP erreichbar.");
      });
   } else {
      window.alert("Abgebrochen. Altes Netzwerk wird beibehalten.");
   }
}
