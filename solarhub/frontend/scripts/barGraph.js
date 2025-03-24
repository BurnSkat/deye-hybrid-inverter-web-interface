import DOM from "./dom.js";

export default class BarGraph {
   constructor() {
      this.elements = [];
      this.container = DOM.create("div.barGraphContainer");
      this.elementClicked = () => {};
      this.selectedIndex;
   }
   setVisibility(visible) {
      this.container.setStyle({
         display: visible ? "flex" : "none",
      });
   }
   draw() {
      this.elements.sort((a, b) => a.data.start - b.data.start);
      this.container.setContent("");
      const containerHeight = 230;
      const labelHeight = 25;
      const maxVal = Math.max(...this.elements.map((elem) => Math.max(elem.a, elem.b)));
      const scalingFactor = (containerHeight - labelHeight) / maxVal / 2;
      for (let i = 0; i < this.elements.length; i++) {
         const elem = this.elements[i];
         const elementContainer = DOM.create("div.elementContainer");
         const bar1Height = Math.max(elem.a * scalingFactor, 2);
         const bar2Height = Math.max(elem.b * scalingFactor, 2);
         const offset = (containerHeight - labelHeight) / 2 - bar1Height;
         DOM.create("div.bar.upper")
            .setStyle({
               height: bar1Height + "px",
               marginTop: offset + "px",
            })
            .appendTo(elementContainer);
         DOM.create("t.label").setText(elem.label).appendTo(elementContainer);
         DOM.create("div.bar.lower")
            .setStyle({
               height: bar2Height + "px",
            })
            .appendTo(elementContainer);
         let selectedIndex = this.selectedIndex;
         if (!selectedIndex || selectedIndex >= this.elements.length) selectedIndex = this.elements.length - 1;
         const isSelected = i == selectedIndex;
         elementContainer.onClick(() => {
            this.selectedIndex = i;
            document.querySelectorAll(".selected").forEach((selectedElem) => {
               selectedElem.classList.remove("selected");
            });
            elementContainer.addClass("selected");
            this.elementClicked(elem.data);
         }, isSelected);
         this.container.append(elementContainer);
      }
   }
}
