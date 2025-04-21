import DOM from "./dom.js";
import * as LiveView from "./liveView.js";
import * as StatsView from "./statsView.js";
import { mod, constants } from "./helper.js";

// Variables
const mainContainer = DOM.select("mainContainer");
const loadingContainer = DOM.create("div#loadingContainer")
   .append(DOM.create("img#loadingImage [src=/assets/images/sun.png]"))
   .append(DOM.create("t#loadingText").setText("SolarHub"))
   .appendTo(mainContainer);
const divider = DOM.create("div#divider");
setTimeout(() => {
   loadingContainer.setStyle({ opacity: "0" });
}, 1400);

function buildUI() {
   if (!constants) {
      setTimeout(() => {
         buildUI();
      }, 100);
      return;
   }
   LiveView.build(mainContainer);
   divider.appendTo(mainContainer);
   StatsView.build(mainContainer);
}
setTimeout(() => {
   buildUI();
}, 300);

// Set Display Mode
// Mode 0 = default,
// Mode 1 = Broken iPad Screen Mode
let displayMode = JSON.parse(localStorage.getItem("displayMode")) ?? 0;
setTimeout(() => {
   setDisplayMode(displayMode);
   DOM.select("dateTimeContainer").onClick(() => {
      displayMode = mod(displayMode + 1, 2);
      setDisplayMode(displayMode);
      localStorage.setItem("displayMode", displayMode);
   });
}, 1000);
function setDisplayMode(mode) {
   if (mode == 0) {
      DOM.select("liveContainer").setStyle({
         maxWidth: "",
         margin: "",
         height: "",
         background: "",
         border: "",
      });
      DOM.select("statsContainer").setStyle({
         background: "",
      });
      divider.setStyle({
         backgroundColor: "",
         opacity: "",
         height: "",
         borderRadius: "",
         width: "",
      });
      document.documentElement.style.setProperty("--backgroundGradient", "");
      document.body.style.background = "";
      const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--themeColor").trim();
   }

   if (mode == 1) {
      const gradient = getComputedStyle(document.documentElement).getPropertyValue("--backgroundGradient").trim();
      DOM.select("liveContainer").setStyle({
         maxWidth: "calc(50% - 175px)",
         margin: "0px",
         height: "100vh",
         background: gradient,
         border: "none",
      });
      DOM.select("statsContainer").setStyle({
         background: gradient,
      });
      divider.setStyle({
         backgroundColor: "black",
         opacity: "1",
         height: "100vh",
         borderRadius: "0",
         width: "175px",
      });
      document.documentElement.style.setProperty("--backgroundGradient", "transparent");
      document.body.style.background = "black";
   }
}
