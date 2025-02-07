// ----------------------------------
// External Library Imports
// ----------------------------------
import {
  CandlestickSeriesOptions,
  ColorType,
  IChartApi,
  ISeriesPrimitive,
  LineStyle,
  MouseEventParams,
  PriceScaleMode,
  PriceScaleOptions,
  SolidColor,
  VerticalGradientColor,
  Background,
  ISeriesApi,
  SingleValueData,
  CustomSeriesOptions,
  LineWidth,
  OhlcData,
} from "lightweight-charts";
// ----------------------------------
// Internal Helpers and Types
// ----------------------------------
import {
  cloneSeriesAsType,
  decorateSeriesAsIndicator,
  ensureExtendedSeries,
  ISeriesIndicator,
  OhlcSeriesOptions,
  recalculateIndicator,
  singleToOhlcData,
  SupportedSeriesType,
} from "../helpers/series";
import {
  isCandleShape,
  isFillArea,
  isISeriesIndicator,
  isOHLCData,
  isSingleValueData,
  isSolidColor,
  isVerticalGradientColor,
  isWhitespaceData,
} from "../helpers/typeguards";
import {
  AreaSeriesOptions,
  BarSeriesOptions,
  ISeriesApiExtended,
  LineSeriesOptions,
  SeriesOptionsExtended,
} from "../helpers/series";

// ----------------------------------
// General Modules
// ----------------------------------
import { GlobalParams } from "../general/global-params";
import { Handler } from "../general/handler";

// ----------------------------------
// Drawing and Chart Extensions
// ----------------------------------
import { DrawingTool } from "../drawing/drawing-tool";
import { Drawing } from "../drawing/drawing";
import { DrawingOptions } from "../drawing/options";
import { FillArea, defaultFillAreaOptions } from "../fill-area/fill-area";

// ----------------------------------
// UI Components
// ----------------------------------
import { ColorPicker } from "./color-picker";
import { ColorPicker as seriesColorPicker } from "./color-picker_";
import { StylePicker } from "./style-picker";

// ----------------------------------
// Specialized Data
// ----------------------------------
import { CandleShape } from "../ohlc-series/data";
import { buildOptions, camelToTitle } from "../helpers/formatting";
import { TrendTrace } from "../trend-trace/trend-trace";
import { Point as LogicalPoint } from "../drawing/data-source";
import { TwoPointDrawing } from "../drawing/two-point-drawing";
import {
  defaultVolumeProfileOptions,
  VolumeProfile,
} from "../volume-profile/volume-profile";
import { defaultSequenceOptions, DataPoint } from "../trend-trace/sequence";
import { PluginBase } from "../plugin-base";

import { generateShades, setOpacity } from "../helpers/colors";
import { INDICATORS, IndicatorDefinition } from "../indicators/indicators";
import { ohlcSeries, ohlcSeriesOptions } from "../ohlc-series/ohlc-series";
import { ForkLine, PitchFork, PitchForkOptions } from "../pitchfork/pitchfork";
import { ThreePointDrawing } from "../drawing/three-point-drawing";
import { OffsetPoint } from "../helpers/general";

// ----------------------------------
// If you have actual code referencing commented-out or removed imports,
// reintroduce them accordingly.
// ----------------------------------

export let activeMenu: HTMLElement | null = null;
type priceScale = "left" | "right" | undefined;

interface Item {
  elem: HTMLSpanElement;
  action: Function;
  closeAction: Function | null;
}

declare const window: GlobalParams;
// Define a common interface for an option descriptor.
interface OptionDescriptor {
  name: string;
  type: "number" | "boolean" | "color" | "select";
  valuePath: string;
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}
export class ContextMenu {
  public div: HTMLDivElement;
  private hoverItem: Item | null;
  private items: HTMLElement[] = [];
  private colorPicker: seriesColorPicker = new seriesColorPicker(
    "#ff0000",
    () => null
  );
  private saveDrawings: Function | null = null;
  private drawingTool: DrawingTool | null = null;
  public recentSeries: ISeriesApiExtended | null = null;
  public recentDrawing: Drawing | null = null;

  private volumeProfile: VolumeProfile | null = null;

  constructor(
    private handler: Handler,
    private handlerMap: Map<string, Handler>,
    public getMouseEventParams: () => MouseEventParams | null
  ) {
    this.div = document.createElement("div");
    this.div.classList.add("context-menu");
    document.body.appendChild(this.div);
    this.div.style.overflowY = "scroll";
    this.hoverItem = null;
    document.body.addEventListener(
      "contextmenu",
      this._onRightClick.bind(this)
    );
    document.body.addEventListener("click", this._onClick.bind(this));
    //this.handler.chart.subscribeCrosshairMove((param: MouseEventParams) => {
    //  this.handleCrosshairMove(param);
    //});

    this.setupMenu();
  }
  private constraints: Record<
    string,
    { skip?: boolean; min?: number; max?: number }
  > = {
    baseline: { skip: true },
    title: { skip: true },
    PriceLineSource: { skip: true },
    tickInterval: { min: 0, max: 100 },
    lastPriceAnimation: { skip: true },
    lineType: { min: 0, max: 2 },
    lineStyle: { min: 0, max: 4 },

    seriesType: { skip: true },
    chandelierSize: { skip: true },
    volumeCandles: { skip: true },
    volumeMALength: { skip: true },
    volumeMultiplier: { skip: true },
  };
  public setupDrawingTools(saveDrawings: Function, drawingTool: DrawingTool) {
    this.saveDrawings = saveDrawings;
    this.drawingTool = drawingTool;
  }

  private shouldSkipOption(optionName: string): boolean {
    const constraints = this.constraints[optionName] || {};
    return !!constraints.skip;
  }
  public separator() {
    const separator = document.createElement("div");
    separator.style.width = "90%";
    separator.style.height = "1px";
    separator.style.margin = "3px 0px";
    separator.style.backgroundColor = window.pane.borderColor;
    this.div.appendChild(separator);

    this.items.push(separator);
  }

  public menuItem(
    text: string,
    action: Function,
    hover: Function | null = null
  ) {
    const item = document.createElement("span");
    item.classList.add("context-menu-item");
    this.div.appendChild(item);

    const elem = document.createElement("span");
    elem.innerText = text;
    elem.style.pointerEvents = "none";
    item.appendChild(elem);

    if (hover) {
      let arrow = document.createElement("span");
      arrow.innerText = `►`;
      arrow.style.fontSize = "8px";
      arrow.style.pointerEvents = "none";
      item.appendChild(arrow);
    }

    item.addEventListener("mouseover", () => {
      if (this.hoverItem && this.hoverItem.closeAction)
        this.hoverItem.closeAction();
      this.hoverItem = { elem: elem, action: action, closeAction: hover };
    });
    if (!hover)
      item.addEventListener("click", (event) => {
        action(event);
        this.div.style.display = "none";
      });
    else {
      let timeout: any;
      item.addEventListener(
        "mouseover",
        () =>
          (timeout = setTimeout(
            () => action(item.getBoundingClientRect()),
            100
          ))
      );
      item.addEventListener("mouseout", () => clearTimeout(timeout));
    }

    this.items.push(item);
  }

  private _onClick(ev: MouseEvent) {
    const target = ev.target as Node;
    const menus = [this.colorPicker];

    menus.forEach((menu) => {
      if (!menu.getElement().contains(target)) {
        menu.closeMenu();
      }
    });
  }

  // series-context-menu.ts

  private _onRightClick(event: MouseEvent): void {
    event.preventDefault(); // Prevent the browser's context menu

    const mouseEventParams = this.getMouseEventParams();
    const seriesFromProximity = this.getProximitySeries(
      this.getMouseEventParams()!
    );
    const drawingFromProximity = this.getProximityDrawing(); // Implement this method based on your drawing logic
    const trendFromProximity = this.getProximityTrendTrace();
    console.log("Mouse Event Params:", mouseEventParams);
    console.log("Proximity Series:", seriesFromProximity);
    console.log("Proximity Drawing:", drawingFromProximity);

    this.clearMenu(); // Clear existing menu items
    this.clearAllMenus(); // Clear other menus if necessary

    if (seriesFromProximity) {
      // Right-click on a series
      console.log("Right-click detected on a series (proximity).");
      this.populateSeriesMenu(seriesFromProximity, event);
      this.recentSeries = seriesFromProximity;
    } else if (drawingFromProximity) {
      // Right-click on a drawing
      console.log("Right-click detected on a drawing.");
      this.populateDrawingMenu(event, drawingFromProximity);
      this.recentDrawing = drawingFromProximity;
    } else if (trendFromProximity) {
      // Right-click on a drawing
      console.log("Right-click detected on a drawing.");
      this.populateTrendTraceMenu(event, trendFromProximity);
    } else if (mouseEventParams?.hoveredSeries) {
      // Fallback to hovered series
      console.log("Right-click detected on a series (hovered).");
      this.populateSeriesMenu(
        mouseEventParams.hoveredSeries as ISeriesApiExtended,
        event
      );
      this.recentSeries = seriesFromProximity;
    } else {
      // Right-click on chart background
      console.log("Right-click detected on the chart background.");
      this.populateChartMenu(event);
    }

    // Position the menu at cursor location
    this.showMenu(event);
    event.preventDefault();
    event.stopPropagation(); // Prevent event bubbling
  }

  // series-context-menu.ts

  private getProximityDrawing(): Drawing | null {
    // Implement your logic to determine if a drawing is under the cursor
    // For example:
    if (Drawing.hoveredObject) {
      return Drawing.hoveredObject;
    }

    return null;
  }

  private getProximityTrendTrace(): TrendTrace | null {
    if (TrendTrace.hoveredObject) {
      return TrendTrace.hoveredObject;
    }
    return null;
  }

  private getProximitySeries(
    param: MouseEventParams
  ): ISeriesApiExtended | null {
    if (!param || !param.seriesData) {
      console.warn("No mouse event parameters or series data available.");
      return null;
    }

    if (!param.point) {
      console.warn("No point data in MouseEventParams.");
      return null;
    }

    const cursorY = param.point.y;
    let sourceSeries: ISeriesApiExtended | null = null;
    const referenceSeries = this.handler._seriesList[0] as ISeriesApiExtended;

    if (this.handler.series) {
      sourceSeries = this.handler.series;
      console.log(`Using handler.series for coordinate conversion.`);
    } else if (referenceSeries) {
      sourceSeries = referenceSeries;
      console.log(`Using referenceSeries for coordinate conversion.`);
    } else {
      console.warn("No handler.series or referenceSeries available.");
      return null;
    }

    const cursorPrice = sourceSeries.coordinateToPrice(cursorY);
    console.log(`Converted chart Y (${cursorY}) to Price: ${cursorPrice}`);

    if (cursorPrice === null) {
      console.warn("Cursor price is null. Unable to determine proximity.");
      return null;
    }

    const seriesByDistance: {
      distance: number;
      series: ISeriesApiExtended;
    }[] = [];

    param.seriesData.forEach((data, series) => {
      let refPrice: number | undefined;
      if (isSingleValueData(data)) {
        refPrice = data.value;
      } else if (isOHLCData(data)) {
        refPrice = data.close;
      }

      if (refPrice !== undefined && !isNaN(refPrice)) {
        const distance = Math.abs(refPrice - cursorPrice);
        const percentageDifference = (distance / cursorPrice) * 100;

        if (percentageDifference <= 3.33) {
          const extendedSeries = ensureExtendedSeries(
            series,
            this.handler.legend
          );
          seriesByDistance.push({ distance, series: extendedSeries });
        }
      }
    });

    // Sort series by proximity (distance)
    seriesByDistance.sort((a, b) => a.distance - b.distance);

    if (seriesByDistance.length > 0) {
      console.log("Closest series found.");
      return seriesByDistance[0].series;
    }

    console.log("No series found within the proximity threshold.");
    return null;
  }

  public showMenu(event: MouseEvent): void {
    const x = event.clientX;
    const y = event.clientY;

    this.div.style.position = "absolute";
    this.div.style.zIndex = "10000";
    this.div.style.left = `${x}px`;
    this.div.style.top = `${y}px`;
    this.div.style.width = "250px";
    this.div.style.maxHeight = `400px`;
    this.div.style.overflowY = "auto";
    this.div.style.display = "block";
    this.div.style.overflowX = "hidden";
    console.log("Displaying Menu at:", x, y);

    activeMenu = this.div;
    console.log("Displaying Menu", x, y);

    document.addEventListener(
      "mousedown",
      this.hideMenuOnOutsideClick.bind(this),
      { once: true }
    );
  }

  private hideMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.div.contains(event.target as Node)) {
      this.hideMenu();
    }
  }

  public hideMenu() {
    this.div.style.display = "none";
    if (activeMenu === this.div) {
      activeMenu = null;
    }
  }

  private clearAllMenus() {
    this.handlerMap.forEach((handler) => {
      if (handler.ContextMenu) {
        handler.ContextMenu.clearMenu();
      }
    });
  }

  public setupMenu() {
    if (!this.div.querySelector(".chart-options-container")) {
      const chartOptionsContainer = document.createElement("div");
      chartOptionsContainer.classList.add("chart-options-container");
      this.div.appendChild(chartOptionsContainer);
    }

    if (!this.div.querySelector(".context-menu-item.close-menu")) {
      this.addMenuItem("Close Menu", () => this.hideMenu());
    }
  }

  private addNumberInput(
    label: string,
    defaultValue: number,
    onChange: (value: number) => void,
    min?: number,
    max?: number,
    step?: number
  ): HTMLElement {
    return this.addMenuInput(this.div, {
      type: "number",
      label,
      value: defaultValue,
      onChange,
      min,
      max,
      step,
    });
  }

  private addCheckbox(
    label: string,
    value: boolean,
    onChange: (value: boolean) => void
  ): HTMLElement {
    return this.addMenuInput(this.div, {
      type: "boolean",
      label,
      value: value,
      onChange,
    });
  }

  private addSelectInput(
    label: string,
    currentValue: string,
    options: string[],
    onSelectChange: (newValue: string) => void
  ): HTMLElement {
    return this.addMenuInput(this.div, {
      type: "select",
      label,
      value: currentValue,
      onChange: onSelectChange,
      options,
    });
  }

  public addMenuInput(
    parent: HTMLElement,
    config: {
      type: "string" | "color" | "number" | "boolean" | "select" | "hybrid";
      label: string;
      sublabel?: string;
      value?: any;
      onChange?: (newValue: any) => void;
      action?: () => void;
      min?: number;
      max?: number;
      step?: number;
      options?: string[];
      hybridConfig?: {
        defaultAction: () => void;
        options: { name: string; action: () => void }[];
      };
    },
    idPrefix: string = ""
  ): HTMLElement {
    const container = document.createElement("div");
    container.classList.add("context-menu-item");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-around";
    container.style.width = "90%";

    if (config.label) {
      const labelElem = document.createElement("label");
      labelElem.innerText = config.label;
      labelElem.htmlFor = `${idPrefix}${config.label.toLowerCase()}`;
      labelElem.style.flex = "0.8";
      labelElem.style.whiteSpace = "nowrap";
      container.appendChild(labelElem);
    }

    let inputElem: HTMLElement;

    switch (config.type) {
      case "hybrid": {
        if (!config.hybridConfig) {
          throw new Error("Hybrid type requires hybridConfig.");
        }

        const hybridContainer = document.createElement("div");
        hybridContainer.classList.add("context-menu-item");
        hybridContainer.style.position = "relative";
        hybridContainer.style.cursor = "pointer";
        hybridContainer.style.display = "flex";
        hybridContainer.style.textAlign = "center";
        hybridContainer.style.marginLeft = "auto";
        hybridContainer.style.marginRight = "8px";

        const labelElem = document.createElement("span");
        labelElem.innerText = config.sublabel ?? "Action";
        labelElem.style.flex = "1";
        hybridContainer.appendChild(labelElem);

        const dropdownIndicator = document.createElement("span");
        dropdownIndicator.innerText = "▼";
        dropdownIndicator.style.marginLeft = "8px";
        dropdownIndicator.style.color = "#fff";
        hybridContainer.appendChild(dropdownIndicator);

        const dropdown = document.createElement("div");
        dropdown.style.position = "absolute";
        dropdown.style.backgroundColor = "#2b2b2b";
        dropdown.style.color = "#fff";
        dropdown.style.border = "1px solid #444";
        dropdown.style.borderRadius = "4px";
        dropdown.style.minWidth = "100px";
        dropdown.style.boxShadow = "0px 2px 5px rgba(0, 0, 0, 0.5)";
        dropdown.style.zIndex = "10000";
        dropdown.style.display = "none";
        hybridContainer.appendChild(dropdown);

        // Populate dropdown with options
        config.hybridConfig.options.forEach((option) => {
          const optionElem = document.createElement("div");
          optionElem.innerText = option.name;
          optionElem.style.cursor = "pointer";
          optionElem.style.padding = "5px 10px";

          // Handle clicks on the dropdown options
          optionElem.addEventListener("click", (event) => {
            event.stopPropagation(); // Prevent propagation to the container
            dropdown.style.display = "none"; // Close dropdown
            option.action(); // Execute the action for the option
          });

          optionElem.addEventListener("mouseenter", () => {
            optionElem.style.backgroundColor = "#444";
          });

          optionElem.addEventListener("mouseleave", () => {
            optionElem.style.backgroundColor = "#2b2b2b";
          });

          dropdown.appendChild(optionElem);
        });

        // Clicking the hybrid container toggles the dropdown
        hybridContainer.addEventListener("click", (event) => {
          event.stopPropagation(); // Prevent triggering the default action
          dropdown.style.display =
            dropdown.style.display === "block" ? "none" : "block";
        });

        // Ensure the default action happens when clicking outside the hybrid container
        const menuItem = document.createElement("div");
        menuItem.classList.add("context-menu-item");
        menuItem.style.display = "flex";
        menuItem.style.alignItems = "center";
        menuItem.style.justifyContent = "space-between";
        menuItem.style.cursor = "pointer";

        menuItem.addEventListener("click", () => {
          config.hybridConfig!.defaultAction(); // Execute the default action
        });

        // Add the hybrid container to the menu item
        menuItem.appendChild(hybridContainer);

        // Close dropdown when clicking outside
        document.addEventListener("click", () => {
          dropdown.style.display = "none";
        });

        inputElem = menuItem;
        break;
      }

      case "number": {
        const input = document.createElement("input");
        input.type = "number";
        input.value = config.value !== undefined ? config.value.toString() : "";
        input.style.backgroundColor = "#2b2b2b"; // Darker gray background
        input.style.color = "#fff"; // White text
        input.style.border = "1px solid #444"; // Subtle border
        input.style.borderRadius = "4px";
        input.style.textAlign = "center";

        input.style.marginLeft = "auto"; // Adds margin to the right of the input

        input.style.marginRight = "8px"; // Adds margin to the right of the input
        input.style.width = "40px"; // Ensures a consistent width
        // Set min/max if provided
        if (config.min !== undefined) input.min = config.min.toString();
        if (config.max !== undefined) input.max = config.max.toString();

        // NEW: Set step if provided, default to 1 if not
        if (config.step !== undefined && !isNaN(config.step)) {
          input.step = config.step.toString();
        } else {
          input.step = "1"; // Or any other default
        }
        input.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          let newValue: number = parseFloat(target.value);
          if (!isNaN(newValue)) {
            config.onChange!(newValue);
          }
        });

        inputElem = input;
        break;
      }

      case "boolean": {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = config.value ?? false;
        input.style.marginLeft = "auto";
        input.style.marginRight = "8px";
        input.addEventListener("change", (event) => {
          const target = event.target as HTMLInputElement;
          config.onChange!(target.checked);
        });

        inputElem = input;
        break;
      }

      case "select": {
        const select = document.createElement("select");
        select.id = `${idPrefix}${
          config.label ? config.label.toLowerCase() : "select"
        }`;
        select.style.backgroundColor = "#2b2b2b"; // Darker gray background
        select.style.color = "#fff"; // White text
        select.style.border = "1px solid #444"; // Subtle border
        select.style.borderRadius = "4px";
        select.style.marginLeft = "auto";
        select.style.marginRight = "8px"; // Adds margin to the right of the dropdown
        select.style.width = "80px"; // Ensures consistent width for dropdown

        config.options?.forEach((optionValue) => {
          const option = document.createElement("option");
          option.value = optionValue;
          option.text = optionValue;
          option.style.whiteSpace = "normal"; // Allow wrapping within dropdown
          option.style.textAlign = "right";
          if (optionValue === config.value) option.selected = true;
          select.appendChild(option);
        });

        select.addEventListener("change", (event) => {
          const target = event.target as HTMLSelectElement;
          config.onChange!(target.value);
        });

        inputElem = select;
        break;
      }

      case "string": {
        const input = document.createElement("input");
        input.type = "text";
        input.value = config.value ?? "";
        input.style.backgroundColor = "#2b2b2b"; // Darker gray background
        input.style.color = "#fff"; // White text
        input.style.border = "1px solid #444"; // Subtle border
        input.style.borderRadius = "4px";
        input.style.marginLeft = "auto";
        input.style.textAlign = "center";
        input.style.marginRight = "8px"; // Adds margin to the right of the text input
        input.style.width = "60px"; // Ensures consistent width
        input.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          config.onChange!(target.value);
        });

        inputElem = input;
        break;
      }

      case "color": {
        const input = document.createElement("input");
        input.type = "color";
        input.value = config.value ?? "#000000";
        input.style.marginLeft = "auto";
        input.style.cursor = "pointer";
        input.style.marginRight = "8px"; // Adds margin to the right of the input
        input.style.width = "100px"; // Ensures a consistent width
        input.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          config.onChange!(target.value);
        });

        inputElem = input;
        break;
      }

      default:
        throw new Error("Unsupported input type");
    }
    //inputElem.style.padding= "2px 10px 2px 10px";
    container.style.padding = "2px 10px 2px 10px";
    container.appendChild(inputElem);
    parent.appendChild(container);
    return container;
  }

  public addMenuItem(
    text: string,
    action: () => void,
    shouldHide: boolean = true,
    hasSubmenu: boolean = false,
    submenuLevel: number = 1
  ): HTMLElement {
    const item = document.createElement("span");
    item.classList.add("context-menu-item");
    item.innerText = text;

    if (hasSubmenu) {
      const defaultArrow = document.createElement("span");
      defaultArrow.classList.add("submenu-arrow");
      defaultArrow.innerText = "ː".repeat(submenuLevel);
      item.appendChild(defaultArrow);
    }

    item.addEventListener("click", (event) => {
      event.stopPropagation();
      action();
      if (shouldHide) {
        this.hideMenu();
      }
    });

    const arrows: string[] = ["➩", "➯", "➱", "➬", "➫"];

    item.addEventListener("mouseenter", () => {
      item.style.backgroundColor = "royalblue";
      item.style.color = "white";

      if (!item.querySelector(".hover-arrow")) {
        const hoverArrow = document.createElement("span");
        hoverArrow.classList.add("hover-arrow");
        const randomIndex = Math.floor(Math.random() * arrows.length);
        const selectedArrow = arrows[randomIndex];
        hoverArrow.innerText = selectedArrow;
        hoverArrow.style.marginLeft = "auto";
        hoverArrow.style.fontSize = "8px";
        hoverArrow.style.color = "white";
        item.appendChild(hoverArrow);
      }
    });

    item.addEventListener("mouseleave", () => {
      item.style.backgroundColor = "";
      item.style.color = "";
      const hoverArrow = item.querySelector(".hover-arrow");
      if (hoverArrow) {
        item.removeChild(hoverArrow);
      }
    });

    this.div.appendChild(item);
    this.items.push(item);

    return item;
  }

  public clearMenu() {
    const dynamicItems = this.div.querySelectorAll(
      ".context-menu-item:not(.close-menu), .context-submenu"
    );
    dynamicItems.forEach((item) => item.remove());
    this.items = [];
    this.div.innerHTML = "";
  }

  /**
   * Unified color picker menu item.
   * @param label Display label for the menu item
   * @param currentColor The current color value
   * @param optionPath The dot-separated path to the option
   * @param optionTarget The chart or series to apply the color to
   */
  private addColorPickerMenuItem(
    label: string,
    currentColor: string | null,
    optionPath: string,
    optionTarget: IChartApi | ISeriesApiExtended | any
  ): HTMLElement {
    const menuItem = document.createElement("span");
    menuItem.classList.add("context-menu-item");
    menuItem.innerText = label;

    this.div.appendChild(menuItem);

    const applyColor = (newColor: string) => {
      const options = buildOptions(optionPath, newColor);
      optionTarget.applyOptions(options);
      console.log(`Updated ${optionPath} to ${newColor}`);
      // If optionTarget is a series and the option is color-based, update LegendSeries colors
      const isSeries = (target: any): target is ISeriesApi<any> => {
        return (
          typeof target === "object" &&
          target !== null &&
          // Some property check to confirm it's ISeriesApiExtended
          typeof target.applyOptions === "function" &&
          typeof target.dataByIndex === "function"
        );
      };

      if (
        isSeries(optionTarget) &&
        ["color", "lineColor", "upColor", "downColor"].includes(optionPath)
      ) {
        // Attempt to find the legend item in the legend _lines array
        const legendItem = this.handler.legend._lines.find(
          (item) => item.series === optionTarget
        );

        if (legendItem) {
          // Map the relevant color to the correct index
          // color, lineColor, upColor => index 0
          // downColor => index 1
          if (optionPath === "downColor") {
            legendItem.colors[1] = newColor;
            console.log(`Legend down color updated to: ${newColor}`);
          } else {
            legendItem.colors[0] = newColor;
            console.log(`Legend up/main color updated to: ${newColor}`);
          }
        }
      }
    };

    menuItem.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      if (!this.colorPicker) {
        this.colorPicker = new seriesColorPicker(
          currentColor ?? "#000000",
          applyColor
        );
      }
      this.colorPicker.openMenu(event, 225, applyColor);
    });

    return menuItem;
  }

  // Class-level arrays to store current options for width and style.
  private currentWidthOptions: {
    name: keyof (LineSeriesOptions & BarSeriesOptions & AreaSeriesOptions);
    label: string;
    min?: number;
    max?: number;
    value: number;
  }[] = [];

  private currentStyleOptions: {
    name: keyof (LineSeriesOptions & BarSeriesOptions & AreaSeriesOptions);
    label: string;
    value: string | number;
    options?: string[];
  }[] = [];

  /**
   * Populates the clone series submenu.
   *
   * @param series - The original series to clone.
   * @param event - The mouse event triggering the context menu.
   */

  public populateSeriesMenu(
    series: ISeriesApiExtended,
    event: MouseEvent
  ): void {
    // Type guard to check if series is extended
    const _series = ensureExtendedSeries(series, this.handler.legend);

    // Now `series` is guaranteed to be extended
    const seriesOptions = series.options() as Partial<
      LineSeriesOptions &
        BarSeriesOptions &
        AreaSeriesOptions &
        CandlestickSeriesOptions &
        ohlcSeriesOptions &
        SeriesOptionsExtended
    >;

    if (!seriesOptions) {
      console.warn("No options found for the selected series.");
      return;
    }

    this.div.innerHTML = "";

    const colorOptions: { label: string; value: string }[] = [];
    const visibilityOptions: { label: string; value: boolean }[] = [];
    const otherOptions: { label: string; value: any }[] = [];

    // Temporary arrays before assigning to class-level variables
    const tempWidthOptions: {
      name: keyof (LineSeriesOptions & BarSeriesOptions & AreaSeriesOptions);
      label: string;
      value: number;
      min?: number;
      max?: number;
      step?: number;
    }[] = [];

    const tempStyleOptions: {
      name: keyof (LineSeriesOptions & BarSeriesOptions & AreaSeriesOptions);
      label: string;
      value: string | number;
      options?: string[];
    }[] = [];

    for (const optionName of Object.keys(seriesOptions) as Array<
      keyof (LineSeriesOptions & BarSeriesOptions & AreaSeriesOptions)
    >) {
      const optionValue = seriesOptions[optionName];
      if (this.shouldSkipOption(optionName)) continue;
      if ((optionName as string).toLowerCase().includes("base")) continue;

      const lowerOptionName = camelToTitle(optionName).toLowerCase();
      const isWidthOption =
        lowerOptionName.includes("width") ||
        lowerOptionName === "radius" ||
        lowerOptionName.includes("radius");
      if (lowerOptionName.includes("color")) {
        // Color options
        if (typeof optionValue === "string") {
          colorOptions.push({ label: optionName, value: optionValue });
        } else {
          console.warn(
            `Expected string value for color option "${optionName}".`
          );
        }
      } else if (isWidthOption) {
        if (typeof optionValue === "number") {
          let minVal = 1;
          let maxVal = 10;
          let step = 1;

          // If this property is specifically "radius", make it 0..1
          if (lowerOptionName.includes("radius")) {
            minVal = 0;
            maxVal = 1;
            step = 0.1;
          }

          // Add it to your "width" options array with the specialized range
          tempWidthOptions.push({
            name: optionName,
            label: optionName,
            value: optionValue,
            min: minVal,
            max: maxVal,
            step: step,
          });
        }
      } else if (
        lowerOptionName.includes("visible") ||
        lowerOptionName.includes("visibility")
      ) {
        // Visibility options
        if (typeof optionValue === "boolean") {
          visibilityOptions.push({ label: optionName, value: optionValue });
        } else {
          console.warn(
            `Expected boolean value for visibility option "${optionName}".`
          );
        }
      } else if (optionName === "lineType") {
        // lineType is a style option
        // LineType: Simple=0, WithSteps=1
        const possibleLineTypes = this.getPredefinedOptions(
          camelToTitle(optionName)
        )!;
        tempStyleOptions.push({
          name: optionName,
          label: optionName,
          value: optionValue as string,
          options: possibleLineTypes,
        });
      } else if (optionName === "crosshairMarkerRadius") {
        // crosshairMarkerRadius should appear under Width Options
        if (typeof optionValue === "number") {
          tempWidthOptions.push({
            name: optionName,
            label: optionName,
            value: optionValue,
            min: 1,
            max: 50,
          });
        } else {
          console.warn(
            `Expected number value for crosshairMarkerRadius option "${optionName}".`
          );
        }
      } else if (lowerOptionName.includes("style")) {
        // Style options (e.g. lineStyle)
        if (
          typeof optionValue === "string" ||
          Object.values(LineStyle).includes(optionValue as LineStyle) ||
          typeof optionValue === "number"
        ) {
          const possibleStyles = [
            "Solid",
            "Dotted",
            "Dashed",
            "Large Dashed",
            "Sparse Dotted",
          ];
          tempStyleOptions.push({
            name: optionName,
            label: optionName,
            value: optionValue as string,
            options: possibleStyles,
          });
        }
      } // Example: handle shape if "shape" is in the name
      else if (lowerOptionName.includes("shape")) {
        // If we confirm it's a recognized CandleShape
        if (isCandleShape(optionValue)) {
          const predefinedShapes = [
            "Rectangle",
            "Rounded",
            "Ellipse",
            "Arrow",
            "3d",
            "Polygon",
            "Bar",
          ];
          if (predefinedShapes) {
            tempStyleOptions.push({
              name: optionName,
              label: optionName,
              value: optionValue as CandleShape, // This is guaranteed CandleShape now
              options: predefinedShapes,
            });
          }
        }
      } else {
        // Other options go directly to otherOptions
        otherOptions.push({ label: optionName, value: optionValue });
      }
    }

    // Assign the temp arrays to class-level arrays for use in submenus
    this.currentWidthOptions = tempWidthOptions;
    this.currentStyleOptions = tempStyleOptions;
    this.addTextInput(
      "Title",
      series.options().title || "", // Default to empty string if no title exists
      (newValue: string) => {
        const options = { title: newValue };
        // Remove old entry and re-add with new title
        if (this.handler.seriesMap.has(series.options().title)) {
          this.handler.seriesMap.delete(series.options().title);
        }
        this.handler.seriesMap.set(newValue, series);
        console.log(`Updated seriesMap label to: ${newValue}`);

        // Update the legend title
        const legendItem = this.handler.legend._lines.find(
          (item) => item.series === series
        );
        if (legendItem && legendItem.series === series) {
          legendItem.name = newValue;
          console.log(`Updated legend title to: ${newValue}`);
        }
        series.applyOptions(options);
        console.log(`Updated title to: ${newValue}`);
      }
    );

    // Retrieve current pane index of the series and the array of existing panes.
    const currentPaneIndex = series.getPane().paneIndex();
    const panes = this.handler.chart.panes();

    // Determine the current value (label) for the hybrid input.
    const currentValue = `Pane ${currentPaneIndex}`;

    // Define the default action:
    // If the series is in the main pane (pane 0), move it to the next existing pane (if available)
    // or create a new pane if there isn’t one.
    // Otherwise (if the series is on any other pane), move it back to the main pane (pane 0).
    const defaultAction = () => {
      if (currentPaneIndex === 0) {
        if (panes.length > 1) {
          series.moveToPane(1);
          console.log(
            `Default: Moved series from pane ${currentPaneIndex} to pane 1.`
          );
        } else {
          series.moveToPane(panes.length); // creates a new pane
          console.log(
            `Default: Moved series from pane ${currentPaneIndex} to a new pane at index ${panes.length}.`
          );
        }
      } else {
        series.moveToPane(0);
        console.log(
          `Default: Moved series from pane ${currentPaneIndex} back to main pane (0).`
        );
      }
    };

    // Build the list of options:
    // For each existing pane, add an option labeled "Pane 0", "Pane 1", etc.
    // Then add an extra option for a "New Pane".
    const options: { name: string; action: () => void }[] = [];
    for (let i = 0; i < panes.length; i++) {
      options.push({
        name: `Pane ${i}`,
        action: () => {
          series.moveToPane(i);
          console.log(`Moved series to existing pane ${i}.`);
        },
      });
    }
    options.push({
      name: "New Pane",
      action: () => {
        series.moveToPane(panes.length);
        console.log(`Moved series to a new pane at index ${panes.length}.`);
      },
    });

    // Create the hybrid input using your addMenuInput helper.
    // This will render a dropdown that shows all options and executes the corresponding action on change.
    this.addMenuInput(this.div, {
      type: "hybrid",
      label: "Move series to pane",
      sublabel: currentValue,
      value: currentValue,
      onChange: (newValue: string) => {
        // When the user selects an option, look it up in the options array and execute its action.
        const selectedOption = options.find((opt) => opt.name === newValue);
        if (selectedOption) {
          selectedOption.action();
        }
      },
      hybridConfig: {
        defaultAction: defaultAction,
        options: options.map((opt) => ({
          name: opt.name,
          action: opt.action,
        })),
      },
    });

    // Inside populateSeriesMenu (already in your code above)
    this.addMenuItem(
      "Clone Series ▸",
      () => {
        this.populateCloneSeriesMenu(series, event);
      },
      false,
      true
    );

    // Add main menu items only if these arrays have content
    if (visibilityOptions.length > 0) {
      this.addMenuItem(
        "Visibility Options ▸",
        () => {
          this.populateVisibilityMenu(event, series);
        },
        false,
        true
      );
    }

    if (this.currentStyleOptions.length > 0) {
      this.addMenuItem(
        "Style Options ▸",
        () => {
          this.populateStyleMenu(event, series);
        },
        false,
        true
      );
    }

    if (this.currentWidthOptions.length > 0) {
      this.addMenuItem(
        "Width Options ▸",
        () => {
          this.populateWidthMenu(event, series);
        },
        false,
        true
      );
    }

    if (colorOptions.length > 0) {
      this.addMenuItem(
        "Color Options ▸",
        () => {
          this.populateColorOptionsMenu(colorOptions, series, event);
        },
        false,
        true
      );
    }

    // **** New block: add numeric inputs for volume-based or chandelier aggregation ****
    //let aggregatorOptions = series.options();
    //if ( "volumeCandles" in aggregatorOptions && "volumeMALength" in aggregatorOptions &&
    //  "volumeMultiplier" in aggregatorOptions &&
    //  "chandelierSize" in aggregatorOptions &&
    //  aggregatorOptions?.volumeCandles !== undefined) {

    //const aggregatorOptions = series.options() as  OhlcSeriesOptions ;

    // if ('volumeCandles' in aggregatorOptions && "volumeMALength" in aggregatorOptions &&
    //   "volumeMultiplier" in aggregatorOptions) {

    //  // Add a checkbox for toggling volumeCandles.
    //  // When toggled, the series options are updated and the menu is repopulated.
    //  this.addCheckbox("Volume Candles", (aggregatorOptions as OhlcSeriesOptions).volumeCandles ?? false, (newValue: boolean) => {
    //    const options = { volumeCandles: newValue };
    //    series.applyOptions(options as Partial<OhlcSeriesOptions>);
    //    console.log(`Updated volumeCandles to ${newValue}`);
    //    // Repopulate the series menu with the updated options.
    //    this.populateSeriesMenu(series, event);
    //  });
    //  if ((series.options() as ohlcSeriesOptions).volumeCandles) {
    //  // Volume candles are enabled: add number inputs for the volume moving average length and multiplier.
    //  this.addNumberInput(
    //    "Volume MA Length",
    //    (aggregatorOptions as OhlcSeriesOptions).volumeMALength ?? 20,
    //    (newValue: number) => {
    //      const options = { volumeMALength: newValue };
    //      series.applyOptions(options as Partial<OhlcSeriesOptions>);
    //      console.log(`Updated Volume MA Length to ${newValue}`);
    //      // Optionally repopulate the menu dynamically if needed.
    //    },
    //    1,
    //    100,
    //    1
    //  );
    //  this.addNumberInput(
    //    "Volume Multiplier",
    //    (aggregatorOptions as OhlcSeriesOptions).volumeMultiplier ?? 1.0,
    //    (newValue: number) => {
    //      const options = { volumeMultiplier: newValue };
    //      series.applyOptions(options as Partial<OhlcSeriesOptions>);
    //      console.log(`Updated Volume Multiplier to ${newValue}`);
    //      // Optionally repopulate the menu dynamically if needed.
    //    },
    //    0.1,
    //    10,
    //    0.1
    //  );
    //}else {
    //  // Volume candles are disabled: add a number input for chandelier size.

    if (
      series instanceof ohlcSeries &&
      (series.options() as OhlcSeriesOptions).chandelierSize
    ) {
      // series is an OhlcSeries and has a defined chandelierSize option.
      // Your code here...

      this.addNumberInput(
        "Chandelier Size",
        (series.options() as OhlcSeriesOptions).chandelierSize ?? 1,
        (newValue: number) => {
          const options = { chandelierSize: newValue };
          series.applyOptions(options as Partial<OhlcSeriesOptions>);
          console.log(`Updated Chandelier Size to ${newValue}`);
          // Optionally repopulate the menu dynamically if needed.
        },
        1,
        100,
        1
      );
    }
    //
    //
    // *************************************************************************
    // Add other options dynamically
    otherOptions.forEach((option) => {
      const optionLabel = camelToTitle(option.label); // Human-readable label

      // Skip if explicitly marked as skippable
      if (this.constraints[option.label]?.skip) {
        return;
      }

      if (typeof option.value === "boolean") {
        // Add a menu item with a checkbox for boolean options
        this.addMenuItem(
          `${optionLabel} ▸`,
          () => {
            this.div.innerHTML = ""; // Clear existing menu items

            const newValue = !option.value; // Toggle the value
            const options = buildOptions(option.label, newValue);
            series.applyOptions(options);
            console.log(`Toggled ${option.label} to ${newValue}`);

            // Repopulate the menu dynamically
          },
          option.value // The checkbox state matches the current value
        );
      } else if (typeof option.value === "string") {
        // Add a submenu or text input for string options
        const predefinedOptions = this.getPredefinedOptions(option.label);

        if (predefinedOptions && predefinedOptions.length > 0) {
          this.addMenuItem(
            `${optionLabel} ▸`,
            () => {
              this.div.innerHTML = ""; // Clear existing menu items

              this.addSelectInput(
                optionLabel,
                option.value,
                predefinedOptions,
                (newValue: string) => {
                  const options = buildOptions(option.label, newValue);
                  series.applyOptions(options);
                  console.log(`Updated ${option.label} to ${newValue}`);

                  // Repopulate the menu dynamically
                }
              );
            },
            false,
            true // Mark as a submenu
          );
        } else {
          this.addMenuItem(
            `${optionLabel} ▸`,
            () => {
              this.div.innerHTML = ""; // Clear existing menu items

              this.addTextInput(
                optionLabel,
                option.value,
                (newValue: string) => {
                  const options = buildOptions(option.label, newValue);
                  series.applyOptions(options);
                  console.log(`Updated ${option.label} to ${newValue}`);

                  // Repopulate the menu dynamically
                }
              );
            },
            false,
            true // Mark as a submenu
          );
        }
      } else if (typeof option.value === "number") {
        // Add a submenu or number input for numeric options
        const min = this.constraints[option.label]?.min;
        const max = this.constraints[option.label]?.max;

        this.addMenuItem(
          `${optionLabel} ▸`,
          () => {
            this.div.innerHTML = ""; // Clear existing menu items

            this.addNumberInput(
              optionLabel,
              option.value,
              (newValue: number) => {
                const options = buildOptions(option.label, newValue);
                series.applyOptions(options);
                console.log(`Updated ${option.label} to ${newValue}`);

                // Repopulate the menu dynamically
              },
              min,
              max
            );
          },
          false,
          true // Mark as a submenu
        );
      } else {
        return; // Skip unsupported data types
      }
    });

    // Add "Price Scale Options" Menu
    this.addMenuItem(
      "Price Scale Options ▸",
      () => {
        this.populatePriceScaleMenu(
          event,
          (series.options().priceScaleId ?? "right") as priceScale,
          series
        );
      },
      false,
      true
    );

    // Add the "Primitives" submenu
    this.addMenuItem(
      "Primitives ▸",
      () => {
        this.populatePrimitivesMenu(_series, event);
      },
      false,
      true
    );

    // 2) If all items are OHLC, add a submenu item for your “Indicators”
    this.addMenuItem(
      "Indicators ▸",
      () => {
        this.populateIndicatorMenu(
          series as ISeriesApi<"Candlestick" | "Bar">,
          event
        );
      },
      false, // do not hide the entire menu automatically
      true // indicates a submenu arrow “▸”
    );

    // Check if this series is part of an indicator
    if (isISeriesIndicator(series)) {
      const indicatorSeries = series as ISeriesIndicator;

      this.addMenuItem(
        `Configure ${indicatorSeries.indicator.name}`,
        () => {
          this.configureIndicatorParams(
            indicatorSeries,
            event,
            indicatorSeries.figureCount
          );
        },
        false
      );
    }
    // Add remaining existing menu items
    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  private populateDrawingMenu(event: MouseEvent, drawing: Drawing): void {
    this.div.innerHTML = ""; // Clear existing menu items
    if (!this.drawingTool) {
      this.drawingTool = new DrawingTool(
        this.handler.chart,
        this.handler._seriesList[0]
      );
    }
    // Add drawing-specific menu items
    for (const optionName of Object.keys(drawing._options)) {
      let subMenu;
      if (optionName.toLowerCase().includes("color")) {
        subMenu = new ColorPicker(
          this.saveDrawings!,
          optionName as keyof DrawingOptions
        );
      } else if (optionName === "lineStyle") {
        subMenu = new StylePicker(this.saveDrawings!);
      } else {
        continue;
      }

      const onClick = (rect: DOMRect) => subMenu.openMenu(rect);
      this.menuItem(camelToTitle(optionName), onClick, () => {
        document.removeEventListener("click", subMenu.closeMenu);
        subMenu._div.style.display = "none";
      });
    }

    // 1) If this drawing is a PitchFork, add a select input for variant.
    if (drawing._type === "PitchFork") {
      // For clarity, cast or check if your PitchFork uses drawing._options.variant
      const currentVariant =
        (drawing._options as PitchForkOptions).variant || "standard";
      const allowedVariants = [
        "standard",
        "schiff",
        "modifiedSchiff",
        "inside",
      ];

      this.addSelectInput(
        "Pitchfork Variant",
        currentVariant,
        allowedVariants,
        (newValue: string) => {
          (drawing._options as PitchForkOptions).variant = newValue as
            | "standard"
            | "schiff"
            | "modifiedSchiff"
            | "inside"
            | undefined;
          if (this.saveDrawings) {
            this.saveDrawings();
          }
        }
      );
      // Add a number input for "value".
      this.addNumberInput(
        "Length",
        (drawing._options as PitchForkOptions).length,
        (newValue: number) => {
          (drawing._options as PitchForkOptions).length = newValue;
          if (this.saveDrawings) {
            this.saveDrawings();
          }
        },
        0, // minimum value (adjust as needed)
        1000, // maximum value (adjust as needed)
        0.1 // step (adjust as needed)
      );

      // Add a menu item to populate the detailed PitchFork menu.
      this.addMenuItem(
        "Fork Line Options ▸",
        () => {
          this.populateForkLineMainMenu(event, drawing);
        },
        false,
        true
      );
    }

    if (drawing.points?.length >= 2 && drawing.points[0] && drawing.points[1]) {
      let multiPointDrawing;
      if (drawing.points?.length > 2) {
        multiPointDrawing = drawing as ThreePointDrawing;
      } else {
        multiPointDrawing = drawing as TwoPointDrawing;
      }

      if (multiPointDrawing.linkedObjects?.length) {
        multiPointDrawing.linkedObjects.forEach((object: PluginBase) => {
          if (object instanceof TrendTrace) {
            this.addMenuItem(
              `${object.title} Options`,
              () => {
                this.populateTrendTraceMenu(event, object as TrendTrace);
              },
              false,
              true
            );
          } else if (object instanceof VolumeProfile) {
            this.addMenuItem(
              `Volume Profile Options`,
              () => {
                this.populateVolumeProfileMenu(event, object as VolumeProfile);
              },
              false,
              true
            );
          }
        });
      }

      // Always add the creation menu items for Trend Trace and Volume Profile
      this.addMenuItem(
        "Trend Trace ▸",
        () => {
          this._createTrendTrace(event, multiPointDrawing);
        },
        false,
        true
      );

      this.addMenuItem(
        "Volume Profile ▸",
        () => {
          this._createVolumeProfile(multiPointDrawing);
        },
        false,
        true
      );
    }

    const onClickDelete = () => this.drawingTool!.delete(drawing);
    this.separator();
    this.menuItem("Delete Drawing", onClickDelete);

    // Optionally, add a back button or main menu option.
    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false,
      false
    );

    this.showMenu(event);
  }
  private populateChartMenu(event: MouseEvent): void {
    this.div.innerHTML = "";
    console.log(`Displaying Menu Options: Chart`);
    this.addResetViewOption();

    this.addMenuItem(
      " ~ Series List",
      () => {
        this.populateSeriesListMenu(
          event,
          false,
          (destinationSeries: ISeriesApiExtended) => {
            this.populateSeriesMenu(destinationSeries, event);
          }
        );
      },
      false,
      true
    );

    // Layout menu
    this.addMenuItem(
      "⌯ Layout Options        ",
      () => this.populateLayoutMenu(event),
      false,
      true
    );
    this.addMenuItem(
      "⌗ Grid Options          ",
      () => this.populateGridMenu(event),
      false,
      true
    );
    this.addMenuItem(
      "⊹ Crosshair Options     ",
      () => this.populateCrosshairOptionsMenu(event),
      false,
      true
    );
    this.addMenuItem(
      "ⴵ Time Scale Options    ",
      () => this.populateTimeScaleMenu(event),
      false,
      true
    );
    this.addMenuItem(
      "$ Price Scale Options   ",
      () => this.populatePriceScaleMenu(event, "right"),
      false,
      true
    );
    this.addMenuInput(this.div, {
      type: "hybrid",
      label: "Display Volume Profile",
      sublabel: "Settings",
      hybridConfig: {
        defaultAction: () => {
          if (!this.volumeProfile) {
            // Attach VolumeProfile
            this.volumeProfile = new VolumeProfile(
              this.handler,
              defaultVolumeProfileOptions
            );
            this.handler.series.attachPrimitive(
              this.volumeProfile,
              "Visible Range Volume Profile",
              false,
              true
            );
            console.log("[ChartMenu] Attached Volume Profile.");
          } else {
            // Detach VolumeProfile
            this.handler.series.detachPrimitive(this.volumeProfile);
            this.volumeProfile = null;
            console.log("[ChartMenu] Detached Volume Profile.");
          }
        },
        options: [
          {
            name: "Options",
            action: () => {
              if (this.volumeProfile) {
                this.populateVolumeProfileMenu(event, this.volumeProfile);
              } else {
              }
            },
          },
        ],
      },
    });

    this.showMenu(event);
  }
  private populateLayoutMenu(event: MouseEvent): void {
    // Clear the menu
    this.div.innerHTML = "";

    // Text Color Option
    const textColorOption = {
      name: "Text Color",
      valuePath: "layout.textColor",
    };
    const initialTextColor =
      (this.getCurrentOptionValue(textColorOption.valuePath) as string) ||
      "#000000";

    this.addColorPickerMenuItem(
      camelToTitle(textColorOption.name),
      initialTextColor,
      textColorOption.valuePath,
      this.handler.chart
    );

    // Background Color Options Based on Current Background Type
    const currentBackground = this.handler.chart.options().layout?.background;

    if (isSolidColor(currentBackground)) {
      // Solid Background Color
      this.addColorPickerMenuItem(
        "Background Color",
        currentBackground.color || "#FFFFFF",
        "layout.background.color",
        this.handler.chart
      );
    } else if (isVerticalGradientColor(currentBackground)) {
      // Gradient Background Colors
      this.addColorPickerMenuItem(
        "Top Color",
        currentBackground.topColor || "rgba(255,0,0,0.33)",
        "layout.background.topColor",
        this.handler.chart
      );
      this.addColorPickerMenuItem(
        "Bottom Color",
        currentBackground.bottomColor || "rgba(0,255,0,0.33)",
        "layout.background.bottomColor",
        this.handler.chart
      );
    } else {
      console.warn("Unknown background type; no color options displayed.");
    }

    // Switch Background Type Option
    this.addMenuItem(
      "Switch Background Type",
      () => {
        this.toggleBackgroundType(event);
      },
      false,
      true
    );

    // Back to Main Menu Option
    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false,
      false
    );

    // Display the updated menu
    this.showMenu(event);
  }

  private toggleBackgroundType(event: MouseEvent): void {
    const currentBackground = this.handler.chart.options().layout?.background;
    let updatedBackground: Background;

    // Toggle between Solid and Vertical Gradient
    if (isSolidColor(currentBackground)) {
      updatedBackground = {
        type: ColorType.VerticalGradient,
        topColor: "rgba(255,0,0,0.2)",
        bottomColor: "rgba(0,255,0,0.2)",
      };
    } else {
      updatedBackground = {
        type: ColorType.Solid,
        color: "#000000",
      };
    }

    // Apply the updated background type
    this.handler.chart.applyOptions({
      layout: { background: updatedBackground },
    });

    // Repopulate the Layout Menu with the new background type's options
    this.populateLayoutMenu(event);
  }

  private populateWidthMenu(
    event: MouseEvent,
    series: ISeriesApiExtended
  ): void {
    this.div.innerHTML = ""; // Clear current menu

    // Use the stored currentWidthOptions array
    this.currentWidthOptions.forEach((option) => {
      if (typeof option.value === "number") {
        this.addNumberInput(
          camelToTitle(option.label),
          option.value,
          (newValue: number) => {
            const options = buildOptions(option.name, newValue);
            series.applyOptions(options);
            console.log(`Updated ${option.label} to ${newValue}`);
          },
          option.min,
          option.max
        );
      }
    });

    this.addMenuItem(
      "⤝ Back to Series Options",
      () => {
        this.populateSeriesMenu(series, event);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  private populatePrimitivesMenu(
    series: ISeriesApiExtended,
    event: MouseEvent
  ): void {
    this.div.innerHTML = "";
    console.log(`Showing Primitive Menu `);

    const primitives = series.primitives;
    this.addMenuItem(
      "Fill Area Between",
      () => {
        this.startFillAreaBetween(event, series); // Define the method below
      },
      false,
      false
    );

    // Access the primitives

    // Debugging output
    console.log("Primitives:", primitives);

    // Add "Customize Fill Area" option if `FillArea` is present
    const hasFillArea = primitives?.FillArea ?? primitives?.pt;

    if (primitives["FillArea"]) {
      this.addMenuItem(
        "Customize Fill Area",
        () => {
          this.customizeFillAreaOptions(event, hasFillArea);
        },
        false,
        true
      );
    }

    this.addMenuItem(
      "Create TrendTrace",
      () => {
        this._createTrendTrace(event, this.recentDrawing as TwoPointDrawing);
      },
      false,
      false
    );

    // Debugging output
    console.log("Primitives:", primitives);

    // Add "Customize TrendTrace" option if `TrendTrace` is already present

    if (primitives["TrendTrace"]) {
      this.addMenuItem(
        "Customize TrendTrace",
        () => {
          this.populateTrendTraceMenu(event, primitives["TrendTrace"]);
        },
        false,
        true
      );
    }
    //this.addMenuItem(
    //  "Stop Loss / Take Profit ▸",
    //  () => {
    //      // If not attached yet, attach it
    //      if (!primitives["StopLossTakeProfit"]) {
    //          const sltp = new StopLossTakeProfit(
    //              this.handler.chart,
    //              series,
    //              {
    //                  color: '#444',
    //                  hoverColor: '#888',
    //                  backgroundColorStop: 'rgba(255,0,0,0.3)',
    //                  backgroundColorTarget: 'rgba(0,255,0,0.3)',
    //                  extendRightBars: 15,
    //              }
    //          );
    //          primitives["StopLossTakeProfit"] = sltp;
    //          console.log("StopLossTakeProfit attached");
    //      } else {
    //          console.log("StopLossTakeProfit already exists, customizing...");
    //          // If you want to open a submenu to customize,
    //          // e.g., setStopLoss, setTakeProfit, etc.
    //      }
    //  },
    //  false,
    //  true
    //);//

    // Add a Back option
    this.addMenuItem(
      "⤝ Back",
      () => {
        this.populateSeriesMenu(series, event);
      },
      false,
      false
    );

    this.showMenu(event);
  }
  private populateStyleMenu(
    event: MouseEvent,
    series: ISeriesApiExtended
  ): void {
    this.div.innerHTML = ""; // Clear the current menu

    this.currentStyleOptions.forEach((option) => {
      const predefinedOptions = this.getPredefinedOptions(option.name);
      if (predefinedOptions) {
        this.addSelectInput(
          camelToTitle(option.name),
          option.value.toString(),
          predefinedOptions,
          (newValue: string) => {
            let finalValue: unknown = newValue;

            // If the option name indicates it's a line style, map string => numeric
            if (option.name.toLowerCase().includes("style")) {
              const lineStyleMap: Record<string, number> = {
                Solid: 0,
                Dotted: 1,
                Dashed: 2,
                "Large Dashed": 3,
                "Sparse Dotted": 4,
              };
              finalValue = lineStyleMap[newValue] ?? 0; // fallback to Solid (0)
            }
            // If the option name indicates it's a line type, map string => numeric
            else if (option.name.toLowerCase().includes("linetype")) {
              const lineTypeMap: Record<string, number> = {
                Simple: 0,
                WithSteps: 1,
                Curved: 2,
              };
              finalValue = lineTypeMap[newValue] ?? 0; // fallback to Simple (0)
            }

            // Build the updated options object
            const updatedOptions = buildOptions(option.name, finalValue);
            series.applyOptions(updatedOptions);
            console.log(
              `Updated ${option.name} to "${newValue}" =>`,
              finalValue
            );

            // --- Update the Legend Symbol if it's a lineStyle change on a Line series ---
            if (
              option.name.toLowerCase().includes("style") &&
              series.seriesType() === "Line"
            ) {
              // Convert the numeric finalValue into a symbol
              const lineStyleNumeric = finalValue as number;
              const symbol = (() => {
                switch (lineStyleNumeric) {
                  case 0:
                    return "―"; // Solid
                  case 1:
                    return "··"; // Dotted
                  case 2:
                    return "--"; // Dashed
                  case 3:
                    return "- -"; // Large Dashed
                  case 4:
                    return "· ·"; // Sparse Dotted
                  default:
                    return "~"; // Fallback
                }
              })();

              // Find the corresponding legend item in the legend._lines array
              const legendItem = this.handler.legend._lines.find(
                (item) => item.series === series
              );
              if (legendItem) {
                legendItem.legendSymbol = [symbol];
                console.log(
                  `Updated legend symbol for lineStyle(${lineStyleNumeric}) to: ${symbol}`
                );
              }
            }
          }
        );
      } else {
        console.warn(`No predefined options found for "${option.name}".`);
      }
    });

    // Add a Back option
    this.addMenuItem(
      "⤝ Back",
      () => {
        this.populateSeriesMenu(series, event);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  private populateCloneSeriesMenu(
    series: ISeriesApiExtended,
    event: MouseEvent
  ): void {
    this.div.innerHTML = "";

    // Fetch the current data from the series
    const data = series.data();
    // Basic clone targets for any data
    const cloneOptions: SupportedSeriesType[] = ["Line", "Histogram", "Area"];

    if (data && data.length > 0) {
      // Check if any bar is recognized as OHLC
      const hasOHLC = data.some((bar) => isOHLCData(bar));
      // If so, we push "Bar" and "Candlestick" to the menu
      if (hasOHLC) {
        cloneOptions.push("Bar", "Candlestick", "Ohlc");
      }
    }

    // Generate the menu items for each clone option
    cloneOptions.forEach((type) => {
      this.addMenuItem(
        `Clone as ${type}`,
        () => {
          const clonedSeries = cloneSeriesAsType(
            series,
            this.handler,
            type,
            {}
          );
          if (clonedSeries) {
            console.log(`Cloned series as ${type}:`, clonedSeries);
          } else {
            console.warn(`Failed to clone as ${type}.`);
          }
        },
        false
      );
    });

    // Back to Series Options
    this.addMenuItem(
      "⤝ Series Options",
      () => {
        this.populateSeriesMenu(series, event);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  private addTextInput(
    label: string,
    defaultValue: string,
    onChange: (value: string) => void
  ): HTMLElement {
    const container = document.createElement("div");
    container.classList.add("context-menu-item");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";

    const labelElem = document.createElement("label");
    labelElem.innerText = label;
    labelElem.htmlFor = `${label.toLowerCase()}-input`;
    labelElem.style.marginRight = "8px";
    labelElem.style.flex = "1"; // Ensure the label takes up available space
    container.appendChild(labelElem);

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.id = `${label.toLowerCase()}-input`;
    input.style.flex = "0 0 100px"; // Fixed width for input
    input.style.marginLeft = "auto"; // Right-align
    input.style.backgroundColor = "#2b2b2b"; // Darker gray background
    input.style.color = "#fff"; // White text color for contrast
    input.style.border = "1px solid #444"; // Subtle border
    input.style.borderRadius = "4px";
    input.style.cursor = "pointer";

    input.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      onChange(target.value);
    });

    container.appendChild(input);

    this.div.appendChild(container);

    return container;
  }

  private populateColorOptionsMenu(
    colorOptions: { label: string; value: string }[],
    series: ISeriesApiExtended,
    event: MouseEvent
  ): void {
    this.div.innerHTML = "";

    colorOptions.forEach((option) => {
      this.addColorPickerMenuItem(
        camelToTitle(option.label),
        option.value,
        option.label,
        series
      );
    });

    this.addMenuItem(
      "⤝ Back to Series Options",
      () => {
        this.populateSeriesMenu(series, event);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  private populateVisibilityMenu(
    event: MouseEvent,
    series: ISeriesApiExtended
  ): void {
    this.div.innerHTML = "";

    const seriesOptions = series.options() as Partial<
      LineSeriesOptions & BarSeriesOptions & AreaSeriesOptions
    >;

    const visibilityOptionNames: Array<
      keyof (LineSeriesOptions & BarSeriesOptions & AreaSeriesOptions)
    > = ["visible", "crosshairMarkerVisible", "priceLineVisible"];

    visibilityOptionNames.forEach((optionName) => {
      const optionValue = seriesOptions[optionName];
      if (typeof optionValue === "boolean") {
        this.addCheckbox(
          camelToTitle(optionName),
          optionValue,

          (newValue: boolean) => {
            const options = buildOptions(optionName, newValue);
            series.applyOptions(options);
            console.log(`Toggled ${optionName} to ${newValue}`);
          }
        );
      }
    });

    this.addMenuItem(
      "⤝ Back to Series Options",
      () => {
        this.populateSeriesMenu(series, event);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  private populateBackgroundTypeMenu(event: MouseEvent): void {
    this.div.innerHTML = "";

    const backgroundOptions = [
      {
        text: "Solid",
        action: () => this.setBackgroundType(event, ColorType.Solid),
      },
      {
        text: "Vertical Gradient",
        action: () => this.setBackgroundType(event, ColorType.VerticalGradient),
      },
    ];

    backgroundOptions.forEach((option) => {
      // Use shouldHide = false if you want to move to another menu without closing
      this.addMenuItem(
        option.text,
        option.action,
        false, // don't hide immediately if you want subsequent menus
        false,
        1
      );
    });

    // Back to Chart Menu
    this.addMenuItem(
      "⤝ Chart Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    this.showMenu(event);
  }

  private populateGradientBackgroundMenuInline(
    event: MouseEvent,
    gradientBackground: VerticalGradientColor
  ): void {
    this.div.innerHTML = "";

    this.addColorPickerMenuItem(
      camelToTitle("Top Color"),
      gradientBackground.topColor,
      "layout.background.topColor",
      this.handler.chart
    );

    this.addColorPickerMenuItem(
      camelToTitle("Bottom Color"),
      gradientBackground.bottomColor,
      "layout.background.bottomColor",
      this.handler.chart
    );

    // Back to Background Type Menu
    this.addMenuItem(
      "⤝ Background Type & Colors",
      () => {
        this.populateBackgroundTypeMenu(event);
      },
      false
    );

    this.showMenu(event);
  }

  private populateGridMenu(event: MouseEvent): void {
    this.div.innerHTML = ""; // Clear the menu

    // Configuration for grid options
    const gridOptions = [
      {
        name: "Vertical Line Color",
        type: "color",
        valuePath: "grid.vertLines.color",
        defaultValue: "#D6DCDE",
      },
      {
        name: "Horizontal Line Color",
        type: "color",
        valuePath: "grid.horzLines.color",
        defaultValue: "#D6DCDE",
      },
      {
        name: "Vertical Line Style",
        type: "select",
        valuePath: "grid.vertLines.style",
        options: ["Solid", "Dashed", "Dotted", "LargeDashed"],
        defaultValue: "Solid",
      },
      {
        name: "Horizontal Line Style",
        type: "select",
        valuePath: "grid.horzLines.style",
        options: ["Solid", "Dashed", "Dotted", "LargeDashed"],
        defaultValue: "Solid",
      },
      {
        name: "Show Vertical Lines",
        type: "boolean",
        valuePath: "grid.vertLines.visible",
        defaultValue: true,
      },
      {
        name: "Show Horizontal Lines",
        type: "boolean",
        valuePath: "grid.horzLines.visible",
        defaultValue: true,
      },
    ];

    // Iterate over the grid options and dynamically add inputs
    gridOptions.forEach((option) => {
      const currentValue =
        this.getCurrentOptionValue(option.valuePath) ?? option.defaultValue;

      if (option.type === "color") {
        this.addColorPickerMenuItem(
          camelToTitle(option.name),
          currentValue,
          option.valuePath,
          this.handler.chart
        );
      } else if (option.type === "select") {
        this.addSelectInput(
          camelToTitle(option.name),
          currentValue,
          option.options!,
          (newValue) => {
            const selectedIndex = option.options!.indexOf(newValue);
            const updatedOptions = buildOptions(
              option.valuePath!,
              selectedIndex
            );
            this.handler.chart.applyOptions(updatedOptions);
            console.log(`Updated ${option.name} to: ${newValue}`);
          }
        );
      } else if (option.type === "boolean") {
        this.addCheckbox(
          camelToTitle(option.name),
          currentValue,
          (newValue) => {
            const updatedOptions = buildOptions(option.valuePath!, newValue);
            this.handler.chart.applyOptions(updatedOptions);
            console.log(`Updated ${option.name} to: ${newValue}`);
          }
        );
      }
    });

    // Back to Main Menu
    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    this.showMenu(event); // Display the updated menu
  }

  private populateBackgroundMenu(event: MouseEvent): void {
    this.div.innerHTML = "";

    this.addMenuItem(
      "Type & Colors",
      () => {
        this.populateBackgroundTypeMenu(event);
      },
      false,
      true
    );

    this.addMenuItem(
      "Options",
      () => {
        this.populateBackgroundOptionsMenu(event);
      },
      false,
      true
    );

    this.addMenuItem(
      "⤝ Layout Options",
      () => {
        this.populateLayoutMenu(event);
      },
      false
    );

    this.showMenu(event);
  }

  private populateBackgroundOptionsMenu(event: MouseEvent): void {
    this.div.innerHTML = "";

    const backgroundOptions = [
      { name: "Background Color", valuePath: "layout.background.color" },
      { name: "Background Top Color", valuePath: "layout.background.topColor" },
      {
        name: "Background Bottom Color",
        valuePath: "layout.background.bottomColor",
      },
    ];

    backgroundOptions.forEach((option) => {
      const initialColor =
        (this.getCurrentOptionValue(option.valuePath) as string) || "#FFFFFF";
      this.addColorPickerMenuItem(
        camelToTitle(option.name),
        initialColor,
        option.valuePath,
        this.handler.chart
      );
    });

    // Back to Background Menu
    this.addMenuItem(
      "⤝ Background",
      () => {
        this.populateBackgroundMenu(event);
      },
      false
    );

    this.showMenu(event);
  }

  private populateSolidBackgroundMenuInline(
    event: MouseEvent,
    solidBackground: SolidColor
  ): void {
    this.div.innerHTML = "";

    this.addColorPickerMenuItem(
      camelToTitle("Background Color"),
      solidBackground.color,
      "layout.background.color",
      this.handler.chart
    );

    // Back to Type & Colors
    this.addMenuItem(
      "⤝ Type & Colors",
      () => {
        this.populateBackgroundTypeMenu(event);
      },
      false
    );

    this.showMenu(event);
  }

  private populateCrosshairOptionsMenu(event: MouseEvent): void {
    this.div.innerHTML = "";

    const crosshairOptions = [
      { name: "Line Color", valuePath: "crosshair.lineColor" },
      { name: "Vertical Line Color", valuePath: "crosshair.vertLine.color" },
      { name: "Horizontal Line Color", valuePath: "crosshair.horzLine.color" },
    ];

    crosshairOptions.forEach((option) => {
      const initialColor =
        (this.getCurrentOptionValue(option.valuePath) as string) || "#000000";
      this.addColorPickerMenuItem(
        camelToTitle(option.name),
        initialColor,
        option.valuePath,
        this.handler.chart
      );
    });

    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    this.showMenu(event);
  }

  private populateTimeScaleMenu(event: MouseEvent): void {
    this.div.innerHTML = ""; // Clear current menu

    // TimeScaleOptions configuration
    const timeScaleOptions = [
      {
        name: "Right Offset",
        type: "number",
        valuePath: "timeScale.rightOffset",
        min: 0,
        max: 100,
      },
      {
        name: "Bar Spacing",
        type: "number",
        valuePath: "timeScale.barSpacing",
        min: 1,
        max: 100,
      },
      {
        name: "Min Bar Spacing",
        type: "number",
        valuePath: "timeScale.minBarSpacing",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      {
        name: "Fix Left Edge",
        type: "boolean",
        valuePath: "timeScale.fixLeftEdge",
      },
      {
        name: "Fix Right Edge",
        type: "boolean",
        valuePath: "timeScale.fixRightEdge",
      },
      {
        name: "Lock Visible Range on Resize",
        type: "boolean",
        valuePath: "timeScale.lockVisibleTimeRangeOnResize",
      },
      {
        name: "Visible",
        type: "boolean",
        valuePath: "timeScale.visible",
      },
      {
        name: "Border Visible",
        type: "boolean",
        valuePath: "timeScale.borderVisible",
      },
      {
        name: "Border Color",
        type: "color",
        valuePath: "timeScale.borderColor",
      },
    ];

    // Iterate over options and dynamically add inputs based on type
    timeScaleOptions.forEach((option) => {
      if (option.type === "number") {
        const currentValue = this.getCurrentOptionValue(
          option.valuePath!
        ) as number;
        this.addNumberInput(
          camelToTitle(option.name),
          currentValue,
          (newValue) => {
            const updatedOptions = buildOptions(option.valuePath!, newValue);
            this.handler.chart.applyOptions(updatedOptions);
            console.log(`Updated TimeScale ${option.name} to: ${newValue}`);
          },
          option.min,
          option.max
        );
      } else if (option.type === "boolean") {
        const currentValue = this.getCurrentOptionValue(
          option.valuePath!
        ) as boolean;
        this.addCheckbox(
          camelToTitle(option.name),
          currentValue,
          (newValue) => {
            const updatedOptions = buildOptions(option.valuePath!, newValue);
            this.handler.chart.applyOptions(updatedOptions);
            console.log(`Updated TimeScale ${option.name} to: ${newValue}`);
          }
        );
      } else if (option.type === "color") {
        const currentColor =
          (this.getCurrentOptionValue(option.valuePath!) as string) ||
          "#000000";
        this.addColorPickerMenuItem(
          camelToTitle(option.name),
          currentColor,
          option.valuePath!,
          this.handler.chart
        );
      }
    });

    // Back to Main Menu
    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    this.showMenu(event); // Display the updated menu
  }

  private populatePriceScaleMenu(
    event: MouseEvent,
    priceScaleId: "left" | "right" = "right",
    series?: ISeriesApiExtended
  ): void {
    this.div.innerHTML = ""; // Clear current menu

    if (series) {
      this.addMenuInput(this.div, {
        type: "hybrid",
        label: "Price Scale",
        value: series.options().priceScaleId || "",
        onChange: (newValue: string) => {
          series.applyOptions({ priceScaleId: newValue });
          console.log(`Updated price scale to: ${newValue}`);
        },
        hybridConfig: {
          defaultAction: () => {
            const newPriceScaleId =
              series.options().priceScaleId === "left" ? "right" : "left";
            series.applyOptions({ priceScaleId: newPriceScaleId });
            console.log(`Series price scale switched to: ${newPriceScaleId}`);
          },
          options: [
            {
              name: "Left",
              action: () => series.applyOptions({ priceScaleId: "left" }),
            },
            {
              name: "Right",
              action: () => series.applyOptions({ priceScaleId: "right" }),
            },
            {
              name: "Volume",
              action: () =>
                series.applyOptions({ priceScaleId: "volume_scale" }),
            },
            {
              name: "Custom",
              action: () => {
                const inputContainer = document.createElement("div");
                const inputField = document.createElement("input");
                inputField.type = "text";
                inputField.placeholder = "Enter custom scale ID";
                inputField.value = series.options().priceScaleId || "";
                inputField.addEventListener("change", () => {
                  series.applyOptions({ priceScaleId: inputField.value });
                  console.log(`Custom scale ID set to: ${inputField.value}`);
                });
                inputContainer.appendChild(inputField);
                this.div.appendChild(inputContainer);
              },
            },
          ],
        },
      });
    } else {
      // Dropdown for Price Scale Mode
      const currentMode: PriceScaleMode =
        this.handler.chart.priceScale(priceScaleId).options().mode ??
        PriceScaleMode.Normal;

      const modeOptions: { label: string; value: PriceScaleMode }[] = [
        { label: "Normal", value: PriceScaleMode.Normal },
        { label: "Logarithmic", value: PriceScaleMode.Logarithmic },
        { label: "Percentage", value: PriceScaleMode.Percentage },
        { label: "Indexed To 100", value: PriceScaleMode.IndexedTo100 },
      ];

      const modeLabels = modeOptions.map((opt) => opt.label);

      this.addSelectInput(
        "Price Scale Mode",
        modeOptions.find((opt) => opt.value === currentMode)?.label || "Normal", // Current value label
        modeLabels, // Dropdown options (labels)
        (newLabel: string) => {
          const selectedOption = modeOptions.find(
            (opt) => opt.label === newLabel
          );
          if (selectedOption) {
            this.applyPriceScaleOptions(priceScaleId, {
              mode: selectedOption.value,
            });
            console.log(
              `Price scale (${priceScaleId}) mode set to: ${newLabel}`
            );
            this.populatePriceScaleMenu(event, priceScaleId, series); // Refresh the menu
          }
        }
      );

      // Additional Price Scale Options
      const options = this.handler.chart.priceScale(priceScaleId).options();
      const additionalOptions = [
        {
          name: "Auto Scale",
          value: options.autoScale ?? true,
          action: (newValue: boolean) => {
            this.applyPriceScaleOptions(priceScaleId, { autoScale: newValue });
            console.log(
              `Price scale (${priceScaleId}) autoScale set to: ${newValue}`
            );
          },
        },
        {
          name: "Invert Scale",
          value: options.invertScale ?? false,
          action: (newValue: boolean) => {
            this.applyPriceScaleOptions(priceScaleId, {
              invertScale: newValue,
            });
            console.log(
              `Price scale (${priceScaleId}) invertScale set to: ${newValue}`
            );
          },
        },
        {
          name: "Align Labels",
          value: options.alignLabels ?? true,
          action: (newValue: boolean) => {
            this.applyPriceScaleOptions(priceScaleId, {
              alignLabels: newValue,
            });
            console.log(
              `Price scale (${priceScaleId}) alignLabels set to: ${newValue}`
            );
          },
        },
        {
          name: "Border Visible",
          value: options.borderVisible ?? true,
          action: (newValue: boolean) => {
            this.applyPriceScaleOptions(priceScaleId, {
              borderVisible: newValue,
            });
            console.log(
              `Price scale (${priceScaleId}) borderVisible set to: ${newValue}`
            );
          },
        },
        {
          name: "Ticks Visible",
          value: options.ticksVisible ?? false,
          action: (newValue: boolean) => {
            this.applyPriceScaleOptions(priceScaleId, {
              ticksVisible: newValue,
            });
            console.log(
              `Price scale (${priceScaleId}) ticksVisible set to: ${newValue}`
            );
          },
        },
      ];

      additionalOptions.forEach((opt) => {
        this.addMenuItem(
          `${opt.name}: ${opt.value ? "On" : "Off"}`,
          () => {
            const newValue = !opt.value; // Toggle the current value
            opt.action(newValue);
            this.populatePriceScaleMenu(event, priceScaleId, series); // Refresh the menu
          },
          false,
          false
        );
      });
    }

    // Back to Main Menu
    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    this.showMenu(event); // Display the updated menu
  }

  private applyPriceScaleOptions(
    priceScaleId: "left" | "right",
    options: Partial<PriceScaleOptions>
  ): void {
    // Access the price scale from the chart using its ID
    const priceScale = this.handler.chart.priceScale(priceScaleId);

    if (!priceScale) {
      console.warn(`Price scale with ID "${priceScaleId}" not found.`);
      return;
    }

    // Apply the provided options to the price scale
    priceScale.applyOptions(options);

    console.log(`Applied options to price scale "${priceScaleId}":`, options);
  }

  private getCurrentOptionValue(optionPath: string): any {
    const keys = optionPath.split(".");
    let options: any = this.handler.chart.options();

    for (const key of keys) {
      if (options && key in options) {
        options = options[key];
      } else {
        console.warn(`Option path "${optionPath}" is invalid.`);
        return null;
      }
    }

    return options;
  }

  private setBackgroundType(event: MouseEvent, type: ColorType): void {
    const currentBackground = this.handler.chart.options().layout?.background;
    let updatedBackground: Background;

    if (type === ColorType.Solid) {
      updatedBackground = isSolidColor(currentBackground)
        ? { type: ColorType.Solid, color: currentBackground.color }
        : { type: ColorType.Solid, color: "#000000" };
    } else if (type === ColorType.VerticalGradient) {
      updatedBackground = isVerticalGradientColor(currentBackground)
        ? {
            type: ColorType.VerticalGradient,
            topColor: currentBackground.topColor,
            bottomColor: currentBackground.bottomColor,
          }
        : {
            type: ColorType.VerticalGradient,
            topColor: "rgba(255,0,0,.2)",
            bottomColor: "rgba(0,255,0,.2)",
          };
    } else {
      console.error(`Unsupported ColorType: ${type}`);
      return;
    }

    this.handler.chart.applyOptions({
      layout: {
        background: updatedBackground,
      },
    });

    if (type === ColorType.Solid) {
      this.populateSolidBackgroundMenuInline(
        event,
        updatedBackground as SolidColor
      );
    } else if (type === ColorType.VerticalGradient) {
      this.populateGradientBackgroundMenuInline(
        event,
        updatedBackground as VerticalGradientColor
      );
    }
  }
  private startFillAreaBetween(
    event: MouseEvent,
    originSeries: ISeriesApiExtended
  ): void {
    console.log(
      "Fill Area Between started. Origin series set:",
      originSeries.options().title
    );

    // Ensure the series is decorated

    // Populate the Series List Menu
    this.populateSeriesListMenu(
      event,
      false,
      (destinationSeries: ISeriesApiExtended) => {
        if (destinationSeries && destinationSeries !== originSeries) {
          console.log(
            "Destination series selected:",
            destinationSeries.options().title
          );

          // Ensure the destination series is also decorated

          // Instantiate and attach the FillArea
          originSeries.primitives["FillArea"] = new FillArea(
            originSeries,
            destinationSeries,
            {
              ...defaultFillAreaOptions,
            }
          );
          originSeries.attachPrimitive(
            originSeries.primitives["FillArea"],
            `Fill Area ⥵ ${destinationSeries.options().title}`,
            false,
            true
          );
          // Attach the FillArea as a primitive
          //if (!originSeries.primitives['FillArea']) {
          //  originSeries.attachPrimitive(originSeries.primitives["FillArea"])
          //}
          console.log("Fill Area successfully added between selected series.");
          alert(
            `Fill Area added between ${originSeries.options().title} and ${
              destinationSeries.options().title
            }`
          );
        } else {
          alert(
            "Invalid selection. Please choose a different series as the destination."
          );
        }
      }
    );
  }

  private getPredefinedOptions(label: string): string[] | null {
    const predefined: Record<string, string[]> = {
      "Series Type": ["Line", "Histogram", "Area", "Bar", "Candlestick"],
      "Line Style": [
        "Solid",
        "Dotted",
        "Dashed",
        "Large Dashed",
        "Sparse Dotted",
      ],
      "Line Type": ["Simple", "WithSteps", "Curved"],
      seriesType: ["Line", "Histogram", "Area", "Bar", "Candlestick"],
      lineStyle: ["Solid", "Dotted", "Dashed", "Large Dashed", "Sparse Dotted"],
      "Price Line Style": [
        "Solid",
        "Dotted",
        "Dashed",
        "Large Dashed",
        "Sparse Dotted",
      ],
      lineType: ["Simple", "WithSteps", "Curved"],
      Shape: ["Rectangle", "Rounded", "Ellipse", "Arrow", "3d", "Polygon"],
      "Candle Shape": [
        "Rectangle",
        "Rounded",
        "Ellipse",
        "Arrow",
        "3d",
        "Polygon",
        "Bar",
      ],
    };

    return predefined[camelToTitle(label)] || null;
  }
  /**
   * Populates the Series List Menu for selecting the destination series.
   * @param onSelect Callback when a series is selected.
   */
  public populateSeriesListMenu(
    event: MouseEvent,
    hideMenu: boolean,
    onSelect: (series: ISeriesApiExtended) => void
  ): void {
    this.div.innerHTML = ""; // Clear the current menu

    // 1) Gather all series from your `handler.seriesMap`.
    const mappedSeries = Array.from(this.handler.seriesMap.entries()).map(
      ([seriesName, series]) => ({
        label: seriesName,
        value: series,
      })
    );
    // Initialize mainSeries and volumeSeries with null values

    // Define the correct types to match the expected structure
    interface SeriesOption {
      label: string;
      value: ISeriesApiExtended;
    }

    let seriesOptions: SeriesOption[] = [...mappedSeries];

    if (this.handler.volumeSeries) {
      const volumeSeries: SeriesOption = {
        label: "Volume",
        value: this.handler.volumeSeries,
      };
      seriesOptions = [volumeSeries, ...seriesOptions];
    }

    console.log(seriesOptions);

    // 3) Display series in the menu
    seriesOptions.forEach((option) => {
      this.addMenuItem(
        option.label,
        () => {
          onSelect(option.value);
          if (hideMenu) {
            this.hideMenu();
          } else {
            this.div.innerHTML = ""; // Clear the current menu
            this.populateSeriesMenu(option.value, event); // Open the series menu
            this.showMenu(event);
          }
        },
        false,
        true
      );
    });

    // Add a "Cancel" option to go back or exit
    this.addMenuItem("Cancel", () => {
      console.log("Operation canceled.");
      this.hideMenu();
    });
    // Back to Main Menu
    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    // Show the menu at the current mouse position
    this.showMenu(event);
  }

  private customizeFillAreaOptions(
    event: MouseEvent,
    FillArea: ISeriesPrimitive
  ): void {
    this.div.innerHTML = ""; // Clear current menu
    if (isFillArea(FillArea)) {
      // Add color pickers for each color-related option
      this.addColorPickerMenuItem(
        "Origin > Destination",
        FillArea.options.originColor,
        "originColor",
        FillArea
      );

      this.addColorPickerMenuItem(
        "Origin < Destination",
        FillArea.options.destinationColor,
        "destinationColor",
        FillArea
      );
    }
    // Back to main menu
    this.addMenuItem(
      "⤝ Back to Main Menu",
      () => this.populateChartMenu(event),
      false
    );

    this.showMenu(event);
  }

  public addResetViewOption(): void {
    const resetMenuItem = this.addMenuInput(this.div, {
      type: "hybrid",
      label: "∟ Reset",
      sublabel: "Axis",
      hybridConfig: {
        defaultAction: () => {
          this.handler.chart.timeScale().resetTimeScale();
          this.handler.chart.timeScale().fitContent();
        },
        options: [
          {
            name: "⥗ Time Scale",
            action: () => this.handler.chart.timeScale().resetTimeScale(),
          },
          {
            name: "⥘ Price Scale",
            action: () => this.handler.chart.timeScale().fitContent(),
          },
        ],
      },
    });
    this.div.appendChild(resetMenuItem);
  }
  /**
   * Creates a TrendTrace for the given series.
   *
   * @param series - The series to which the TrendTrace will be attached.
   */
  public _createTrendTrace(
    event: MouseEvent,
    drawing: TwoPointDrawing | ThreePointDrawing
  ): void {
    // Populate the Series List Menu
    this.populateSeriesListMenu(event, false, (series: ISeriesApiExtended) => {
      let offset;
      if (drawing._type === "PitchFork" && series && drawing.p1 && drawing.p2) {
        console.log("Series selected:", series.options().title);
        const options = drawing._options as PitchForkOptions;
        offset =
          (options.length ?? 1) *
          Math.abs(drawing.p2.logical - drawing.p1.logical);
      }

      if (series && drawing.p1 && drawing.p2) {
        console.log("Series selected:", series.options().title);
        series.primitives["TrendTrace"] = new TrendTrace(
          this.handler,
          series,
          drawing.p1 as LogicalPoint,
          drawing.p2 as LogicalPoint,
          defaultSequenceOptions,
          offset
        );
        series.attachPrimitive(
          series.primitives["TrendTrace"],
          `${drawing.p1?.logical} ⥵ ${drawing.p2?.logical}`,
          false,
          true
        );
        console.log("Trend Trace successfully created for selected series.");
        (drawing as TwoPointDrawing).linkedObjects.push(
          series.primitives["TrendTrace"]
        );
      }
    });
  }
  public _createVolumeProfile(
    drawing: TwoPointDrawing | ThreePointDrawing
  ): void {
    const series = this.handler.series ?? this.handler._seriesList[0];
    if (series && drawing.p1 && drawing.p2) {
      console.log("Series selected:", series.options().title);

      // Create the VolumeProfile instance in fixed range mode.
      const volumeProfile = new VolumeProfile(
        this.handler,
        defaultVolumeProfileOptions,
        drawing.p1 as LogicalPoint,
        drawing.p2 as LogicalPoint
      );

      // Attach the volume profile primitive to the selected series.
      series.attachPrimitive(volumeProfile, "Volume Profile", false, true);
      console.log("Volume Profile successfully created for selected series.");
      (drawing as TwoPointDrawing).linkedObjects.push(volumeProfile);
    }
  }

  /**
   * Main entry point for the trend trace menu.
   *
   * @param event - The mouse event that triggered the menu.
   * @param trendTrace - The trend trace instance.
   */
  private populateTrendTraceMenu(
    event: MouseEvent,
    trendTrace: TrendTrace
  ): void {
    this.div.innerHTML = ""; // Clear the menu

    this.addMenuItem(
      "Color Options ▸",
      () => this.populateTrendColorMenu(event, trendTrace),
      false,
      true
    );

    this.addMenuItem(
      "General Options ▸",
      () => this.populateTrendOptionsMenu(event, trendTrace),
      false,
      true
    );

    this.addMenuItem(
      "Export Data",
      () => this.showExportDataDialog(trendTrace),
      false
    );
    this.addMenuItem("⤝ Main Menu", () => this.populateChartMenu(event), false);

    this.showMenu(event);
  }
  // Define a common interface for an option descriptor.
  // TrendTrace.ts

  private showExportDataDialog(trendTrace: TrendTrace): void {
    // **Gather the data and options to export**
    const exportData = {
      sequence: trendTrace.toJSON(),
      title: trendTrace.title,
    };

    const jsonData = JSON.stringify(exportData, null, 2); // Pretty-print with 2-space indentation

    // **Create the modal elements**
    const modalOverlay = document.createElement("div");
    modalOverlay.style.position = "fixed";
    modalOverlay.style.top = "0";
    modalOverlay.style.left = "0";
    modalOverlay.style.width = "100%";
    modalOverlay.style.height = "100%";
    modalOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modalOverlay.style.display = "flex";
    modalOverlay.style.justifyContent = "center";
    modalOverlay.style.alignItems = "center";
    modalOverlay.style.zIndex = "1000"; // Ensure it's on top

    // **Handle closing the modal with Esc key**
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        document.body.removeChild(modalOverlay);
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    const modalContent = document.createElement("div");
    modalContent.style.backgroundColor = "#fff";
    modalContent.style.padding = "20px";
    modalContent.style.borderRadius = "8px";
    modalContent.style.width = "80%";
    modalContent.style.maxWidth = "800px"; // Increased width for better readability
    modalContent.style.maxHeight = "90%"; // Allow scrolling if content is too long
    modalContent.style.overflowY = "auto"; // Enable vertical scrolling
    modalContent.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
    modalContent.setAttribute("tabindex", "-1"); // Make div focusable
    modalContent.focus(); // Focus on the modal for accessibility

    const title = document.createElement("h2");
    title.textContent = "Export/Import TrendTrace Data";
    modalContent.appendChild(title);

    const textarea = document.createElement("textarea");
    textarea.value = jsonData;
    textarea.style.width = "100%";
    textarea.style.height = "400px"; // Increased height for better usability
    textarea.style.marginTop = "10px";
    textarea.style.marginBottom = "10px";
    textarea.style.resize = "vertical"; // Allow users to resize vertically
    textarea.setAttribute("aria-label", "JSON Data Editor"); // Accessibility label
    modalContent.appendChild(textarea);

    // **Buttons Container**
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.justifyContent = "flex-end";
    buttonsContainer.style.gap = "10px";

    // **Apply Changes Button**
    const applyButton = document.createElement("button");
    applyButton.textContent = "Apply Changes";
    applyButton.style.padding = "8px 12px";
    applyButton.style.cursor = "pointer";
    applyButton.style.backgroundColor = "#4CAF50"; // Green background
    applyButton.style.color = "#fff";
    applyButton.style.border = "none";
    applyButton.style.borderRadius = "4px";
    applyButton.onclick = () => {
      try {
        const modifiedData = JSON.parse(textarea.value);

        // **Validate the modified data structure**
        if (
          typeof modifiedData !== "object" ||
          !modifiedData.sequence ||
          !modifiedData.sequence.options ||
          !Array.isArray(modifiedData.sequence.data)
        ) {
          throw new Error(
            "Invalid data structure. Please ensure 'sequence', 'options', and 'data' are present."
          );
        }

        // **Optional: Further validation can be added here to check specific fields.**

        // **Apply the new options and data**
        trendTrace.fromJSON(modifiedData.sequence); // Update the TrendTrace instance
        trendTrace.updateViewFromSequence(); // Request the TrendTrace to re-render with new data

        this.showNotification(
          "TrendTrace data has been successfully updated.",
          "success"
        );
        document.body.removeChild(modalOverlay);
        document.removeEventListener("keydown", handleKeyDown);
      } catch (error: any) {
        this.showNotification(
          "Failed to apply changes: " + error.message,
          "error"
        );
      }
    };
    buttonsContainer.appendChild(applyButton);

    // **Copy Button**
    const copyButton = document.createElement("button");
    copyButton.textContent = "Copy to Clipboard";
    copyButton.style.padding = "8px 12px";
    copyButton.style.cursor = "pointer";
    copyButton.style.backgroundColor = "#008CBA"; // Blue background
    copyButton.style.color = "#fff";
    copyButton.style.border = "none";
    copyButton.style.borderRadius = "4px";
    copyButton.onclick = () => {
      navigator.clipboard.writeText(textarea.value).then(
        () => {
          this.showNotification("Data copied to clipboard!", "success");
        },
        (err) => {
          this.showNotification("Failed to copy data: " + err, "error");
        }
      );
    };
    buttonsContainer.appendChild(copyButton);

    // **Download Button**
    const downloadButton = document.createElement("button");
    downloadButton.textContent = "Download JSON";
    downloadButton.style.padding = "8px 12px";
    downloadButton.style.cursor = "pointer";
    downloadButton.style.backgroundColor = "#f44336"; // Red background
    downloadButton.style.color = "#fff";
    downloadButton.style.border = "none";
    downloadButton.style.borderRadius = "4px";
    downloadButton.onclick = () => {
      try {
        const blob = new Blob([textarea.value], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        6;
        const a = document.createElement("a");
        a.href = url;
        a.download = "trendtrace_data.json";
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        this.showNotification("Failed to download data: " + error, "error");
      }
    };
    buttonsContainer.appendChild(downloadButton);

    // **Close Button**
    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.style.padding = "8px 12px";
    closeButton.style.cursor = "pointer";
    closeButton.style.backgroundColor = "#555"; // Dark gray background
    closeButton.style.color = "#fff";
    closeButton.style.border = "none";
    closeButton.style.borderRadius = "4px";
    closeButton.onclick = () => {
      document.body.removeChild(modalOverlay);
      document.removeEventListener("keydown", handleKeyDown);
    };
    buttonsContainer.appendChild(closeButton);

    modalContent.appendChild(buttonsContainer);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
  }

  /**
   * Displays a notification message to the user.
   *
   * @param message - The message to display.
   * @param type - The type of message ('success' or 'error').
   */
  private showNotification(message: string, type: "success" | "error"): void {
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.style.position = "fixed";
    notification.style.bottom = "20px";
    notification.style.right = "20px";
    notification.style.padding = "10px 20px";
    notification.style.borderRadius = "4px";
    notification.style.color = "#fff";
    notification.style.backgroundColor =
      type === "success" ? "#4CAF50" : "#f44336";
    notification.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    notification.style.zIndex = "1001";
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.5s ease-in-out";
    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => {
      notification.style.opacity = "1";
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 3000);
  }

  private populateTrendColorMenu(
    event: MouseEvent,
    trendTrace: TrendTrace
  ): void {
    this.div.innerHTML = ""; // Clear the menu
    const currentOptions = trendTrace.getOptions();
    const sequence = trendTrace._sequence;

    const ohlcData: DataPoint[] = sequence.data;
    const isOHLC = ohlcData.every(
      (point) =>
        point.open !== undefined &&
        point.high !== undefined &&
        point.low !== undefined &&
        point.close !== undefined
    );

    // Build a list of color options based on the data type.
    const colorOptions: OptionDescriptor[] = [];

    if (isOHLC) {
      colorOptions.push(
        {
          name: "Up Color",
          type: "color",
          valuePath: "upColor",
          defaultValue: currentOptions.upColor ?? "rgba(0,255,0,.25)",
        },
        {
          name: "Down Color",
          type: "color",
          valuePath: "downColor",
          defaultValue: currentOptions.downColor ?? "rgba(255,0,0,.25)",
        },
        {
          name: "Border Up Color",
          type: "color",
          valuePath: "borderUpColor",
          defaultValue: currentOptions.borderUpColor ?? "#1c9d1c",
        },
        {
          name: "Border Down Color",
          type: "color",
          valuePath: "borderDownColor",
          defaultValue: currentOptions.borderDownColor ?? "#d5160c",
        },
        {
          name: "Wick Up Color",
          type: "color",
          valuePath: "wickUpColor",
          defaultValue: currentOptions.wickUpColor ?? "#1c9d1c",
        },
        {
          name: "Wick Down Color",
          type: "color",
          valuePath: "wickDownColor",
          defaultValue: currentOptions.wickDownColor ?? "#d5160c",
        }
      );
    } else
      colorOptions.push({
        name: "Line Color",
        type: "color",
        valuePath: "lineColor",
        defaultValue: currentOptions.lineColor ?? "#ffffff",
      });

    // Iterate over each color option and add it using addColorPickerMenuItem.
    colorOptions.forEach((option) => {
      this.addColorPickerMenuItem(
        camelToTitle(option.name),
        option.defaultValue,
        option.valuePath,
        trendTrace
      );
    });

    // Back to Trend Trace Menu
    this.addMenuItem(
      "⤝ Trend Trace Menu",
      () => this.populateTrendTraceMenu(event, trendTrace),
      false
    );
    this.showMenu(event);
  }

  /**
   * Populates the submenu for general options.
   *
   * Logical indices (P1/P2) are always shown.
   * However, appearance options that are relevant only for OHLC data—
   * such as Bar Spacing, Radius, Shape, Show Wicks, Show Borders, and Chandelier Size—
   * are added only if isOHLCData returns true.
   *
   * Each update uses buildOptions.
   *
   * @param event - The mouse event that triggered the menu.
   * @param trendTrace - The TrendTrace instance.
   */
  private populateTrendOptionsMenu(
    event: MouseEvent,
    trendTrace: TrendTrace
  ): void {
    this.div.innerHTML = ""; // Clear the menu
    const currentOptions = trendTrace.getOptions();
    const sequence = trendTrace._sequence;

    const ohlcData: DataPoint[] = sequence.data;
    const isOHLC = ohlcData.every(
      (point) =>
        point.open !== undefined &&
        point.high !== undefined &&
        point.low !== undefined &&
        point.close !== undefined
    );

    // Define the generalOptions array with a consistent option type.
    const generalOptions: Array<{
      name: string;
      type: "number" | "boolean" | "select";
      valuePath: string;
      defaultValue: any;
      min?: number;
      max?: number;
      step?: number;
      options?: Array<{ label: string; value: any }> | string[];
    }> = [];

    // If the series is OHLC, add appearance options specific to OHLC.
    if (isOHLC) {
      generalOptions.push(
        {
          name: "Bar Spacing",
          type: "number",
          valuePath: "barSpacing",
          defaultValue: currentOptions.barSpacing ?? 0.8,
          min: 0.1,
          max: 10,
          step: 0.1,
        },
        {
          name: "Radius",
          type: "number",
          valuePath: "radius",
          defaultValue: currentOptions.radius ?? 0.6,
          min: 0,
          max: 1,
          step: 0.1,
        },
        {
          name: "Shape",
          type: "select",
          valuePath: "shape",
          defaultValue: currentOptions.shape ?? "Rounded",
          options: [
            { label: "Rectangle", value: CandleShape.Rectangle },
            { label: "Rounded", value: CandleShape.Rounded },
            { label: "Ellipse", value: CandleShape.Ellipse },
            { label: "Arrow", value: CandleShape.Arrow },
            { label: "Polygon", value: CandleShape.Polygon },
            { label: "Bar", value: CandleShape.Bar },
          ],
        },
        {
          name: "Show Wicks",
          type: "boolean",
          valuePath: "wickVisible",
          defaultValue: currentOptions.wickVisible ?? true,
        },
        {
          name: "Show Borders",
          type: "boolean",
          valuePath: "borderVisible",
          defaultValue: currentOptions.borderVisible ?? true,
        },
        {
          name: "Chandelier Size",
          type: "number",
          valuePath: "chandelierSize",
          defaultValue: currentOptions.chandelierSize ?? 1,
          min: 1,
          max: 100,
          step: 1,
        },
        {
          name: "Auto Aggregate",
          type: "boolean",
          valuePath: "autoscale",
          defaultValue: currentOptions.autoScale ?? true,
        }
      );
    }

    // Always include the following default appearance options.

    // Line Style option with numeric mapping.
    generalOptions.push({
      name: "Line Style",
      type: "select",
      valuePath: "lineStyle",
      defaultValue: currentOptions.lineStyle ?? 0,
      options: [
        { label: "Solid", value: 0 },
        { label: "Dotted", value: 1 },
        { label: "Dashed", value: 2 },
        { label: "Large Dashed", value: 3 },
        { label: "Sparse Dotted", value: 4 },
      ],
    });

    // Line Width option for adjusting the appearance of the line.
    generalOptions.push({
      name: "Line Width",
      type: "number",
      valuePath: "lineWidth",
      defaultValue: currentOptions.lineWidth ?? 1,
      min: 0.5,
      max: 10,
      step: 0.5,
    });

    // Visible toggle option. This option is always added.
    generalOptions.push({
      name: "Visible",
      type: "boolean",
      valuePath: "visible",
      defaultValue: currentOptions.visible ?? true,
    });
    // Iterate over each general option and add an input based on its type.
    generalOptions.forEach((option) => {
      if (option.type === "number") {
        this.addNumberInput(
          camelToTitle(option.name),
          option.defaultValue,
          (newValue: number) => {
            const updatedOptions = buildOptions(option.valuePath, newValue);
            trendTrace.applyOptions(updatedOptions);
            console.log(`Updated ${option.name} to: ${newValue}`);
          },
          option.min,
          option.max,
          option.step
        );
      } else if (option.type === "boolean") {
        this.addCheckbox(
          camelToTitle(option.name),
          option.defaultValue,

          (newValue: boolean) => {
            const updatedOptions = buildOptions(option.valuePath, newValue);
            trendTrace.applyOptions(updatedOptions);
            console.log(`Updated ${option.name} to: ${newValue}`);
          }
        );
      } else if (option.type === "select") {
        // If options are objects, extract their labels.
        const optionLabels =
          Array.isArray(option.options) && typeof option.options[0] === "object"
            ? (option.options as Array<{ label: string; value: any }>).map(
                (opt) => opt.label
              )
            : (option.options as string[]);

        this.addSelectInput(
          camelToTitle(option.name),
          option.defaultValue,
          optionLabels,
          (newLabel: string) => {
            // For option objects, find the corresponding numeric value.
            const selectedOption = (
              option.options as Array<{ label: string; value: any }>
            ).find((opt) => opt.label === newLabel);
            if (selectedOption) {
              const updatedOptions = buildOptions(
                option.valuePath,
                selectedOption.value
              );
              trendTrace.applyOptions(updatedOptions);
              console.log(`Updated ${option.name} to: ${selectedOption.value}`);
            }
          }
        );
      }
      // (Color options are handled in the color submenu.)
    });
    // Add the Export option.

    // Back to Trend Trace Menu.
    this.addMenuItem(
      "⤝ Trend Trace Menu",
      () => this.populateTrendTraceMenu(event, trendTrace),
      false
    );
    this.showMenu(event);
  }

  private populateVolumeProfileMenu(
    event: MouseEvent,
    volumeProfile: VolumeProfile
  ): void {
    this.div.innerHTML = ""; // Clear the menu

    const currentOptions = volumeProfile._options;

    // Define a unified array for all option types.
    const generalOptions: Array<{
      name: string;
      type: "number" | "boolean" | "select" | "color";
      valuePath: string;
      defaultValue: any;
      min?: number;
      max?: number;
      step?: number;
      options?: Array<{ label: string; value: any }> | string[];
    }> = [];

    // Push non-color options.
    generalOptions.push(
      {
        name: "Visible",
        type: "boolean",
        valuePath: "visible",
        defaultValue: currentOptions.visible ?? true,
      },
      {
        name: "Sections",
        type: "number",
        valuePath: "sections",
        defaultValue: currentOptions.sections ?? 20,
        min: 1,
        step: 1,
      },
      {
        name: "Right Side",
        type: "boolean",
        valuePath: "rightSide",
        defaultValue: currentOptions.rightSide ?? true,
      },
      {
        name: "Width",
        type: "number",
        valuePath: "width",
        defaultValue: currentOptions.width ?? 30,
        min: 1,
        step: 1,
      },
      {
        name: "Line Style",
        type: "select",
        valuePath: "lineStyle",
        defaultValue: currentOptions.lineStyle ?? 0,
        options: [
          { label: "Solid", value: 0 },
          { label: "Dotted", value: 1 },
          { label: "Dashed", value: 2 },
          { label: "Large Dashed", value: 3 },
          { label: "Sparse Dotted", value: 4 },
        ],
      },
      {
        name: "Draw Grid",
        type: "boolean",
        valuePath: "drawGrid",
        defaultValue: currentOptions.drawGrid ?? true,
      },
      {
        name: "Grid Width",
        type: "number",
        valuePath: "gridWidth",
        defaultValue: currentOptions.gridWidth ?? undefined, // Undefined to use entire visible range
        min: 1,
        step: 1,
      },
      {
        name: "Grid Line Style",
        type: "select",
        valuePath: "gridLineStyle",
        defaultValue: currentOptions.gridLineStyle ?? 4, // Assuming 1 corresponds to 'Dashed'
        options: [
          { label: "Solid", value: 0 },
          { label: "Dotted", value: 1 },
          { label: "Dashed", value: 2 },
          { label: "Large Dashed", value: 3 },
          { label: "Sparse Dotted", value: 4 },
        ],
      }
    );

    // Push color options.
    generalOptions.push(
      {
        name: "Up Color",
        type: "color",
        valuePath: "upColor",
        defaultValue:
          currentOptions.upColor ?? defaultVolumeProfileOptions.upColor,
      },
      {
        name: "Down Color",
        type: "color",
        valuePath: "downColor",
        defaultValue:
          currentOptions.downColor ?? defaultVolumeProfileOptions.downColor,
      },
      {
        name: "Border Up Color",
        type: "color",
        valuePath: "borderUpColor",
        defaultValue:
          currentOptions.borderUpColor ??
          defaultVolumeProfileOptions.borderUpColor,
      },
      {
        name: "Border Down Color",
        type: "color",
        valuePath: "borderDownColor",
        defaultValue:
          currentOptions.borderDownColor ??
          defaultVolumeProfileOptions.borderDownColor,
      },
      {
        name: "Grid Color",
        type: "color",
        valuePath: "gridColor",
        defaultValue:
          currentOptions.gridColor ?? defaultVolumeProfileOptions.gridColor,
      }
    );

    // Iterate over each general option and add an input based on its type.
    generalOptions.forEach((option) => {
      if (option.type === "number") {
        this.addNumberInput(
          camelToTitle(option.name),
          option.defaultValue,
          (newValue: number) => {
            const updatedOptions = buildOptions(option.valuePath, newValue);
            volumeProfile.applyOptions(updatedOptions);
            console.log(`Updated ${option.name} to: ${newValue}`);
          },
          option.min,
          option.max,
          option.step
        );
      } else if (option.type === "boolean") {
        this.addCheckbox(
          camelToTitle(option.name),

          option.defaultValue,
          (newValue: boolean) => {
            const updatedOptions = buildOptions(option.valuePath, newValue);
            volumeProfile.applyOptions(updatedOptions);
            console.log(`Updated ${option.name} to: ${newValue}`);
          }
        );
      } else if (option.type === "select") {
        // If options are objects, extract their labels; otherwise, assume an array of strings.
        const optionLabels =
          Array.isArray(option.options) && typeof option.options[0] === "object"
            ? (option.options as Array<{ label: string; value: any }>).map(
                (opt) => opt.label
              )
            : (option.options as string[]);

        this.addSelectInput(
          camelToTitle(option.name),
          option.defaultValue,
          optionLabels,
          (newLabel: string) => {
            const selectedOption = (
              option.options as unknown as Array<{ label: string; value: any }>
            ).find((opt) => opt.label === newLabel);
            if (selectedOption) {
              const updatedOptions = buildOptions(
                option.valuePath,
                selectedOption.value
              );
              volumeProfile.applyOptions(updatedOptions);
              console.log(`Updated ${option.name} to: ${selectedOption.value}`);
            }
          }
        );
      } else if (option.type === "color") {
        // Use the existing color picker method.
        this.addColorPickerMenuItem(
          camelToTitle(option.name),
          option.defaultValue,
          option.valuePath,
          volumeProfile
        );
      }
    });

    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    this.showMenu(event);
  }

  /**
   * Here, we define the method that shows a minimal overlay listing all indicators,
   * letting the user click “Add” or “Remove.” We'll reuse references to `this.handler.chart`
   * and `this.handler.seriesMap`, etc. We also define `this.applyIndicator` and `this.removeIndicator`
   * as class methods that store a reference to each indicator's series in `indicatorSeriesMap`.
   */

  // A map from indicator name => { figureKey => ISeriesApi }
  private indicatorSeriesMap = new Map<
    string,
    Map<
      string,
      ISeriesApi<
        | "Line"
        | "Histogram"
        | "Area"
        | "Candlestick"
        | "Bar"
        | "Baseline"
        | "Custom"
      >
    >
  >();
  public populateIndicatorMenu(series: ISeriesApi<any>, event: MouseEvent) {
    // Clear the menu first
    this.div.innerHTML = "";

    // Show each indicator
    INDICATORS.forEach((indicator) => {
      this.addMenuItem(
        `${indicator.name} (${indicator.shortName})`,
        () => {
          // If indicator has paramMap, let user configure
          if (indicator.paramMap) {
            this.configureIndicatorParams(
              { series, indicator },
              event,
              1,
              true
            );
          } else {
            // Otherwise, directly apply
            this.applyIndicator(series, indicator, /* no overrides */ {}, 1);
          }
        },
        false
      );
    });

    // Add a back/cancel item
    this.addMenuItem(
      "⤝ Back",
      () => {
        this.hideMenu();
        // or populate something else
      },
      false
    );

    // Display
    this.showMenu(event);
  }

  private configureIndicatorParams(
    indicatorInput:
      | { series: ISeriesApi<any>; indicator: IndicatorDefinition }
      | ISeriesIndicator,
    event: MouseEvent,
    globalCountParam?: number,
    init: boolean = false // Optional parameter for global figure count.
  ) {
    // Clear existing menu items
    this.div.innerHTML = "";
    let currentCount: number;

    // Extract the series and indicator from the input.
    const series =
      "sourceSeries" in indicatorInput
        ? indicatorInput
        : (indicatorInput.series as ISeriesApi<"Candlestick" | "Bar">);
    const indicator = (
      "indicator" in indicatorInput
        ? indicatorInput.indicator
        : (indicatorInput as ISeriesIndicator).indicator
    ) as IndicatorDefinition;

    // Use stored parameters if available; otherwise, use indicator defaults.
    const storedParams =
      "paramMap" in indicatorInput ? indicatorInput.paramMap : {};
    const overrides: Record<string, any> = {};

    /**************************************************
     * 1. Global Figure Count Input
     * If any parameter is an array type, add a top-level input for
     * "Number of Figures". Use the passed globalCountParam if provided,
     * otherwise default to indicatorInput.figureCount if it exists,
     * or else to the default count (derived from the param defaults).
     **************************************************/
    let hasArrayParams = false;
    let defaultCount = 0;
    Object.entries(indicator.paramMap).forEach(([_, paramSpec]) => {
      if (
        paramSpec.type === "numberArray" ||
        paramSpec.type === "selectArray" ||
        paramSpec.type === "booleanArray" ||
        paramSpec.type === "stringArray"
      ) {
        hasArrayParams = true;
        const defArr = Array.isArray(paramSpec.defaultValue)
          ? paramSpec.defaultValue
          : [paramSpec.defaultValue];
        defaultCount = Math.max(defaultCount, defArr.length);
      }
    });
    if (hasArrayParams && init) {
      // Determine the current global count:
      if (globalCountParam !== undefined) {
        currentCount = globalCountParam;
        (indicatorInput as ISeriesIndicator).figureCount = globalCountParam;
      } else if (
        "figureCount" in indicatorInput &&
        (indicatorInput as ISeriesIndicator).figureCount !== undefined
      ) {
        currentCount = (indicatorInput as ISeriesIndicator).figureCount;
      } else {
        currentCount = defaultCount || 1;
      }
      // Add a top-level input for "Number of Figures"
      this.addNumberInput(
        "Number of Figures",
        currentCount,
        (newCount: number) => {
          // Update the indicator's property with the new count.

          (indicatorInput as ISeriesIndicator).figureCount = newCount;
          // Redraw the parameter menu using the new global count.
          this.configureIndicatorParams(indicatorInput, event, newCount, true);
        },
        1,
        10,
        1
      );
    }

    /**************************************************
     * 2. Process Each Parameter
     **************************************************/
    Object.entries(indicator.paramMap).forEach(([paramName, paramSpec]) => {
      const labelText = paramName; // Optionally, format the label.
      const defaultVal =
        storedParams[paramName] !== undefined
          ? storedParams[paramName]
          : paramSpec.defaultValue;

      if (
        paramSpec.type === "numberArray" ||
        paramSpec.type === "selectArray" ||
        paramSpec.type === "booleanArray" ||
        paramSpec.type === "stringArray"
      ) {
        // Get the global count from the indicator's property.
        const count: number =
          globalCountParam ?? (indicatorInput as ISeriesIndicator).figureCount;

        // Determine base type by stripping "Array"
        const baseType = paramSpec.type.replace("Array", "");
        overrides[paramName] = [];
        for (let i = 0; i < count; i++) {
          let itemDefault: any;
          if (Array.isArray(defaultVal)) {
            itemDefault =
              i < defaultVal.length
                ? defaultVal[i]
                : defaultVal[defaultVal.length - 1];
          } else {
            itemDefault = defaultVal;
          }
          if (baseType === "number") {
            this.addNumberInput(
              `${labelText} ${i + 1}`,
              itemDefault,
              (newVal: number) => {
                if (!overrides[paramName]) {
                  overrides[paramName] = [];
                }
                overrides[paramName][i] = newVal;
              },
              paramSpec.min,
              paramSpec.max,
              paramSpec.step
            );
          } else if (baseType === "boolean") {
            this.addCheckbox(
              `${labelText} ${i + 1}`,
              Boolean(itemDefault),
              (checked: boolean) => {
                if (!overrides[paramName]) {
                  overrides[paramName] = [];
                }
                overrides[paramName][i] = checked;
              }
            );
          } else if (baseType === "select") {
            this.addSelectInput(
              `${labelText} ${i + 1}`,
              String(itemDefault),
              paramSpec.options || [],
              (selected: string) => {
                if (!overrides[paramName]) {
                  overrides[paramName] = [];
                }
                overrides[paramName][i] = selected;
              }
            );
          } else if (baseType === "string") {
            this.addMenuInput(this.div, {
              type: "string",
              label: `${labelText} ${i + 1}`,
              value: itemDefault,
              onChange: (val: string) => {
                if (!overrides[paramName]) {
                  overrides[paramName] = [];
                }
                overrides[paramName][i] = val;
              },
            });
          }
          if (!overrides[paramName]) {
            overrides[paramName] = [];
          }
          overrides[paramName][i] = itemDefault;
        }
      } else {
        // Non-array parameters: same as before.
        if (paramSpec.type === "number") {
          this.addNumberInput(
            labelText,
            defaultVal,
            (newVal: number) => {
              overrides[paramName] = newVal;
            },
            paramSpec.min,
            paramSpec.max,
            paramSpec.step
          );
          overrides[paramName] = defaultVal;
        } else if (paramSpec.type === "boolean") {
          this.addCheckbox(
            labelText,
            Boolean(defaultVal),
            (checked: boolean) => {
              overrides[paramName] = checked;
            }
          );
          overrides[paramName] = defaultVal;
        } else if (paramSpec.type === "select") {
          this.addSelectInput(
            labelText,
            String(defaultVal),
            paramSpec.options || [],
            (selected: string) => {
              overrides[paramName] = selected;
            }
          );
          overrides[paramName] = defaultVal;
        } else {
          this.addMenuInput(this.div, {
            type: "string",
            label: labelText,
            value: defaultVal,
            onChange: (val: string) => {
              overrides[paramName] = val;
            },
          });
          overrides[paramName] = defaultVal;
        }
      }
    });

    /**************************************************
     * 3. Apply and Cancel Buttons
     **************************************************/
    this.addMenuItem(
      "Apply",
      () => {
        this.hideMenu();

        // Update the defaultValue for each parameter in the indicator's paramMap
        Object.entries(overrides).forEach(([paramName, newValue]) => {
          if (indicator.paramMap[paramName]) {
            indicator.paramMap[paramName].defaultValue = newValue;
          }
        });
        if ("recalculate" in indicatorInput) {
          (indicatorInput as ISeriesIndicator).recalculate(overrides);
          (indicatorInput as ISeriesIndicator).figures.forEach((figSeries) => {
            const legendItem = this.handler.legend._lines.find(
              (item) => item.series === figSeries
            );
            if (legendItem) {
              this.handler.seriesMap.set(
                figSeries.options().title,
                series as ISeriesApiExtended
              );
              legendItem.name = figSeries.options().title;
            }
          });
        } else {
          this.applyIndicator(series, indicator, overrides, currentCount);
        }
      },
      false
    );

    this.addMenuItem(
      "Cancel",
      () => {
        this.hideMenu();
      },
      false
    );

    this.showMenu(event);
  }

  /**
   * Applies an indicator to the given series.
   *
   * This method now accepts any ISeriesApi (not just Candlestick or Bar) and converts the data
   * to OHLC data if needed before calling the indicator's calc function.
   *
   * After calculating indicator figures, it either updates existing series or creates new ones,
   * and moves them to the appropriate pane if the figure defines a pane offset.
   *
   * @param series - The series on which to apply the indicator.
   * @param ind - The indicator definition.
   * @param overrides - User-specified parameter overrides.
   * @param count - The figure count.
   */
  private applyIndicator(
    series: ISeriesApi<any> | ISeriesIndicator,
    ind: IndicatorDefinition,
    overrides: Record<string, any>,
    count: number
  ) {
    // 1) Grab your main data.
    const data = [...series.data()];
    if (!data || data.length === 0) {
      console.warn("No data found on this series.");
      return;
    }

    // 2) Convert the data to OHLC if it isn't already.
    let ohlcData: OhlcData[];
    if (data.every(isOHLCData)) {
      ohlcData = data as OhlcData[];
    } else {
      // Assume data is SingleValueData and convert each point.
      ohlcData = data.map(singleToOhlcData);
    }
    const volumeData = this.handler.volumeSeries.data() as SingleValueData[];
    // 2a) Calculate the figures from the indicator
    const figures = ind.calc([...ohlcData], overrides, volumeData ?? undefined);

    // 2b) If we already have them, update the existing figures
    if (isISeriesIndicator(series)) {
      const figMap = series.figures;
      if (figMap) {
        figures.forEach((f) => {
          const existing = figMap.get(f.key);
          if (existing) {
            existing.setData(f.data);
          }
        });
      }
      return;
    }

    // 2c) Otherwise, create new indicator series
    const newMap = new Map<string, ISeriesIndicator>();
    const colorShades = generateShades(figures.length); // Generate unique shades

    figures.forEach((f, index) => {
      const selectedColor = colorShades[index];

      let seriesInstance: ISeriesApi<"Line" | "Histogram"> | null = null;
      if (f.type === "histogram") {
        const hist = this.handler.createHistogramSeries(f.title, {
          color: selectedColor,
          base: 0,
          title: f.title,
          ...(figures.length > 1 ? { group: ind.name } : {}), // ✅ Only set `group` if multiple figures exist
        });
        if (hist.series) {
          hist.series.setData(f.data);
          seriesInstance = hist.series as ISeriesApi<"Histogram">;
        }
      } else {
        const line = this.handler.createLineSeries(f.title, {
          color: selectedColor,
          lineWidth: 2,
          title: f.title,
          ...(figures.length > 1 ? { group: ind.name } : {}), // ✅ Only set `group` if multiple figures exist
        });
        if (line.series) {
          line.series.setData(f.data);
          seriesInstance = line.series as ISeriesApi<"Line">;
        }
      }

      if (seriesInstance) {
        // 🎯 Decorate the series instance as an `ISeriesIndicator`
        const indicatorInstance = decorateSeriesAsIndicator(
          seriesInstance,
          series, // The original candlestick/bar series
          ind,
          newMap,
          count,
          overrides, // Store parameter overrides for recalculation
          recalculateIndicator
        );

        // Store the decorated indicator series
        newMap.set(f.key, indicatorInstance);
        // If the indicator figure has a pane property, move the series to the appropriate pane.
        if (f.pane) {
          // Check if the current pane of the indicator is the same as the source series' pane.
          if (indicatorInstance.getPane() === series.getPane()) {
            const currentPane = indicatorInstance.getPane();
            // Since paneIndex is a function, call it to get a number.
            const paneIndex = currentPane.paneIndex();
            // Move the indicator series to a new pane by adding the offset.
            indicatorInstance.moveToPane(paneIndex + f.pane);
          }
        }
      }
    });

    // Store the new indicator in the map.
    this.indicatorSeriesMap.set(ind.name, newMap);
  }

  private populateForkLineMainMenu(event: MouseEvent, drawing: Drawing): void {
    // Clear the menu container.
    this.div.innerHTML = "";

    // Only applicable if the drawing is a PitchFork.
    if (drawing._type !== "PitchFork") return;

    const options = drawing._options as PitchForkOptions;
    if (!options.forkLines) {
      options.forkLines = [];
    }
    const forkLines = options.forkLines;

    // For each fork line, add one menu item that will open its detailed options.
    forkLines.forEach((_, index) => {
      this.addMenuItem(
        `Fork Line ${index + 1}`,
        () => {
          // When clicked, clear the menu and show the options for this fork line.
          this.populateForkLineOptions(event, drawing, index);
        },
        false,
        true
      );
    });

    // Add a menu item to add a new fork line.
    this.addMenuItem(
      "Add Fork Line",
      () => {
        const newForkLine: ForkLine = {
          value: 0.5, // Default offset value.
          width: 1, // Default width.
          style: LineStyle.Solid, // Default style (ensure this is valid per your LineStyle)
          color: "#ffffff", // Default color.
          fillColor: undefined, // No fill by default.
        };
        forkLines.push(newForkLine);
        if (this.saveDrawings) {
          this.saveDrawings();
        }
        // Refresh the main fork line menu.
        this.populateForkLineMainMenu(event, drawing);
      },
      false,
      true
    );

    // Add a back button to return to the drawing menu.
    this.addMenuItem(
      "⤝ Back",
      () => {
        this.populateDrawingMenu(event, drawing);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  private populateForkLineOptions(
    event: MouseEvent,
    drawing: Drawing,
    index: number
  ): void {
    // Clear the menu container.
    this.div.innerHTML = "";

    const options = drawing._options as PitchForkOptions;
    if (!options.forkLines || !options.forkLines[index]) return;
    const fork = options.forkLines[index];

    // Add a header for clarity.

    // Add a number input for "value".
    this.addNumberInput(
      "Value",
      fork.value,
      (newValue: number) => {
        fork.value = newValue;
        if (this.saveDrawings) {
          this.saveDrawings();
        }
      },
      0, // minimum value (adjust as needed)
      10, // maximum value (adjust as needed)
      0.1 // step (adjust as needed)
    );

    // Add a number input for "width".
    this.addNumberInput(
      "Width",
      fork.width,
      (newValue: number) => {
        fork.width = newValue as LineWidth;
        if (this.saveDrawings) {
          this.saveDrawings();
        }
      },
      1, // minimum width
      10, // maximum width (adjust as needed)
      1
    );

    // Define allowed styles for fork lines.
    const allowedStyles = [
      { name: "Solid", var: LineStyle.Solid },
      { name: "Dotted", var: LineStyle.Dotted },
      { name: "Dashed", var: LineStyle.Dashed },
      { name: "Large Dashed", var: LineStyle.LargeDashed },
      { name: "Sparse Dotted", var: LineStyle.SparseDotted },
    ];

    // In your populateForkLineOptions method, for the "Style" menu item:
    this.addSelectInput(
      "Style",
      // Show the current style name (by matching fork.style with the allowedStyles array)
      allowedStyles.find((styleObj) => styleObj.var === fork.style)?.name ||
        allowedStyles[0].name,
      // Provide the names as the options for the select input.
      allowedStyles.map((styleObj) => styleObj.name),
      (newValue: string) => {
        // When a new style is selected, look it up in allowedStyles.
        const selected = allowedStyles.find(
          (styleObj) => styleObj.name === newValue
        );
        if (selected) {
          fork.style = selected.var;
          if (this.saveDrawings) {
            this.saveDrawings();
          }
        }
      }
    );
    // For the main color:
    this.addForkLineColorPickerMenuItem("Color", fork.color, fork, "color");

    // For the fill color (an empty string indicates no fill):
    this.addForkLineColorPickerMenuItem(
      "Fill Color",
      fork.fillColor || "",
      fork,
      "fillColor"
    );

    // Add a menu item to remove this fork line.
    this.addMenuItem(
      "Remove Fork Line",
      () => {
        options.forkLines!.splice(index, 1);
        if (this.saveDrawings) {
          this.saveDrawings();
        }
        // Return to the main fork line menu.
        this.populateForkLineMainMenu(event, drawing);
      },
      false,
      true
    );

    // Add a back button to return to the main fork line menu.
    this.addMenuItem(
      "⤝ Back",
      () => {
        this.populateForkLineMainMenu(event, drawing);
      },
      false,
      false
    );

    this.showMenu(event);
  }

  /**
   * Unified fork-line color picker menu item.
   *
   * @param label - Display label for the menu item.
   * @param currentColor - The current color value.
   * @param forkLine - The fork line object to update.
   * @param property - The property of the fork line to update ("color" or "fillColor").
   * @returns The created menu item HTMLElement.
   */
  private addForkLineColorPickerMenuItem(
    label: string,
    currentColor: string | null,
    forkLine: ForkLine,
    property: "color" | "fillColor"
  ): HTMLElement {
    const menuItem = document.createElement("span");
    menuItem.classList.add("context-menu-item");
    menuItem.innerText = label;

    this.div.appendChild(menuItem);

    const applyColor = (newColor: string) => {
      forkLine[property] = newColor;
      console.log(`Updated fork line ${property} to ${newColor}`);
      if (this.saveDrawings) {
        this.saveDrawings();
      }
    };

    menuItem.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      if (!this.colorPicker) {
        this.colorPicker = new seriesColorPicker(
          currentColor ?? "#000000",
          applyColor
        );
      }
      this.colorPicker.openMenu(event, 225, applyColor);
    });

    return menuItem;
  }
}
