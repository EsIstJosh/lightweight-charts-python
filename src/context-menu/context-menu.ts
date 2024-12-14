import {
  Background,
  ColorType,
  IChartApi,
  ISeriesApi,
  LineStyle,
  MouseEventParams,
  SeriesType,
  SolidColor,
  VerticalGradientColor,
  PriceScaleMode,
  PriceScaleOptions,
  CandlestickSeriesOptions,
} from "lightweight-charts";
import { DrawingTool } from "../drawing/drawing-tool";
import { ColorPicker as seriesColorPicker } from "./color-picker_";
import { ColorPicker } from "./color-picker";
import {
  AreaSeriesOptions,
  BarSeriesOptions,
  LineSeriesOptions,
  ISeriesApiExtended,
  SeriesOptionsExtended
} from "../helpers/general";
import { GlobalParams } from "../general/global-params";
//import { TooltipPrimitive } from "../tooltip/tooltip";
import { StylePicker } from "./style-picker";
import { Drawing } from "../drawing/drawing";
import { DrawingOptions } from "../drawing/options";
import { FillArea, defaultFillAreaOptions} from "../fill-area/fill-area";
import { ensureExtendedSeries, isOHLCData, isSingleValueData, isSolidColor, isVerticalGradientColor } from "../helpers/typeguards";

import { Handler } from "../general/handler";
export function buildOptions(optionPath: string, value: any): any {
  const keys = optionPath.split(".");
  const options: any = {};
  let current = options;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      current[key] = {};
      current = current[key];
    }
  }

  return options;
}

// series-types.ts
export enum SeriesTypeEnum {
  Line = "Line",
  Histogram = "Histogram",
  Area = "Area",
  Bar = "Bar",
  Candlestick = "Candlestick",
}

export type SupportedSeriesType = keyof typeof SeriesTypeEnum;
export let activeMenu: HTMLElement | null = null;

/**
 * Closes the currently active menu.
 */
export function closeActiveMenu() {
  if (activeMenu) {
    activeMenu.style.display = "none";
    activeMenu = null;
  }
}

/**
 * Utility function to convert camelCase to Title Case
 * @param inputString The camelCase string.
 * @returns The Title Case string.
 */
export function camelToTitle(inputString: string): string {
  return inputString
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}

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

  private mouseEventParams: MouseEventParams | null = null;

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
    this.mouseEventParams = getMouseEventParams();
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
    this.div.style.width = "225px";
    this.div.style.maxHeight = `400px`;
    this.div.style.overflowY = "scroll";
    this.div.style.display = "block";

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

  private resetView(): void {
    this.handler.chart.timeScale().resetTimeScale();
    this.handler.chart.timeScale().fitContent();
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
    max?: number
  ): HTMLElement {
    return this.addMenuInput(
      this.div,
      {
        type: "number",
        label,
        value: defaultValue,
        onChange,
        min,
        max,
      },
      ""
    );
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

  private addMenuInput(
    parent: HTMLElement,
    config: {
      type: "string" | "color" | "number" | "boolean" | "select";
      label: string;
      value: any;
      onChange: (newValue: any) => void;
      action?: () => void;
      min?: number;
      max?: number;
      options?: string[];
    },
    idPrefix: string = ""
  ): HTMLElement {
    let item: HTMLElement;

    if (
      config.type === "number" ||
      config.type === "string" ||
      config.type === "boolean"
    ) {
      item = document.createElement("div");
      item.classList.add("context-menu-item");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "space-between";

      if (config.label) {
        const label = document.createElement("label");
        label.innerText = config.label;
        label.htmlFor = `${idPrefix}${config.label.toLowerCase()}`;
        label.style.marginRight = "8px";
        item.appendChild(label);
      }

      let input: HTMLInputElement;

      if (config.type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = config.value !== undefined ? config.value.toString() : "";
        input.style.width = "45px";
        input.style.marginLeft = "auto";
        input.style.cursor = "pointer";

        if (config.min !== undefined) {
          input.min = config.min.toString();
        }
        if (config.max !== undefined) {
          input.max = config.max.toString();
        }

        input.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          let newValue: number = parseFloat(target.value);
          const optionName = config.label;
          const constraints = this.constraints[optionName.toLowerCase()];

          if (constraints && !constraints.skip) {
            if (constraints.min !== undefined && newValue < constraints.min) {
              newValue = constraints.min;
              input.value = newValue.toString();
            }
            if (constraints.max !== undefined && newValue > constraints.max) {
              newValue = constraints.max;
              input.value = newValue.toString();
            }
          }

          if (!isNaN(newValue)) {
            config.onChange(newValue);
          }
        });

        item.appendChild(input);
      } else if (config.type === "boolean") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = config.value ?? false;
        input.style.marginLeft = "auto";
        input.style.cursor = "pointer";

        input.addEventListener("change", (event) => {
          const target = event.target as HTMLInputElement;
          config.onChange(target.checked);
        });

        item.appendChild(input);
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = config.value ?? "";
        input.style.marginLeft = "auto";
        input.style.cursor = "pointer";

        input.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          config.onChange(target.value);
        });

        item.appendChild(input);
      }
    } else if (config.type === "select") {
      item = document.createElement("div");
      item.classList.add("context-menu-item");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "space-between";

      if (config.label) {
        const label = document.createElement("label");
        label.innerText = config.label;
        label.htmlFor = `${idPrefix}${config.label.toLowerCase()}`;
        label.style.marginRight = "8px";
        item.appendChild(label);
      }

      const select = document.createElement("select");
      select.id = `${idPrefix}${
        config.label ? config.label.toLowerCase() : "select"
      }`;
      select.style.marginLeft = "auto";
      select.style.cursor = "pointer";

      config.options?.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.text = optionValue;
        if (optionValue === config.value) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      select.addEventListener("change", (event) => {
        const target = event.target as HTMLSelectElement;
        if (config.onChange) {
          config.onChange(target.value);
        }
      });

      item.appendChild(select);
    } else {
      item = document.createElement("span");
      item.classList.add("context-menu-item");
      item.innerText = config.label || "Action";
      item.style.cursor = "pointer";

      item.addEventListener("click", (event) => {
        event.stopPropagation();
        config.action && config.action();
      });
    }

    parent.appendChild(item);
    return item;
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
        hoverArrow.style.fontSize = "14px";
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
    currentColor: string|null,
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
        this.colorPicker = new seriesColorPicker(currentColor??'#000000', applyColor);
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
    const _series = ensureExtendedSeries(series,this.handler.legend)
  
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
        AreaSeriesOptions );
      label: string;
      value: number;
      min?: number;
      max?: number;
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

      if (lowerOptionName.includes("color")) {
        // Color options
        if (typeof optionValue === "string") {
          colorOptions.push({ label: optionName, value: optionValue });
        } else {
          console.warn(
            `Expected string value for color option "${optionName}".`
          );
        }
      } else if (lowerOptionName.includes("width")) {
        // Width options
        // This includes things like lineWidth, priceLineWidth, crosshairMarkerBorderWidth, etc.
        if (typeof optionValue === "number") {
          tempWidthOptions.push({
            name: optionName,
            label: optionName,
            value: optionValue,
          });
        } else {
          console.warn(
            `Expected number value for width option "${optionName}".`
          );
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
        } else {
          console.warn(
            `Expected string/number value for style-related option "${optionName}".`
          );
        }
      } else {
        // Other options go directly to otherOptions
        otherOptions.push({ label: optionName, value: optionValue });
      }
    }

    // Assign the temp arrays to class-level arrays for use in submenus
    this.currentWidthOptions = tempWidthOptions;
    this.currentStyleOptions = tempStyleOptions;

   

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
    //const tooltipLabel = this.globalTooltipEnabled
    //  ? "Disable Global Tooltip"
    //  : "Enable Global Tooltip";
    //this.addMenuItem(tooltipLabel, () => {
    //  this.globalTooltipEnabled = !this.globalTooltipEnabled;
//
    //  if (!this.globalTooltipEnabled) {
    //    // Detach tooltip from current series
    //    this.Tooltip?.detached();
    //  } else {
    //    // Reattach tooltip to the closest series if applicable
    //    const series = this.getProximitySeries(this.mouseEventParams!);
    //    if (series) {
    //      let _series = ensureExtendedSeries(series, this.handler.legend)
    //      this.switchTooltipToSeries(_series);
    //    }
    //  }
    //});

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
    this.div.innerHTML = "";
    const layoutOptions = { name: "Text Color", valuePath: "layout.textColor" };
    const initialColor =
      (this.getCurrentOptionValue(layoutOptions.valuePath) as string) ||
      "#000000";

    // Layout text color
    this.addColorPickerMenuItem(
      camelToTitle(layoutOptions.name),
      initialColor,
      layoutOptions.valuePath,
      this.handler.chart
    );

    // If you intended to show a background menu with "Type & Colors" and "Options":
    // Call populateBackgroundMenu, not populateBackgroundOptionsMenu directly.
    this.addMenuItem(
      "Background Options",
      () => this.populateBackgroundMenu(event),
      false,
      true
    );

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
    this.div.innerHTML = ""; // Clear current menu
  
    this.currentStyleOptions.forEach((option) => {
      const predefinedOptions = this.getPredefinedOptions(option.name);
  
      if (predefinedOptions) {
        // Use a dropdown for options with predefined values
        this.addSelectInput(
          camelToTitle(option.name), // Display a human-readable label
          option.value.toString(), // Current value of the option
          predefinedOptions, // Predefined options for the dropdown
          (newValue: string) => {
            const newVal = predefinedOptions.indexOf(newValue); // Map new value to its index
            const options = buildOptions(option.name, newVal); // Build the updated options
            series.applyOptions(options); // Apply the new options to the series
            console.log(`Updated ${option.name} to ${newValue}`);
          }
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
private populateLineTypeMenu(
  event: MouseEvent,
  series: ISeriesApi<any>,
  option: {
    name: keyof (LineSeriesOptions &
      BarSeriesOptions &
      AreaSeriesOptions);
    label: string;
    value: string | number;
    options?: string[];
  }
) {
  this.div.innerHTML = ""; // Clear current menu

  if (!option.options) return;

  // Use the addSelectInput method to add a dropdown
  this.addSelectInput(
    option.label, // Label for the dropdown
    option.value.toString(), // Current value as string
    option.options, // List of options
    (newValue: string) => {
      const newVal = newValue === "Simple" ? 0 : 1; // Map option to value (you can adjust this logic)
      const options = buildOptions(option.name, newVal);
      series.applyOptions(options);
      console.log(`Updated ${option.label} to ${newValue}`);
    }
  );

  // Add a "Back" button to navigate to the Style Options menu
  this.addMenuItem(
    "⤝ Back to Style Options",
    () => {
      this.populateStyleMenu(event, series);
    },
    false
  );

  this.showMenu(event); // Display the menu
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
    container.appendChild(labelElem);

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.id = `${label.toLowerCase()}-input`;
    input.style.flex = "1";
    input.style.marginLeft = "auto";
    input.style.cursor = "pointer";

    input.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      onChange(target.value);
    });

    container.appendChild(input);

    this.div.appendChild(container);

    return container;
  }

  private addSelectInput(
    label: string,
    currentValue: string,
    options: string[],
    onSelectChange: (newValue: string) => void
  ): void {
    const selectContainer = document.createElement("div");
    selectContainer.className = "menu-item select-input";

    const selectLabel = document.createElement("span");
    selectLabel.innerText = label;
    selectContainer.appendChild(selectLabel);

    const selectField = document.createElement("select");
    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.text = option;
      if (option === currentValue) {
        optionElement.selected = true;
      }
      selectField.appendChild(optionElement);
    });
    selectField.addEventListener("change", (e) => {
      const newValue = (e.target as HTMLSelectElement).value;
      onSelectChange(newValue);
    });
    selectContainer.appendChild(selectField);

    this.div.appendChild(selectContainer);
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
    this.div.innerHTML = "";

    const gridOptions = [
      { name: "Vertical Grid Color", valuePath: "grid.vertLines.color" },
      { name: "Horizontal Grid Color", valuePath: "grid.horzLines.color" },
    ];

    gridOptions.forEach((option) => {
      const initialColor =
        (this.getCurrentOptionValue(option.valuePath) as string) || "#FFFFFF";
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
    this.div.innerHTML = "";

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
        name: "Fix Left Edge",
        type: "boolean",
        valuePath: "timeScale.fixLeftEdge",
      },
      {
        name: "Border Color",
        type: "color",
        valuePath: "timeScale.borderColor",
      },
    ];

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

    this.showMenu(event);

    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );
  }

  private populatePriceScaleMenu(
    event: MouseEvent,
    priceScaleId: "left" | "right" = "right"
  ): void {
    this.div.innerHTML = "";



    this.addMenuItem(
      "Set Price Scale Mode",
      () => {
        this.populatePriceScaleModeMenu(event, priceScaleId);
      },
      true,
      true,
      1
    );

    this.addMenuItem(
      "⤝ Main Menu",
      () => {
        this.populateChartMenu(event);
      },
      false
    );

    this.showMenu(event);
  }



  private populatePriceScaleModeMenu(
    event: MouseEvent,
    priceScaleId: "left" | "right"
  ): void {
    this.div.innerHTML = "";

    const currentMode: PriceScaleMode =
      this.handler.chart.priceScale(priceScaleId).options().mode ??
      PriceScaleMode.Normal;

    const modeOptions: { name: string; value: PriceScaleMode }[] = [
      { name: "Normal", value: PriceScaleMode.Normal },
      { name: "Logarithmic", value: PriceScaleMode.Logarithmic },
      { name: "Percentage", value: PriceScaleMode.Percentage },
      { name: "Indexed To 100", value: PriceScaleMode.IndexedTo100 },
    ];

    modeOptions.forEach((option) => {
      const isActive = currentMode === option.value;

      this.addMenuItem(
        option.name,
        () => {
          this.applyPriceScaleOptions(priceScaleId, { mode: option.value });
          this.hideMenu();
          console.log(
            `Price scale (${priceScaleId}) mode set to: ${option.name}`
          );
        },
        isActive,
        false // Not a submenu
      );
    });

    this.addMenuItem(
      "⤝ Back",
      () => {
        this.populatePriceScaleMenu(event, priceScaleId);
      },
      false, // Not active
      false, // Not a submenu
      1 // Add separator space
    );

    this.showMenu(event);
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

  //// Class properties assumed to exist
  //private handleCrosshairMove(param: MouseEventParams): void {
  //  if (!this.globalTooltipEnabled) {
  //    return;
  //  }
//
  //  const closestSeries = this.getProximitySeries(param);
//
  //  // Only switch if the closest series has changed
  //  if (closestSeries && closestSeries !== this.currentTooltipSeries) {
  //    let _series = ensureExtendedSeries(closestSeries, this.handler.legend)
//
  //    this.switchTooltipToSeries(_series);
  //  }
  //}
//
  //
//
  //private switchTooltipToSeries(series: ISeriesApiExtended | null): void {
  //  if (series === this.currentTooltipSeries) {
  //    return; // Already attached to the same series
  //  }
//
  // 
  //  if (series) {
  //    this.attachTooltipToSeries(series);
  //  } else {
  //    this.currentTooltipSeries = null;
  //  }
  //}
 

  private mapStyleChoice(choice: string): number {
    switch (choice) {
      case "Solid":
        return 0;
      case "Dotted":
        return 1;
      case "Dashed":
        return 2;
      case "Large Dashed":
        return 3;
      case "Sparse Dotted":
        return 4;
      default:
        return 0;
    }
  }
//
//  private attachTooltipToSeries(series: ISeriesApiExtended): void {
//    if (!this.Tooltip) {
//      this.Tooltip = new TooltipPrimitive({ lineColor: "rgba(255, 0, 0, 1)" });
//    }
//
//    this.Tooltip.switch(series); // Call the `switch(series)` method
//    this.currentTooltipSeries = series;
//
//    console.log(
//      `Tooltip switched to series: ${series.options().title || "Untitled"}`
//    );
//  }
//

  private setBackgroundType(event: MouseEvent, type: ColorType): void {
    const currentBackground = this.handler.chart.options().layout?.background;
    let updatedBackground: Background;

    if (type === ColorType.Solid) {
      updatedBackground = isSolidColor(currentBackground)
        ? { type: ColorType.Solid, color: currentBackground.color }
        : { type: ColorType.Solid, color: "#FFFFFF" };
    } else if (type === ColorType.VerticalGradient) {
      updatedBackground = isVerticalGradientColor(currentBackground)
        ? {
            type: ColorType.VerticalGradient,
            topColor: currentBackground.topColor,
            bottomColor: currentBackground.bottomColor,
          }
        : {
            type: ColorType.VerticalGradient,
            topColor: "#FFFFFF",
            bottomColor: "#000000",
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
    this.populateSeriesListMenu(event, (destinationSeries: ISeriesApi<any>) => {
        if (destinationSeries && destinationSeries !== originSeries) {
            console.log("Destination series selected:", destinationSeries.options().title);

            // Ensure the destination series is also decorated

            // Instantiate and attach the FillArea
            originSeries.primitives["FillArea"] = new FillArea(originSeries, destinationSeries, {
                ...defaultFillAreaOptions,
            });
            originSeries.attachPrimitive(originSeries.primitives['FillArea'],"Fill Area")
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
    "lineType": ["Simple", "WithSteps", "Curved"],
  };

  return predefined[camelToTitle(label)] || null;
}
/**
 * Populates the Series List Menu for selecting the destination series.
 * @param onSelect Callback when a series is selected.
 */
private populateSeriesListMenu(event: MouseEvent, onSelect: (series: ISeriesApi<any>) => void): void {
    this.div.innerHTML = ""; // Clear the current menu

    // Fetch all available series
    const seriesOptions = Array.from(this.handler.seriesMap.entries()).map(([seriesName, series]) => ({
        label: seriesName,
        value: series,
    }));

    // Display series in the menu
    seriesOptions.forEach((option) => {
        this.addMenuItem(option.label, () => {
            // Call the onSelect callback with the selected series
            onSelect(option.value);
            this.hideMenu(); // Close the menu after selection
        });
    });

    // Add a "Cancel" option to go back or exit
    this.addMenuItem("Cancel", () => {
        console.log("Operation canceled.");
        this.hideMenu();
    });

    this.showMenu(event); // Show the menu at the current mouse position
}

private customizeFillAreaOptions(event: MouseEvent, FillArea: FillArea): void {
  this.div.innerHTML = ""; // Clear current menu

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


  public addResetViewOption(): void {
    const resetMenuItem = this.addMenuItem("Reset chart view     ⟲", () => {
      this.resetView();
    });
    this.div.appendChild(resetMenuItem);
  }

}
