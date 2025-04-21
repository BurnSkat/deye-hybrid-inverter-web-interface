import DOM from "./dom.js";

export default class PieChart {
   constructor() {
      this.container = DOM.create("div.pieChartContainer");
      this.pieChart = DOM.create("div.pieChart").appendTo(this.container);
      this.centerIcon = DOM.create("div.centerIcon").appendTo(this.container);
      this.legendContainer = DOM.create("div.pieChartLegendContainer").appendTo(this.container);
   }
   setData(data) {
      const gradient = this.createConicGradient(data);
      this.pieChart.setStyle({ backgroundImage: gradient });
      /*this.legendContainer.setContent("");
      const sum = data.reduce((acc, elem) => acc + elem.value, 0);
      for (let elem of data) {
         const { r, g, b } = elem.color;
         const portion = Math.round((elem.value / sum) * 100);
         this.legendContainer.append(
            DOM.create("div.pieChartLegendElementContainer")
               .append(DOM.create("div.pieChartLegendCircle").setStyle({ backgroundColor: `rgb(${r}, ${g}, ${b})` }))
               .append(DOM.create("t.pieChartLegendText").setContent(`${elem.description}<t style='opacity: 0.26'>: ${portion}<t style='font-size: 80%'> %</t></t>`)),
               );
               }*/
   }
   createConicGradient(data) {
      const gradientParts = [];
      let cumulativePercent = 0;
      const sum = data.reduce((acc, elem) => acc + elem.value, 0);
      data.forEach((slice) => {
         const { value, color } = slice;
         const colorString = `rgb(${color.r}, ${color.g}, ${color.b})`;
         const startPercent = Math.round(cumulativePercent * 1000) / 10;
         cumulativePercent += value / sum;
         const endPercent = Math.round(cumulativePercent * 1000) / 10;
         gradientParts.push(`${colorString} ${startPercent}% ${endPercent}%`);
      });
      const gradientString = `conic-gradient(${gradientParts.join(", ")})`;
      return gradientString;
   }
   setIcon(icon, waveColor, flipDirection) {
      this.centerIcon.setStyle({ backgroundImage: `url("/assets/images/${icon}")` });
      if (waveColor) {
         this.centerIcon.getFirstElement().style.setProperty("--waveColor", `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, 0.3)`);
         this.centerIcon.getFirstElement().style.setProperty("--animationName", flipDirection ? "waveOut" : "waveIn");
      }
   }
}
