// ----------------------------------
// External Library Imports
// ----------------------------------
import {
  CandlestickSeriesOptions,
  ColorType,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  LineStyle,
  MouseEventParams,
  PriceScaleMode,
  PriceScaleOptions,

  SeriesType,
  SolidColor,
  VerticalGradientColor,
  Background,

} from 'lightweight-charts';

// ----------------------------------
// Internal Helpers and Types
// ----------------------------------
import { cloneSeriesAsType, SupportedSeriesType } from '../helpers/series';
import {
  ensureExtendedSeries,
  isCandleShape,
  isFillArea,
  isOHLCData,
  isSingleValueData,
  isSolidColor,
  isVerticalGradientColor,
} from '../helpers/typeguards';
import {
  AreaSeriesOptions,
  BarSeriesOptions,
  ISeriesApiExtended,
  LineSeriesOptions,
  SeriesOptionsExtended,
} from '../helpers/general';

// ----------------------------------
// General Modules
// ----------------------------------
import { GlobalParams } from '../general/global-params';
import { Handler } from '../general/handler';

// ----------------------------------
// Drawing and Chart Extensions
// ----------------------------------
import { DrawingTool } from '../drawing/drawing-tool';
import { Drawing } from '../drawing/drawing';
import { DrawingOptions } from '../drawing/options';
import { FillArea, defaultFillAreaOptions } from '../fill-area/fill-area';

// ----------------------------------
// UI Components
// ----------------------------------
import { ColorPicker } from './color-picker';
import { ColorPicker as seriesColorPicker } from './color-picker_';
import { StylePicker } from './style-picker';

// ----------------------------------
// Specialized Data
// ----------------------------------
import { CandleShape } from '../ohlc-series/data';
import { buildOptions, camelToTitle } from '../helpers/formatting';

// ----------------------------------
// If you have actual code referencing commented-out or removed imports,
// reintroduce them accordingly.
// ----------------------------------

export let activeMenu: HTMLElement | null = null;

interface Item {
  elem: HTMLSpanElement;
  action: Function;
  closeAction: Function | null;
}

declare const window: GlobalParams;

export class ContextMenu {
  private div: HTMLDivElement;
  private hoverItem: Item | null;
  private items: HTMLElement[] = [];
  private colorPicker: seriesColorPicker = new seriesColorPicker(
    "#ff0000",
    () => null
  );
  private saveDrawings: Function | null = null;
  private drawingTool: DrawingTool | null = null;
  ///private globalTooltipEnabled: boolean = false;
  ///private Tooltip: TooltipPrimitive | null = null;
  ///private currentTooltipSeries: ISeriesApiExtended | null = null;


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
      seriesType: { skip: true },

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

  constructor(
    private handler: Handler,
    private handlerMap: Map<string, Handler>,
    private getMouseEventParams: () => MouseEventParams | null
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

    console.log("Mouse Event Params:", mouseEventParams);
    console.log("Proximity Series:", seriesFromProximity);
    console.log("Proximity Drawing:", drawingFromProximity);

    this.clearMenu(); // Clear existing menu items
    this.clearAllMenus(); // Clear other menus if necessary

    if (seriesFromProximity) {
      // Right-click on a series
      console.log("Right-click detected on a series (proximity).");
      this.populateSeriesMenu(seriesFromProximity, event);
    } else if (drawingFromProximity) {
      // Right-click on a drawing
      console.log("Right-click detected on a drawing.");
      this.populateDrawingMenu(drawingFromProximity, event);
    } else if (mouseEventParams?.hoveredSeries) {
      // Fallback to hovered series
      console.log("Right-click detected on a series (hovered).");
      this.populateSeriesMenu(mouseEventParams.hoveredSeries, event);
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
  private getProximitySeries(
    param: MouseEventParams
  ): ISeriesApi<SeriesType> | null {
    if (!param || !param.seriesData) {
      console.warn("No mouse event parameters or series data available.");
      return null;
    }

    if (!param.point) {
      console.warn("No point data in MouseEventParams.");
      return null;
    }

    const cursorY = param.point.y;
    let sourceSeries: ISeriesApi<SeriesType> | null = null;
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
      series: ISeriesApi<SeriesType>;
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
          seriesByDistance.push({ distance, series });
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

  private showMenu(event: MouseEvent): void {
    const x = event.clientX;
    const y = event.clientY;

    this.div.style.position = "absolute";
    this.div.style.zIndex = "1000";
    this.div.style.left = `${x}px`;
    this.div.style.top = `${y}px`;
    this.div.style.width = "250px";
    this.div.style.maxHeight = `400px`;
    this.div.style.overflowY = "hidden";
    this.div.style.display = "block";
    this.div.style.overflowX = "hidden"
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

  private hideMenu() {
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
      step
    });
  }

  private addCheckbox(
    label: string,
    defaultValue: boolean,
    onChange: (value: boolean) => void
  ): HTMLElement {
    return this.addMenuInput(this.div, {
      type: "boolean",
      label,
      value: defaultValue,
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

  private addMenuInput(
    parent: HTMLElement,
    config: {
      type: "string" | "color" | "number" | "boolean" | "select" | "hybrid";
      label: string;
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
        labelElem.innerText = config.label ? "Axis" : "Action";
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
        dropdown.style.zIndex = "1000";
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
          dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
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
        select.id = `${idPrefix}${config.label ? config.label.toLowerCase() : "select"
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
          option.style.textAlign = "right"
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
        input.style.textAlign = "center"
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


  private addMenuItem(
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
    };

    menuItem.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      if (!this.colorPicker) {
        this.colorPicker = new seriesColorPicker(currentColor ?? '#000000', applyColor);
      }
      this.colorPicker.openMenu(event, 225, applyColor);
    });

    return menuItem;
  }

  // Class-level arrays to store current options for width and style.
  private currentWidthOptions: {
    name: keyof (LineSeriesOptions &
      BarSeriesOptions &
      AreaSeriesOptions
    );
    label: string;
    min?: number;
    max?: number;
    value: number;
  }[] = [];

  private currentStyleOptions: {
    name: keyof (LineSeriesOptions &
      BarSeriesOptions &
      AreaSeriesOptions
    );
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


  private populateSeriesMenu(
    series: ISeriesApi<SeriesType> | ISeriesApiExtended,
    event: MouseEvent
  ): void {
    // Type guard to check if series is extended
    const _series = ensureExtendedSeries(series, this.handler.legend)

    // Now `series` is guaranteed to be extended
    const seriesOptions = series.options() as Partial<
      LineSeriesOptions &
      BarSeriesOptions &
      AreaSeriesOptions &
      CandlestickSeriesOptions &
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
      name: keyof (LineSeriesOptions &
        BarSeriesOptions &
        AreaSeriesOptions);
      label: string;
      value: number;
      min?: number;
      max?: number;
      step?: number;
    }[] = [];

    const tempStyleOptions: {
      name: keyof (LineSeriesOptions &
        BarSeriesOptions &
        AreaSeriesOptions
      );
      label: string;
      value: string | number;
      options?: string[];
    }[] = [];

    for (const optionName of Object.keys(seriesOptions) as Array<
      keyof (LineSeriesOptions &
        BarSeriesOptions &
        AreaSeriesOptions
      )
    >) {
      const optionValue = seriesOptions[optionName];
      if (this.shouldSkipOption(optionName)) continue;
      if (optionName.toLowerCase().includes("base")) continue;

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
        if (typeof optionValue === 'number') {
          let minVal = 1;
          let maxVal = 10;
          let step = 1;

          // If this property is specifically "radius", make it 0..1
          if (lowerOptionName.includes('radius')) {
            minVal = 0;
            maxVal = 1;
            step = 0.1
          }

          // Add it to your "width" options array with the specialized range
          tempWidthOptions.push({
            name: optionName,
            label: optionName,
            value: optionValue,
            min: minVal,
            max: maxVal,
            step: step
          });
        }
      }

      else if (
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
        const possibleLineTypes = this.getPredefinedOptions(camelToTitle(optionName))!;
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
      }// Example: handle shape if "shape" is in the name
      else if (lowerOptionName.includes('shape')) {
        // If we confirm it's a recognized CandleShape
        if (isCandleShape(optionValue)) {
          const predefinedShapes = ['Rectangle', 'Rounded', 'Ellipse', 'Arrow', '3d', 'Polygon'];
          if (predefinedShapes) {
            tempStyleOptions.push({
              name: optionName,
              label: optionName,
              value: optionValue as CandleShape,  // This is guaranteed CandleShape now
              options: predefinedShapes,
            });
          }
        }
      }

      else {
        // Other options go directly to otherOptions
        otherOptions.push({ label: optionName, value: optionValue });
      }
    }

    // Assign the temp arrays to class-level arrays for use in submenus
    this.currentWidthOptions = tempWidthOptions;
    this.currentStyleOptions = tempStyleOptions;

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


    // Add "Fill Area Between" menu option
    this.addMenuItem(
      "Fill Area Between",
      () => {
        this.startFillAreaBetween(event, _series); // Define the method below
      },
      false,
      false
    );


    // Access the primitives
    const primitives = _series.primitives;

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

  private populateDrawingMenu(drawing: Drawing, event: MouseEvent): void {
    this.div.innerHTML = ""; // Clear existing menu items

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

    const onClickDelete = () => this.drawingTool!.delete(drawing);
    this.separator();
    this.menuItem("Delete Drawing", onClickDelete);

    // Optionally, add a back button or main menu option
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
        this.populateSeriesListMenu(event, false, (destinationSeries: ISeriesApi<SeriesType>) => {
          this.populateSeriesMenu(destinationSeries, event)
        })
      }, false, true
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

    this.showMenu(event);
  }
  private populateLayoutMenu(event: MouseEvent): void {
    // Clear the menu
    this.div.innerHTML = "";

    // Text Color Option
    const textColorOption = { name: "Text Color", valuePath: "layout.textColor" };
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
    this.handler.chart.applyOptions({ layout: { background: updatedBackground } });

    // Repopulate the Layout Menu with the new background type's options
    this.populateLayoutMenu(event);
  }

  private populateWidthMenu(event: MouseEvent, series: ISeriesApi<any>): void {
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
  private populateStyleMenu(event: MouseEvent, series: ISeriesApi<any>): void {
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
                "Solid":         0,
                "Dotted":        1,
                "Dashed":        2,
                "Large Dashed":  3,
                "Sparse Dotted": 4
              };
              finalValue = lineStyleMap[newValue] ?? 0; // fallback to Solid (0)
            }
            // If the option name indicates it's a line type, map string => numeric
            else if (option.name.toLowerCase().includes("linetype")) {
              const lineTypeMap: Record<string, number> = {
                "Simple":    0,
                "WithSteps": 1,
                "Curved":    2
              };
              finalValue = lineTypeMap[newValue] ?? 0; // fallback to Simple (0)
            }

            // Build the updated options object
            const updatedOptions = buildOptions(option.name, finalValue);
            series.applyOptions(updatedOptions);
            console.log(`Updated ${option.name} to "${newValue}" =>`, finalValue);
          }
        );
      } else {
        console.warn(`No predefined options found for "${option.name}".`);
      }
    });

    // Add a Back option
    this.addMenuItem("⤝ Back", () => {
      this.populateSeriesMenu(series, event);
    });

    this.showMenu(event);
  }



  private populateCloneSeriesMenu(
    series: ISeriesApi<SeriesType>,
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
          const clonedSeries = cloneSeriesAsType(series, this.handler, type, {});
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
    series: ISeriesApi<any>,
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
    series: ISeriesApi<any>
  ): void {
    this.div.innerHTML = "";

    const seriesOptions = series.options() as Partial<
      LineSeriesOptions &
      BarSeriesOptions &
      AreaSeriesOptions

    >;

    const visibilityOptionNames: Array<
      keyof (LineSeriesOptions &
        BarSeriesOptions &
        AreaSeriesOptions
      )
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
      const currentValue = this.getCurrentOptionValue(option.valuePath) ?? option.defaultValue;

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
            const updatedOptions = buildOptions(option.valuePath!, selectedIndex);
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
        step: 0.1
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
          (this.getCurrentOptionValue(option.valuePath!) as string) || "#000000";
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
    series?: ISeriesApi<any>
  ): void {
    this.div.innerHTML = ""; // Clear current menu

    if (series) {
      // Option to switch the price scale for the series
      this.addMenuItem(
        "Switch Series Price Scale",
        () => {
          const newPriceScaleId = priceScaleId === "left" ? "right" : "left";
          series.applyOptions({ priceScaleId: newPriceScaleId });
          console.log(`Series price scale switched to: ${newPriceScaleId}`);
          this.populatePriceScaleMenu(event, newPriceScaleId, series);
        },
        false,
        false
      );
    }

    // Dropdown for Price Scale Mode
    const currentMode: PriceScaleMode =
      this.handler.chart.priceScale(priceScaleId).options().mode ?? PriceScaleMode.Normal;

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
        const selectedOption = modeOptions.find((opt) => opt.label === newLabel);
        if (selectedOption) {
          this.applyPriceScaleOptions(priceScaleId, { mode: selectedOption.value });
          console.log(`Price scale (${priceScaleId}) mode set to: ${newLabel}`);
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
          console.log(`Price scale (${priceScaleId}) autoScale set to: ${newValue}`);
        },
      },
      {
        name: "Invert Scale",
        value: options.invertScale ?? false,
        action: (newValue: boolean) => {
          this.applyPriceScaleOptions(priceScaleId, { invertScale: newValue });
          console.log(`Price scale (${priceScaleId}) invertScale set to: ${newValue}`);
        },
      },
      {
        name: "Align Labels",
        value: options.alignLabels ?? true,
        action: (newValue: boolean) => {
          this.applyPriceScaleOptions(priceScaleId, { alignLabels: newValue });
          console.log(`Price scale (${priceScaleId}) alignLabels set to: ${newValue}`);
        },
      },
      {
        name: "Border Visible",
        value: options.borderVisible ?? true,
        action: (newValue: boolean) => {
          this.applyPriceScaleOptions(priceScaleId, { borderVisible: newValue });
          console.log(`Price scale (${priceScaleId}) borderVisible set to: ${newValue}`);
        },
      },
      {
        name: "Ticks Visible",
        value: options.ticksVisible ?? false,
        action: (newValue: boolean) => {
          this.applyPriceScaleOptions(priceScaleId, { ticksVisible: newValue });
          console.log(`Price scale (${priceScaleId}) ticksVisible set to: ${newValue}`);
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
  private startFillAreaBetween(event: MouseEvent, originSeries: ISeriesApiExtended): void {
    console.log("Fill Area Between started. Origin series set:", originSeries.options().title);

    // Ensure the series is decorated

    // Populate the Series List Menu
    this.populateSeriesListMenu(event, false, (destinationSeries: ISeriesApi<any>) => {
      if (destinationSeries && destinationSeries !== originSeries) {
        console.log("Destination series selected:", destinationSeries.options().title);

        // Ensure the destination series is also decorated

        // Instantiate and attach the FillArea
        originSeries.primitives["FillArea"] = new FillArea(originSeries, destinationSeries, {
          ...defaultFillAreaOptions,
        });
        originSeries.attachPrimitive(originSeries.primitives['FillArea'], `Fill Area ⥵ ${destinationSeries.options().title}`, false, true)
        // Attach the FillArea as a primitive
        //if (!originSeries.primitives['FillArea']) {
        //  originSeries.attachPrimitive(originSeries.primitives["FillArea"])
        //}
        console.log("Fill Area successfully added between selected series.");
        alert(`Fill Area added between ${originSeries.options().title} and ${destinationSeries.options().title}`);
      } else {
        alert("Invalid selection. Please choose a different series as the destination.");
      }
    });
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
      "seriesType": ["Line", "Histogram", "Area", "Bar", "Candlestick"],
      "lineStyle": [
        "Solid",
        "Dotted",
        "Dashed",
        "Large Dashed",
        "Sparse Dotted",
      ],
      "Price Line Style": [
        "Solid",
        "Dotted",
        "Dashed",
        "Large Dashed",
        "Sparse Dotted",
      ],
      "lineType": ["Simple", "WithSteps", "Curved"],
      "Shape": ['Rectangle', 'Rounded', 'Ellipse', 'Arrow', '3d', 'Polygon'],
      "Candle Shape": ['Rectangle', 'Rounded', 'Ellipse', 'Arrow', '3d', 'Polygon']

    };

    return predefined[camelToTitle(label)] || null;
  }
  /**
   * Populates the Series List Menu for selecting the destination series.
   * @param onSelect Callback when a series is selected.
   */
  private populateSeriesListMenu(
    event: MouseEvent,
    hideMenu: boolean,
    onSelect: (series: ISeriesApi<any>) => void
  ): void {
    this.div.innerHTML = ""; // Clear the current menu

    // 1) Gather all series from your `handler.seriesMap`.
    const mappedSeries = Array.from(this.handler.seriesMap.entries()).map(
      ([seriesName, series]) => ({
        label: seriesName,
        value: series,
      })
    );

    // 2) Optionally prepend `this.handler.series` if it exists
    let seriesOptions = mappedSeries;
    if (this.handler.series) {
      // Only prepend if `this.handler.series` is truthy
      const mainSeriesItem = {
        label: "Main Series",
        value: this.handler.series,
      };
      seriesOptions = [mainSeriesItem, ...mappedSeries];
    }

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

    // Show the menu at the current mouse position
    this.showMenu(event);
  }


  private customizeFillAreaOptions(event: MouseEvent, FillArea: ISeriesPrimitive): void {
    this.div.innerHTML = ""; // Clear current menu
    if (isFillArea(FillArea)) {
      // Add color pickers for each color-related option
      this.addColorPickerMenuItem(
        "Origin Top Color",
        FillArea.options.originColor,
        "originColor",
        FillArea
      );


      this.addColorPickerMenuItem(
        "Destination Top Color",
        FillArea.options.destinationColor,
        "destinationColor",
        FillArea
      );


      // Back to main menu
      this.addMenuItem("⤝ Back to Main Menu", () => this.populateChartMenu(event), false);

      this.showMenu(event);
    }
  }


  public addResetViewOption(): void {
    const resetMenuItem = this.addMenuInput(this.div, {
      type: "hybrid",
      label: "∟ Reset",
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
    })
    this.div.appendChild(resetMenuItem);
  }

}
