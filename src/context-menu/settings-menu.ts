import {
  ColorType,
  CrosshairMode,
  HistogramData,
  ISeriesApi,
  ISeriesPrimitive,
  LineStyle,
  LineWidth,
  PriceScaleMode,
  SeriesType,
  Time,
} from "lightweight-charts";
import { ColorPicker } from "./color-picker_"; // Or wherever your color picker is
import { GlobalParams } from "../general/global-params";
import { Handler } from "../general";
import { findColorOptions, getAlphaFromColor, setOpacity } from "../helpers/colors";
import { DataMenu } from "./data-menu";
import { isWhitespaceData } from "../helpers/typeguards";
import { ISeriesApiExtended } from "../helpers/series";
declare const window: GlobalParams;

/**
 * A multi-panel Settings modal that replicates the layout of TradingView’s “Chart Settings”:
 * - Left-hand navigation with categories
 * - Right-hand content panel for relevant settings
 * - Bottom row with “Template”, “Cancel”, and “Ok” buttons
 */
export class SettingsModal {
  private container: HTMLDivElement;
  private backdrop: HTMLDivElement;
  private isOpen: boolean = false;

  // Left-nav categories and the right-hand content area.
  private categories: Array<{
    id: string;
    label: string;
    buildContent: () => void;
  }> = [];
  private contentArea: HTMLDivElement;
  private activeCategoryId: string = "";

  // A reference to the chart handler (or chart instance)
  private handler: Handler;

  // Optionally, a custom color picker component reference.
  private colorPicker: ColorPicker | null = null;
  private _originalOpacities: Record<string, { up: number; down: number }> = {};
  /**
   * Pass in your chart handler so that the modal controls can read and update chart options.
   */
  constructor(handler: any) {
    this.handler = handler;
    const defaultColors: string[] = Array.isArray(this.handler.defaultsManager.get('colors'))? [...this.handler.defaultsManager.get('colors')]: [];        
    this.colorPicker = new ColorPicker(
    "#ff0000",
    () => null,
    defaultColors && defaultColors.length !== 0? defaultColors:undefined 
  );
    // Create the backdrop
    this.backdrop = document.createElement("div");
    this.backdrop.style.position = "fixed";
    this.backdrop.style.top = "0";
    this.backdrop.style.left = "0";
    this.backdrop.style.width = "100%";
    this.backdrop.style.height = "100%";
    this.backdrop.style.backgroundColor = "rgba(0,0,0,0.5)";
    this.backdrop.style.opacity = "0";
    this.backdrop.style.transition = "opacity 0.3s ease";
    this.backdrop.style.zIndex = "9998"; // behind the modal
    this.backdrop.style.display = "none";
    this.backdrop.addEventListener("click", (e) => {
      // If clicked outside the modal, we can close or ignore
      if (e.target === this.backdrop) {
        this.close(false);
      }
    });
    document.body.appendChild(this.backdrop);

    // Create the main container (the modal itself)
    this.container = document.createElement("div");
    this.container.style.position = "fixed";
    this.container.style.top = "50%";
    this.container.style.left = "50%";
    this.container.style.transform = "translate(-50%, -50%)";
    this.container.style.width = "700px";
    this.container.style.maxWidth = "90%";
    this.container.style.height = "500px";
    this.container.style.maxHeight = "90%";
    this.container.style.backgroundColor = "#2B2B2B";
    this.container.style.color = "#FFF";
    this.container.style.borderRadius = "6px";
    this.container.style.boxShadow = "0 2px 10px rgba(0,0,0,0.8)";
    this.container.style.zIndex = "9999";
    this.container.style.opacity = "0";
    this.container.style.display = "none";
    this.container.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    document.body.appendChild(this.container);

    // Title bar with "Settings" and a close (×) button
    const titleBar = document.createElement("div");
    titleBar.style.display = "flex";
    titleBar.style.alignItems = "center";
    titleBar.style.justifyContent = "space-between";
    titleBar.style.padding = "12px 16px";
    titleBar.style.borderBottom = "1px solid #3C3C3C";

    const titleText = document.createElement("div");
    titleText.innerText = "Settings";
    titleText.style.fontSize = "16px";
    titleText.style.fontWeight = "bold";
    titleBar.appendChild(titleText);

    // “X” close button
    const closeBtn = document.createElement("div");
    closeBtn.innerText = "×";
    closeBtn.style.fontSize = "20px";
    closeBtn.style.cursor = "pointer";
    closeBtn.onclick = () => this.close(false);
    titleBar.appendChild(closeBtn);

    this.container.appendChild(titleBar);

    // Main content area: left nav and right content panel.
    const mainContent = document.createElement("div");
    mainContent.style.display = "flex";
    mainContent.style.flex = "1 1 auto";
    mainContent.style.height = "calc(100% - 50px)"; // subtract title and bottom bar
    this.container.appendChild(mainContent);

    // Left navigation panel
    const leftNav = document.createElement("div");
    leftNav.style.width = "150px";
    leftNav.style.borderRight = "1px solid #3C3C3C";
    leftNav.style.display = "flex";
    leftNav.style.flexDirection = "column";
    mainContent.appendChild(leftNav);

    // Right content panel
    this.contentArea = document.createElement("div");
    this.contentArea.style.flex = "1";
    this.contentArea.style.padding = "16px";
    this.contentArea.style.overflowY = "auto";
    mainContent.appendChild(this.contentArea);

    // Bottom bar with Template, Cancel, and Ok buttons.
    const bottomBar = document.createElement("div");
    bottomBar.style.borderTop = "1px solid #3C3C3C";
    bottomBar.style.display = "flex";
    bottomBar.style.alignItems = "center";
    bottomBar.style.justifyContent = "space-between";
    bottomBar.style.padding = "8px 12px";

    const templateBtn = document.createElement("button");
    templateBtn.innerText = "Template ▾";
    templateBtn.style.backgroundColor = "#444";
    templateBtn.style.color = "#FFF";
    templateBtn.style.border = "none";
    templateBtn.style.borderRadius = "4px";
    templateBtn.style.padding = "6px 12px";
    bottomBar.appendChild(templateBtn);

    const rightBtnContainer = document.createElement("div");
    rightBtnContainer.style.display = "flex";
    rightBtnContainer.style.gap = "8px";

    const cancelBtn = document.createElement("button");
    cancelBtn.innerText = "Cancel";
    cancelBtn.style.backgroundColor = "#444";
    cancelBtn.style.color = "#FFF";
    cancelBtn.style.border = "none";
    cancelBtn.style.borderRadius = "4px";
    cancelBtn.style.padding = "6px 12px";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.onclick = () => this.close(false);
    rightBtnContainer.appendChild(cancelBtn);

    const okBtn = document.createElement("button");
    okBtn.innerText = "Ok";
    okBtn.style.backgroundColor = "#008CBA";
    okBtn.style.color = "#FFF";
    okBtn.style.border = "none";
    okBtn.style.borderRadius = "4px";
    okBtn.style.padding = "6px 12px";
    okBtn.style.cursor = "pointer";
    okBtn.onclick = () => this.close(true);
    rightBtnContainer.appendChild(okBtn);

    bottomBar.appendChild(rightBtnContainer);
    this.container.appendChild(bottomBar);

    /***************************************
     * Define new left-nav categories (tabs)
     ***************************************/
    this.categories = [
      {
        id: "series-colors", // The main tab for color editing across *all* series
        label: "Series Colors",
        buildContent: () => this.buildSeriesColorsTab(),
      },
      {
        id: "primitive-colors", // The main tab for color editing across *all* series
        label: "Primitives Colors",
        buildContent: () => this.buildPrimitivesTab(),
      },
      
      // Your other tabs ...
      {
        id: "layout-options",
        label: "Layout Options",
        buildContent: () => this.buildLayoutOptionsTab(),
      },
      {
        id: "grid-options",
        label: "Grid Options",
        buildContent: () => this.buildGridOptionsTab(),
      },
      {
        id: "crosshair-options",
        label: "Crosshair Options",
        buildContent: () => this.buildCrosshairOptionsTab(),
      },
      {
        id: "time-scale-options",
        label: "Time Scale",
        buildContent: () => this.buildTimeScaleOptionsTab(),
      },
      {
        id: "price-scale-options",
        label: "Price Scale",
        buildContent: () => this.buildPriceScaleOptionsTab(),
      },
      {
        id: "defaults-list",
        label: "Defaults",
        buildContent: () => this.buildDefaultsListTab(),
      },
      {
        id: "source-code",
        label: "source-code",
        buildContent: () => this.buildSourceCodeTab(),
      },
    ];

    // Build the left-nav buttons
    this.categories.forEach((cat) => {
      const catBtn = document.createElement("div");
      catBtn.innerText = cat.label;
      Object.assign(catBtn.style, {
        padding: "8px 16px",
        cursor: "pointer",
        borderBottom: "1px solid #3C3C3C",
      });
      this.buildSeriesColorsTab();
      catBtn.addEventListener("click", () => this.switchCategory(cat.id));
      leftNav.appendChild(catBtn);
    });

    // Start with the first category active
    if (this.categories.length > 0) {
      this.switchCategory(this.categories[0].id);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1) Show / Hide Modal
  // ─────────────────────────────────────────────────────────────
  public open() {
    if (this.isOpen) return;
    this.isOpen = true;

    // Show the backdrop
    this.backdrop.style.display = "block";
    setTimeout(() => {
      this.backdrop.style.opacity = "1";
    }, 10);

    // Show the container
    this.container.style.display = "block";
    setTimeout(() => {
      this.container.style.opacity = "1";
      this.container.style.transform = "translate(-50%, -50%) scale(1)";
    }, 10);
    this.buildSeriesColorsTab();
  }

  public close(confirmed: boolean) {
    // If “Ok” was clicked, do final logic (like saving user changes).
    if (confirmed) {
      console.log("Settings Modal: OK clicked. Save changes here.");
      // Implement real save logic if needed.
    } else {
      console.log("Settings Modal: Cancel clicked.");
      // Implement rollback logic if needed.
    }

    this.isOpen = false;
    this.backdrop.style.opacity = "0";
    this.container.style.opacity = "0";
    this.container.style.transform = "translate(-50%, -50%) scale(0.95)";

    setTimeout(() => {
      if (!this.isOpen) {
        this.backdrop.style.display = "none";
        this.container.style.display = "none";
      }
    }, 300);
  }

  // ─────────────────────────────────────────────────────────────
  // 2) Navigation / Category Switching
  // ─────────────────────────────────────────────────────────────
  private switchCategory(catId: string) {
    this.activeCategoryId = catId;
    // Clear the content area
    this.contentArea.innerHTML = "";

    // Find the category object
    const categoryObj = this.categories.find((c) => c.id === catId);
    if (categoryObj) {
      categoryObj.buildContent();
    }
  }

  /**************************************
   * New Tab Builders (for each option)
   **************************************/

  /**
   * Layout Options Tab
   * Recreates settings for text and background colors.
   */
  private buildLayoutOptionsTab(): void {
    const title = document.createElement("div");
    title.innerText = "Layout Options";
    title.style.fontSize = "16px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);

    // Text Color Option
    const currentTextColor =
      this.getCurrentOptionValue("layout.textColor") || "#000000";
    this.addColorPicker("Text Color", currentTextColor, (color: string) => {
      this.handler.chart.applyOptions({ layout: { textColor: color } });
    });

    // Background Options based on current type:
    const currentBackground = this.handler.chart.options().layout?.background;
    if (currentBackground && currentBackground.type === "solid") {
      // Solid background color
      const bgColor = currentBackground.color || "#FFFFFF";
      this.addColorPicker("Background Color", bgColor, (color: string) => {
        this.handler.chart.applyOptions({
          layout: { background: { type: ColorType.Solid, color } },
        });
      });
    } else if (
      currentBackground &&
      currentBackground.type === ColorType.VerticalGradient
    ) {
      // Gradient background colors
      let topColor = currentBackground.topColor || "rgba(255,0,0,0.33)";
      let bottomColor = currentBackground.bottomColor || "rgba(0,255,0,0.33)";
      this.addColorPicker("Top Color", topColor, (color: string) => {
        bottomColor = currentBackground.bottomColor || "rgba(0,255,0,0.33)";

        this.handler.chart.applyOptions({
          layout: {
            background: {
              type: ColorType.VerticalGradient,
              topColor: color,
              bottomColor,
            },
          },
        });
      });
      this.addColorPicker("Bottom Color", bottomColor, (color: string) => {
        topColor = currentBackground.topColor || "rgba(255,0,0,0.33)";
        this.handler.chart.applyOptions({
          layout: {
            background: {
              type: ColorType.VerticalGradient,
              topColor,
              bottomColor: color,
            },
          },
        });
      });
    } else {
      console.warn("Unknown background type.");
    }

    // Button to switch background type
    const switchBtn = document.createElement("button");
    switchBtn.innerText = "Switch Background Type";
    switchBtn.style.marginTop = "12px";
    switchBtn.onclick = () => this.toggleBackgroundType();
    this.contentArea.appendChild(switchBtn);
  }

  /**
   * Grid Options Tab
   * Provides controls for grid line colors, styles, and visibility.
   */
  private buildGridOptionsTab(): void {
    const title = document.createElement("div");
    title.innerText = "Grid Options";
    title.style.fontSize = "16px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);

    // Vertical grid line color
    const vertLineColor =
      this.getCurrentOptionValue("grid.vertLines.color") || "#D6DCDE";
    this.addColorPicker(
      "Vertical Line Color",
      vertLineColor,
      (color: string) => {
        this.handler.chart.applyOptions({ grid: { vertLines: { color } } });
      }
    );

    // Horizontal grid line color
    const horzLineColor =
      this.getCurrentOptionValue("grid.horzLines.color") || "#D6DCDE";
    this.addColorPicker(
      "Horizontal Line Color",
      horzLineColor,
      (color: string) => {
        this.handler.chart.applyOptions({ grid: { horzLines: { color } } });
      }
    );

    // 1) Build a lookup that maps the user-friendly string to the numeric enum
    const styleMapping: Record<string, LineStyle> = {
      Solid: LineStyle.Solid,
      Dotted: LineStyle.Dotted,
      Dashed: LineStyle.Dashed,
      LargeDashed: LineStyle.LargeDashed,
      SparseDotted: LineStyle.SparseDotted,
    };

    // 2) When you handle the dropdown selection:
    this.addDropdown(
      "Vertical Line Style",
      ["Solid", "Dashed", "Dotted", "LargeDashed"],
      (selected: string) => {
        // Map the string to the numeric style
        const lineStyle = styleMapping[selected];
        // Apply the chart options
        this.handler.chart.applyOptions({
          grid: { vertLines: { style: lineStyle } },
        });
      }
    );
    this.addDropdown(
      "Horizontal Line Style",
      ["Solid", "Dashed", "Dotted", "LargeDashed"],
      (selected: string) => {
        // Map the string to the numeric style
        const lineStyle = styleMapping[selected];
        // Apply the chart options
        this.handler.chart.applyOptions({
          grid: { horzLines: { style: lineStyle } },
        });
      }
    );

    // Checkboxes for line visibility
    const vertVisible =
      this.getCurrentOptionValue("grid.vertLines.visible") !== false;
    this.addCheckbox("Show Vertical Lines", vertVisible, (visible: boolean) => {
      this.handler.chart.applyOptions({ grid: { vertLines: { visible } } });
    });
    const horzVisible =
      this.getCurrentOptionValue("grid.horzLines.visible") !== false;
    this.addCheckbox(
      "Show Horizontal Lines",
      horzVisible,
      (visible: boolean) => {
        this.handler.chart.applyOptions({ grid: { horzLines: { visible } } });
      }
    );
  }
  /**
   * Crosshair Options Tab
   * Provides full customization controls for the crosshair:
   * - Mode (Normal, Magnet, Hidden)
   * - Vertical line: width, style, color, label background color
   * - Horizontal line: width, style, color, label background color
   */
  private buildCrosshairOptionsTab(): void {
    // Create and append the title element
    const title = document.createElement("div");
    title.innerText = "Crosshair Options";
    title.style.fontSize = "16px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);
    // Build a lookup that maps a user-friendly string to the numeric LineStyle enum.
    const crosshairStyleMapping: Record<string, LineStyle> = {
      Solid: LineStyle.Solid,
      Dotted: LineStyle.Dotted,
      Dashed: LineStyle.Dashed,
      LargeDashed: LineStyle.LargeDashed,
      SparseDotted: LineStyle.SparseDotted,
    };

    // Retrieve the current default for vertical and horizontal crosshair styles.
    const currentCrosshairVertStyle: string = (this.getCurrentOptionValue(
      "crosshair.vertLine.style"
    ) || "Solid") as string;
    const currentCrosshairHorzStyle: string = (this.getCurrentOptionValue(
      "crosshair.horzLine.style"
    ) || "Solid") as string;

    // -------------------------------
    // Crosshair Mode Dropdown
    // -------------------------------
    const crosshairModes: string[] = ["Normal", "Magnet", "Hidden"];
    const currentMode: string = (this.getCurrentOptionValue("crosshair.mode") ||
      "Normal") as string;
    this.addDropdown(
      "Crosshair Mode",
      crosshairModes,
      (selected: string | CrosshairMode) => {
        this.handler.chart.applyOptions({
          crosshair: { mode: selected as CrosshairMode },
        });
      },
      currentMode
    );

    // -------------------------------
    // Vertical Crosshair Line Options
    // -------------------------------
    // Vertical line width dropdown (values 1–10)
    const widthOptions: string[] = Array.from({ length: 10 }, (_, i) =>
      (i + 1).toString()
    );
    const currentVertWidth: string = (
      this.getCurrentOptionValue("crosshair.vertLine.width") || "1"
    ).toString();
    this.addDropdown(
      "Vertical Line Width",
      widthOptions,
      (selected: string) => {
        const newWidth = parseInt(selected, 10);
        this.handler.chart.applyOptions({
          crosshair: { vertLine: { width: newWidth as LineWidth } },
        });
      },
      currentVertWidth
    );

    // Vertical Crosshair Line Style Dropdown
    this.addDropdown(
      "Vertical Crosshair Line Style",
      ["Solid", "Dashed", "Dotted", "LargeDashed"],
      (selected: string) => {
        const lineStyle = crosshairStyleMapping[selected];
        this.handler.chart.applyOptions({
          crosshair: { vertLine: { style: lineStyle } },
        });
      },
      currentCrosshairVertStyle
    );

    // Vertical line color picker.
    const vertLineColor: string =
      this.getCurrentOptionValue("crosshair.vertLine.color") || "#C3BCDB44";
    this.addColorPicker(
      "Vertical Line Color",
      vertLineColor,
      (newColor: string) => {
        this.handler.chart.applyOptions({
          crosshair: { vertLine: { color: newColor } },
        });
      }
    );

    // Vertical line label background color picker.
    const vertLabelBg: string =
      this.getCurrentOptionValue("crosshair.vertLine.labelBackgroundColor") ||
      "#9B7DFF";
    this.addColorPicker(
      "Vertical Label Background",
      vertLabelBg,
      (newColor: string) => {
        this.handler.chart.applyOptions({
          crosshair: { vertLine: { labelBackgroundColor: newColor } },
        });
      }
    );

    // -------------------------------
    // Horizontal Crosshair Line Options
    // -------------------------------

    // Horizontal line width dropdown (values 1–10)
    const currentHorzWidth: string = (
      this.getCurrentOptionValue("crosshair.horzLine.width") || "1"
    ).toString();
    this.addDropdown(
      "Horizontal Line Width",
      widthOptions,
      (selected: string) => {
        const newWidth = parseInt(selected, 10);
        this.handler.chart.applyOptions({
          crosshair: { horzLine: { width: newWidth as LineWidth } },
        });
      }
    );
    // Horizontal Crosshair Line Style Dropdown
    this.addDropdown(
      "Horizontal Crosshair Line Style",
      ["Solid", "Dashed", "Dotted", "LargeDashed"],
      (selected: string) => {
        const lineStyle = crosshairStyleMapping[selected];
        this.handler.chart.applyOptions({
          crosshair: { horzLine: { style: lineStyle } },
        });
      },
      currentCrosshairHorzStyle
    );

    // Horizontal line color picker.
    const horzLineColor: string =
      this.getCurrentOptionValue("crosshair.horzLine.color") || "#9B7DFF";
    this.addColorPicker(
      "Horizontal Line Color",
      horzLineColor,
      (newColor: string) => {
        this.handler.chart.applyOptions({
          crosshair: { horzLine: { color: newColor } },
        });
      }
    );

    // Horizontal line label background color picker.
    const horzLabelBg: string =
      this.getCurrentOptionValue("crosshair.horzLine.labelBackgroundColor") ||
      "#9B7DFF";
    this.addColorPicker(
      "Horizontal Label Background",
      horzLabelBg,
      (newColor: string) => {
        this.handler.chart.applyOptions({
          crosshair: { horzLine: { labelBackgroundColor: newColor } },
        });
      }
    );
  }

  /**
   * Time Scale Options Tab
   * Provides numeric and boolean controls for time scale settings.
   */
  private buildTimeScaleOptionsTab(): void {
    const title = document.createElement("div");
    title.innerText = "Time Scale Options";
    title.style.fontSize = "16px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);

    // Right Offset
    const rightOffset =
      this.getCurrentOptionValue("timeScale.rightOffset") || 0;
    this.addNumberField("Right Offset", rightOffset, (val: number) => {
      this.handler.chart.applyOptions({ timeScale: { rightOffset: val } });
    });
    // Bar Spacing
    const barSpacing = this.getCurrentOptionValue("timeScale.barSpacing") || 10;
    this.addNumberField("Bar Spacing", barSpacing, (val: number) => {
      this.handler.chart.applyOptions({ timeScale: { barSpacing: val } });
    });
    // Min Bar Spacing
    const minBarSpacing =
      this.getCurrentOptionValue("timeScale.minBarSpacing") || 0.1;
    this.addNumberField("Min Bar Spacing", minBarSpacing, (val: number) => {
      this.handler.chart.applyOptions({ timeScale: { minBarSpacing: val } });
    });

    // Additional checkboxes (e.g., Fix Left/Right Edge, Lock Visible Range, etc.)
    const fixLeftEdge =
      this.getCurrentOptionValue("timeScale.fixLeftEdge") || false;
    this.addCheckbox("Fix Left Edge", fixLeftEdge, (val: boolean) => {
      this.handler.chart.applyOptions({ timeScale: { fixLeftEdge: val } });
    });
    const fixRightEdge =
      this.getCurrentOptionValue("timeScale.fixRightEdge") || false;
    this.addCheckbox("Fix Right Edge", fixRightEdge, (val: boolean) => {
      this.handler.chart.applyOptions({ timeScale: { fixRightEdge: val } });
    });
    const lockVisibleRange =
      this.getCurrentOptionValue("timeScale.lockVisibleTimeRangeOnResize") ||
      false;
    this.addCheckbox(
      "Lock Visible Range on Resize",
      lockVisibleRange,
      (val: boolean) => {
        this.handler.chart.applyOptions({
          timeScale: { lockVisibleTimeRangeOnResize: val },
        });
      }
    );
    const visible = this.getCurrentOptionValue("timeScale.visible");
    this.addCheckbox(
      "Time Scale Visible",
      visible !== false,
      (val: boolean) => {
        this.handler.chart.applyOptions({ timeScale: { visible: val } });
      }
    );
    const borderVisible = this.getCurrentOptionValue("timeScale.borderVisible");
    this.addCheckbox(
      "Border Visible",
      borderVisible !== false,
      (val: boolean) => {
        this.handler.chart.applyOptions({ timeScale: { borderVisible: val } });
      }
    );
    const borderColor =
      this.getCurrentOptionValue("timeScale.borderColor") || "#000000";
    this.addColorPicker("Border Color", borderColor, (color: string) => {
      this.handler.chart.applyOptions({ timeScale: { borderColor: color } });
    });
  }

  /**
   * Price Scale Options Tab
   * Provides a dropdown for mode and checkboxes for additional options.
   */
  private buildPriceScaleOptionsTab(): void {
    const title = document.createElement("div");
    title.innerText = "Price Scale Options";
    title.style.fontSize = "16px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);

    // For this example, we use the "right" price scale.
    const priceScale = this.handler.chart.priceScale("right");
    priceScale.options().mode || PriceScaleMode.Normal;
    const modeOptions: { label: string; value: PriceScaleMode }[] = [
      { label: "Normal", value: PriceScaleMode.Normal },
      { label: "Logarithmic", value: PriceScaleMode.Logarithmic },
      { label: "Percentage", value: PriceScaleMode.Percentage },
      { label: "Indexed To 100", value: PriceScaleMode.IndexedTo100 },
    ];
    const modeLabels = modeOptions.map((opt) => opt.label);
    this.addDropdown("Price Scale Mode", modeLabels, (selected: string) => {
      const selectedOption = modeOptions.find((opt) => opt.label === selected);
      if (selectedOption) {
        priceScale.applyOptions({ mode: selectedOption.value });
      }
    });

    // Additional toggles for the price scale
    const autoScale =
      priceScale.options().autoScale !== undefined
        ? priceScale.options().autoScale
        : true;
    this.addCheckbox("Auto Scale", autoScale, (val: boolean) => {
      priceScale.applyOptions({ autoScale: val });
    });
    const invertScale = priceScale.options().invertScale || false;
    this.addCheckbox("Invert Scale", invertScale, (val: boolean) => {
      priceScale.applyOptions({ invertScale: val });
    });
    const alignLabels =
      priceScale.options().alignLabels !== undefined
        ? priceScale.options().alignLabels
        : true;
    this.addCheckbox("Align Labels", alignLabels, (val: boolean) => {
      priceScale.applyOptions({ alignLabels: val });
    });
    const borderVisible =
      priceScale.options().borderVisible !== undefined
        ? priceScale.options().borderVisible
        : true;
    this.addCheckbox("Border Visible", borderVisible, (val: boolean) => {
      priceScale.applyOptions({ borderVisible: val });
    });
    const ticksVisible = priceScale.options().ticksVisible || false;
    this.addCheckbox("Ticks Visible", ticksVisible, (val: boolean) => {
      priceScale.applyOptions({ ticksVisible: val });
    });
  }

  /**
   * Demonstrates how a sub-tab might be built for “Clone Series”.
   */
  private buildCloneSeriesTab(series: any): void {
    this.contentArea.innerHTML = "";
    const title = document.createElement("div");
    title.innerText = `Clone Series - ${series.options().title || "Untitled"}`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    // TODO: Real logic for cloning the series
    // E.g., ask user for a name, create a new series with same config, etc.
    const msg = document.createElement("div");
    msg.innerText = "(Clone Series logic not yet implemented.)";
    msg.style.color = "#ccc";
    msg.style.marginBottom = "12px";
    this.contentArea.appendChild(msg);

    // Back button
    this.addButton("⤝ Back", () => this.buildSeriesMenuTab(series), {
      backgroundColor: "#444",
    });
  }

  private buildVisibilityOptionsTab(series: any): void {
    this.contentArea.innerHTML = "";
    const title = document.createElement("div");
    title.innerText = `Visibility Options - ${
      series.options().title || "Untitled"
    }`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    // TODO: e.g., checkboxes for “visible”, “markers visible”, etc.
    const msg = document.createElement("div");
    msg.innerText = "(Visibility Options logic not yet implemented.)";
    msg.style.color = "#ccc";
    msg.style.marginBottom = "12px";
    this.contentArea.appendChild(msg);

    // Back button
    this.addButton("⤝ Back", () => this.buildSeriesMenuTab(series), {
      backgroundColor: "#444",
    });
  }

  // Same pattern for Style Options
  private buildStyleOptionsTab(series: any): void {
    this.contentArea.innerHTML = "";
    const title = document.createElement("div");
    title.innerText = `Style Options - ${series.options().title || "Untitled"}`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    // TODO: real style config controls
    const msg = document.createElement("div");
    msg.innerText = "(Style Options logic not yet implemented.)";
    msg.style.color = "#ccc";
    msg.style.marginBottom = "12px";
    this.contentArea.appendChild(msg);

    this.addButton("⤝ Back", () => this.buildSeriesMenuTab(series), {
      backgroundColor: "#444",
    });
  }

  private buildWidthOptionsTab(series: any): void {
    this.contentArea.innerHTML = "";
    const title = document.createElement("div");
    title.innerText = `Width Options - ${series.options().title || "Untitled"}`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    // TODO: e.g., numeric field for line width, bar width, etc.
    const msg = document.createElement("div");
    msg.innerText = "(Width Options logic not yet implemented.)";
    msg.style.color = "#ccc";
    msg.style.marginBottom = "12px";
    this.contentArea.appendChild(msg);

    this.addButton("⤝ Back", () => this.buildSeriesMenuTab(series), {
      backgroundColor: "#444",
    });
  }
/**
 * Builds the "Primitives" tab.
 * Iterates through each primitive in handler.primitives and, if a primitive
 * exposes an options object (via a function, _options, or direct property),
 * uses buildPrimitiveColorOptions to display its color controls.
 * The changes are applied using primitive.applyOptions(newOpts).
 */
/**
 * Builds the "Primitives" tab.
 * For each series in handler._seriesList that has a primitives array,
 * creates a container labeled with the series title (from series.options().title)
 * and then iterates through each primitive to build color controls.
 * Changes are applied via primitive.applyOptions(newOpts).
 */
private buildPrimitivesTab(): void {
  this.contentArea.innerHTML = "";

  // Main title for the tab.
  const title = document.createElement("div");
  title.innerText = "Primitives";
  Object.assign(title.style, {
    fontSize: "16px",
    fontWeight: "bold",
    marginBottom: "12px"
  });
  this.contentArea.appendChild(title);

  // Iterate over each series in the handler's series list.
  this.handler._seriesList.forEach((series: ISeriesApiExtended) => {
    // Only process series that have a primitives array with at least one primitive.
    if (series.primitives && Array.isArray(series.primitives) && series.primitives.length > 0) {
      // Get series title from series.options(). If not defined, default to "Unnamed Series".
      let seriesTitle = "Unnamed Series";
      const seriesOpts = series.options();
      if (seriesOpts && seriesOpts.title) {
        seriesTitle = seriesOpts.title;
      }

      // Create a container for this series.
      const seriesContainer = document.createElement("div");
      Object.assign(seriesContainer.style, {
        border: "2px solid #666",
        marginBottom: "12px",
        padding: "8px",
        borderRadius: "4px"
      });

      // Add a header using the series title.
      const seriesHeader = document.createElement("div");
      seriesHeader.innerText = `Series: ${seriesTitle}`;
      Object.assign(seriesHeader.style, {
        fontSize: "18px",
        fontWeight: "bold",
        marginBottom: "8px"
      });
      seriesContainer.appendChild(seriesHeader);

      // Process each primitive in this series.
      series.primitives.forEach((primitive: any, primitiveIndex: number) => {
        // Attempt to retrieve options from the primitive.
        let opts: Record<string, any> | undefined;
        if (typeof primitive.options === "function") {
          opts = primitive.options();
        } else if (primitive._options) {
          opts = primitive._options;
        } else if (primitive.options) {
          opts = primitive.options;
        }
        if (!opts) return;

        // Create a container for this primitive.
        const primitiveContainer = document.createElement("div");
        Object.assign(primitiveContainer.style, {
          border: "1px solid #444",
          marginBottom: "8px",
          padding: "8px",
          borderRadius: "4px"
        });

        // Header for the primitive.
        const primitiveHeader = document.createElement("div");
        primitiveHeader.innerText = `Primitive ${primitiveIndex + 1}: ${primitive.name || "Unnamed"}`;
        Object.assign(primitiveHeader.style, {
          fontSize: "16px",
          fontWeight: "bold",
          marginBottom: "6px"
        });
        primitiveContainer.appendChild(primitiveHeader);

        // Build color controls for the primitive.
        this.buildPrimitiveColorOptions(opts, primitiveContainer, (newOpts: Record<string, any>) => {
          primitive.applyOptions(newOpts);
        });

        seriesContainer.appendChild(primitiveContainer);
      });

      this.contentArea.appendChild(seriesContainer);
    }
  });
}


  private buildIndicatorsTab(series: any): void {
    this.contentArea.innerHTML = "";
    const title = document.createElement("div");
    title.innerText = `Indicators - ${series.options().title || "Untitled"}`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    const msg = document.createElement("div");
    msg.innerText = "(Indicators logic not yet implemented.)";
    msg.style.color = "#ccc";
    msg.style.marginBottom = "12px";
    this.contentArea.appendChild(msg);

    this.addButton("⤝ Back", () => this.buildSeriesMenuTab(series), {
      backgroundColor: "#444",
    });
  }
  /**
   * Builds a Source Code tab that displays licensing information and provides
   * links to the repositories used in this build.
   *
   * This project is a derivative work that incorporates components from the following repositories:
   *
   * Base Source Repositories:
   *  - Lightweight Charts: <a href="https://github.com/louisnw01/lightweight-charts-python" target="_blank">louisnw01/lightweight-charts-python (MIT)</a>
   *  - PineTS: <a href="https://github.com/alaa-eddine/PineTS" target="_blank">alaa-eddine/PineTS (AGPL)</a>
   *
   * Modified/Forked Repositories (by EsIstJosh):
   *  - Lightweight Charts: <a href="https://github.com/EsIstJosh/lightweight-charts-python" target="_blank">EsIstJosh/lightweight-charts-python</a>
   *  - PineTS: <a href="https://github.com/EsIstJosh/PineTS" target="_blank">EsIstJosh/PineTS</a>
   */
  private buildSourceCodeTab(): void {
    // Clear the content area
    this.contentArea.innerHTML = "";

    // Title for the Source Code tab
    const title = document.createElement("div");
    title.innerText = "Source Code & Licensing";
    title.style.fontSize = "16px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "12px";
    this.contentArea.appendChild(title);

    // Informational text explaining the derivative nature of this project.
    const info = document.createElement("div");
    info.style.marginBottom = "12px";
    info.style.fontSize = "16px";
    info.innerHTML = `
    <p>
      This project is a derivative work that incorporates components from the following repositories:
    </p>
    <p>
      <strong>Base Source Repositories:</strong>
    </p>
    <ul>
      <li>
        <a href="https://github.com/louisnw01/lightweight-charts-python" target="_blank" style="color:#008CBA; text-decoration:underline;">
          louisnw01/lightweight-charts-python (MIT)
        </a>
      </li>
      <li>
        <a href="https://github.com/alaa-eddine/PineTS" target="_blank" style="color:#008CBA; text-decoration:underline;">
          alaa-eddine/PineTS (AGPL)
        </a>
      </li>
    </ul>
    <p>
      <strong>Modified/Forked Repositories (by EsIstJosh):</strong>
    </p>
    <ul>
      <li>
        <a href="https://github.com/EsIstJosh/lightweight-charts-python" target="_blank" style="color:#5eb623; text-decoration:underline;">
          EsIstJosh/lightweight-charts-python
        </a>
      </li>
      <li>
        <a href="https://github.com/EsIstJosh/PineTS" target="_blank" style="color:#5eb623; text-decoration:underline;">
          EsIstJosh/PineTS
        </a>
      </li>
    </ul>
  `;
    this.contentArea.appendChild(info);

    // Back button to return to the default category (for example, the first category)
    this.addButton("⤝ Back", () => this.switchCategory(this.categories[0].id), {
      backgroundColor: "#444",
    });
  }

  private buildSeriesMenuTab(series: any): void {
    // Clear content area
    this.contentArea.innerHTML = "";

    // Title
    const title = document.createElement("div");
    title.innerText = `Series Settings - ${
      series.options().title ?? "Untitled"
    }`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    // Title input
    this.addTextInput(
      "Title",
      series.options().title || "",
      (newTitle: string) => {
        series.applyOptions({ title: newTitle });
        // Optionally update seriesMap
        const oldTitle = series.options().title;
        if (oldTitle && this.handler.seriesMap.has(oldTitle)) {
          this.handler.seriesMap.delete(oldTitle);
        }
        this.handler.seriesMap.set(newTitle, series);
      }
    );

    // Sub-tabs
    this.addButton("Clone Series ▸", () => this.buildCloneSeriesTab(series));
    this.addButton("Visibility Options ▸", () =>
      this.buildVisibilityOptionsTab(series)
    );
    this.addButton("Style Options ▸", () => this.buildStyleOptionsTab(series));
    this.addButton("Width Options ▸", () => this.buildWidthOptionsTab(series));
    this.addButton("Color Options ▸", () =>
      this.buildSeriesColorsTabSingle(series)
    );
    this.addButton("Price Scale Options ▸", () =>
      this.buildPriceScaleOptionsTab()
    );
    this.addButton("Primitives ▸", () => this.buildPrimitivesTab());
    this.addButton("Indicators ▸", () => this.buildIndicatorsTab(series));
    this.addButton("Export/Import Series Data ▸", () =>
      this.buildDataExportImportTab(series)
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3) TAB BUILDERS
  // ─────────────────────────────────────────────────────────────

  /**
   * "Series Colors" main tab: displays color pickers for *all* series side-by-side.
   * This is in addition to the per-series color sub-tab accessible in “Series Menu.”
   */
/**
 * "Series Colors" main tab: displays color pickers for *all* series side-by-side.
 * This is in addition to the per-series color sub-tab accessible in “Series Menu.”
 */
private buildSeriesColorsTab(): void {
  this.contentArea.innerHTML = "";

  const title = document.createElement("div");
  title.innerText = "Series Colors (All Series)";
  Object.assign(title.style, {
    fontSize: "16px",
    fontWeight: "bold",
    marginBottom: "12px",
  });
  this.contentArea.appendChild(title);

  // Retrieve all series from your handler.seriesMap
  const seriesEntries = Array.from(this.handler.seriesMap.entries()) as [string, any][];
  if (seriesEntries.length === 0) {
    const noSeriesMsg = document.createElement("div");
    noSeriesMsg.innerText = "No series found.";
    noSeriesMsg.style.color = "#ccc";
    this.contentArea.appendChild(noSeriesMsg);
    return;
  }

  // For each series, create a mini color section
  seriesEntries.forEach(([seriesName, series]) => {
    this.buildSeriesColorSection(seriesName, series);
  });

  // If a volume series exists, add a separate section for volume colors.
  if (this.handler.volumeSeries) {

    const container = document.createElement("div");
    Object.assign(container.style, {
      border: "1px solid #444",
      marginBottom: "8px",
      padding: "8px",
      borderRadius: "4px",
    });

    // Create a header for the volume series section.
    const header = document.createElement("div");
    header.innerText = "Series: Volume";
    Object.assign(header.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "6px",
    });
    container.appendChild(header);

    // Explicitly reference the volume series.
    const volumeSeries = this.handler.volumeSeries as ISeriesApi<'Histogram'>;
    
    // Derive fallback colors from the base series options.
    const defaultUpColor =
      ((this.handler.series as ISeriesApi<'Candlestick'>).options()).borderUpColor || "#00FF00";
    const defaultDownColor =
      ((this.handler.series as ISeriesApi<'Candlestick'>).options()).borderDownColor || "#FF0000";
  
    // Copy the current volume series data.
  
    // Scan the volume data to find initial up/down colors.
    let foundUpColor= this.handler.volumeUpColor
    let foundDownColor= this.handler.volumeDownColor
    ;

    const currentUpColor = foundUpColor?? defaultUpColor;
    const currentDownColor = foundDownColor?? defaultDownColor;
  
    // Variables to store current colors.
    let volumeUpColor = currentUpColor;
    let volumeDownColor = currentDownColor;
  
    /**
     * Updates the volume series colors.
     * For each data point, if its volume is greater than the previous point, assign newUpColor;
     * otherwise, assign newDownColor.
     */
    const updateVolumeColors = (newUpColor: string, newDownColor: string) => {
      const data = [...volumeSeries.data()] as any[];
      if (!data || data.length === 0) {
        console.warn("No volume data available to update colors.");
        return;
      }
      const newData = data.map((item: any, index: number) => {
        if (index === 0) {
          return { ...item, color: newUpColor };
        }
        const prevVolume = data[index - 1].value;
        const updatedColor = item.value > prevVolume ? newUpColor : newDownColor;
        return { ...item, color: updatedColor };
      });
      volumeSeries.setData(newData);
      this.handler.volumeUpColor = newUpColor 
      this.handler.volumeDownColor = newDownColor
    };
  
    // Use addSideBySideColors to create the volume color pickers.
    this.addSideBySideColors(
      "Volume Colors",
      volumeUpColor,
      volumeDownColor,
      (upColor: string, downColor: string) => {
        volumeUpColor = upColor;
        volumeDownColor = downColor;
        updateVolumeColors(upColor, downColor);

       },
      container
    );
  
    // Finally, attach container to content area
    this.contentArea.appendChild(container);
}
}
  

  private buildSeriesColorSection(seriesName: string, series: any): void {
    const container = document.createElement("div");
    Object.assign(container.style, {
      border: "1px solid #444",
      marginBottom: "8px",
      padding: "8px",
      borderRadius: "4px",
    });

    const header = document.createElement("div");
    header.innerText = `Series: ${seriesName}`;
    Object.assign(header.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "6px",
    });
    container.appendChild(header);

    const seriesType = series.seriesType?.();

    // For OHLC or Candlestick-like data
    if (
      seriesType === "Candlestick" ||
      seriesType === "Bar" ||
      seriesType === "Custom"
    ) {
      if ("upColor" in series.options()) {
        // Body
        this.addSideBySideColors(
          "Body",
          series.options().upColor,
          series.options().downColor,
          (upColor, downColor) => {
            series.applyOptions({ upColor, downColor });
          },
          container
        );
      }
      if ("borderUpColor" in series.options()) {
        // Borders
        this.addSideBySideColors(
          "Borders",
          series.options().borderUpColor,
          series.options().borderDownColor,
          (upColor, downColor) => {
            series.applyOptions({
              borderUpColor: upColor,
              borderDownColor: downColor,
            });
          },
          container
        );

        this.addSideBySideColors(
          "Wick",
          series.options().wickUpColor,
          series.options().wickDownColor,
          (upColor, downColor) => {
            series.applyOptions({
              wickUpColor: upColor,
              wickDownColor: downColor,
            });
          },
          container
        );
      }
    } else if (seriesType === "Line") {
      // Single color
      const currentLineColor = series.options().color || "#ffffff";
      this.addColorPicker(
        "Line Color",
        currentLineColor,
        (newCol) => series.applyOptions({ color: newCol }),
        container
      );
    } else if (seriesType === "Area") {
      const opts = series.options();
      // lineColor, topColor, bottomColor
      this.addColorPicker(
        "Line Color",
        opts.lineColor || "#EEEEEE",
        (c) => {
          series.applyOptions({ lineColor: c });
        },
        container
      );

      this.addColorPicker(
        "Top Fill",
        opts.topColor || "#008cff44",
        (c) => {
          series.applyOptions({ topColor: c });
        },
        container
      );

      this.addColorPicker(
        "Bottom Fill",
        opts.bottomColor || "#008cff00",
        (c) => {
          series.applyOptions({ bottomColor: c });
        },
        container
      );
    } else {
      const msg = document.createElement("div");
      msg.innerText = `No color settings for series type: ${seriesType}`;
      msg.style.color = "#bbb";
      container.appendChild(msg);
    }
  

    // Finally, attach container to content area
    this.contentArea.appendChild(container);
  }

  /**
   * A single-series “Color Options” sub-tab
   */
  private buildSeriesColorsTabSingle(series: any): void {
    // Clear the content area
    this.contentArea.innerHTML = "";

    // A container for everything on this tab
    const container = document.createElement("div");
    Object.assign(container.style, {
      border: "1px solid #444",
      marginBottom: "8px",
      padding: "8px",
      borderRadius: "4px",
    });
    this.contentArea.appendChild(container);

    // Title
    const title = document.createElement("div");
    title.innerText = `Color Options - ${series.options().title || "Untitled"}`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    container.appendChild(title);

    const seriesType = series.type?.();

    if (
      seriesType === "Candlestick" ||
      seriesType === "Bar" ||
      seriesType === "Custom"
    ) {
      if ("upColor" in series.options()) {
        // Body
        this.addSideBySideColors(
          "Body",
          series.options().upColor,
          series.options().downColor,
          (upColor, downColor) => {
            series.applyOptions({ upColor, downColor });
          },
          container
        );
      }
      if ("borderUpColor" in series.options()) {
        this.addSideBySideColors(
          "Borders",
          series.options().borderUpColor,
          series.options().borderDownColor,
          (upColor, downColor) => {
            series.applyOptions({
              borderUpColor: upColor,
              borderDownColor: downColor,
            });
          },
          container
        );

        this.addSideBySideColors(
          "Wick",
          series.options().wickUpColor,
          series.options().wickDownColor,
          (upColor, downColor) => {
            series.applyOptions({
              wickUpColor: upColor,
              wickDownColor: downColor,
            });
          },
          container
        );
      }
    } else if (seriesType === "Line") {
      const currentLineColor = series.options().color || "#FFFFFF";
      this.addColorPicker(
        "Line Color",
        currentLineColor,
        (newColor) => {
          series.applyOptions({ color: newColor });
        },
        container
      );
      // etc...
    } else if (seriesType === "Area") {
      const opts = series.options();
      // ...
      this.addColorPicker(
        "Line Color",
        opts.lineColor || "#EEEEEE",
        (c) => {
          series.applyOptions({ lineColor: c });
        },
        container
      );
      // ...
    } else {
      const unknownMsg = document.createElement("div");
      unknownMsg.innerText = `No color settings for series type: ${seriesType}`;
      unknownMsg.style.color = "#bbb";
      container.appendChild(unknownMsg);
    }

    // Back button at the bottom
    const backBtn = document.createElement("button");
    backBtn.innerText = "⤝ Back";
    Object.assign(backBtn.style, {
      backgroundColor: "#444",
      marginTop: "16px",
      padding: "8px 12px",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    });
    backBtn.onclick = () => this.buildSeriesMenuTab(series);
    container.appendChild(backBtn);
  }


  private buildDataExportImportTab(series: any): void {
    this.subTabSkeleton(
      "Export/Import",
      series,
      "(Export/Import logic not yet implemented.)"
    );
  }

  /**
   * Helper to quickly build a “placeholder” sub-tab.
   */
  private subTabSkeleton(tabName: string, series: any, message: string): void {
    this.contentArea.innerHTML = "";
    const title = document.createElement("div");
    title.innerText = `${tabName} - ${series.options().title || "Untitled"}`;
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    const msg = document.createElement("div");
    msg.innerText = message;
    Object.assign(msg.style, {
      color: "#ccc",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(msg);

    this.addButton("⤝ Back", () => this.buildSeriesMenuTab(series), {
      backgroundColor: "#444",
    });
  }

  private buildDefaultsListTab(): void {
    // Clear content area
    this.contentArea.innerHTML = "";

    const title = document.createElement("div");
    title.innerText = "Default Configurations";
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "12px",
    });
    this.contentArea.appendChild(title);

    // Suppose your Handler has a property: handler.defaultsManager
    const defaultsManager = this.handler?.defaultsManager;
    if (!defaultsManager) {
      const msg = document.createElement("div");
      msg.innerText = "No defaults manager found.";
      msg.style.color = "#ccc";
      this.contentArea.appendChild(msg);
      return;
    }

    // Retrieve all defaults from the manager
    const allDefaultsMap = defaultsManager.getAll(); // a Map<string, any>
    const allKeys = Array.from(allDefaultsMap.keys());
    if (allKeys.length === 0) {
      const msg = document.createElement("div");
      msg.innerText = "No default configurations found.";
      msg.style.color = "#ccc";
      this.contentArea.appendChild(msg);
      return;
    }
    // Add a new button for Export/Import of the chart config
    this.addButton(
      "Current Chart Config ▸",
      (evt) => {
        // You can place your logic here; for example:
        // 1. If dataMenu is not instantiated, create it
        if (!this.handler.ContextMenu.dataMenu) {
          // dataMenu is hypothetical—replace with your own menu or logic
          this.handler.ContextMenu.dataMenu = new DataMenu({
            contextMenu: this.handler.ContextMenu,
            handler: this.handler,
          });
        }

        // 2. Then open the menu or export logic
        // “Handler” is a label or ID you can pass along, depending on your needs
        this.handler.ContextMenu.dataMenu!.openMenu(
          this.handler,
          evt,
          "Handler"
        );
      },
      {
        backgroundColor: "#444",
        borderRadius: "8px",
        marginBottom: "8px",
        display: "block",
      }
    );
    // For each key, add a button to open the default options editor
    allKeys.forEach((key) => {
      this.addButton(
        `Edit "${key}" Defaults`,
        () => {
          // We assume there's a dataMenu in your handler with openDefaultOptions(key)
          if (
            this.handler.ContextMenu?.dataMenu &&
            typeof this.handler.ContextMenu.dataMenu.openDefaultOptions ===
              "function"
          ) {
            this.handler.ContextMenu.dataMenu.openDefaultOptions(key);
          } else {
            console.warn(
              "No dataMenu or openDefaultOptions method found on handler."
            );
          }
        },
        {
          backgroundColor: "#444",
          borderRadius: "8px",
          marginBottom: "8px",
          display: "block",
        }
      );
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 6) HELPER METHODS
  // ─────────────────────────────────────────────────────────────
  /**
   * Adds a color “swatch” button that, when clicked, opens our *reusable* colorPicker menu.
   */
  private addColorPicker(
    label: string,
    defaultColor: string,
    onChange: (color: string) => void,
    parent: HTMLElement = this.contentArea
  ): void {
    // Container row
    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "8px",
      fontFamily: "sans-serif",
      fontSize: "16px",
    });

    // Label
    const lbl = document.createElement("span");
    lbl.innerText = label;
    container.appendChild(lbl);

    // Swatch (div) that shows the currently selected color
    const swatch = document.createElement("div");
    Object.assign(swatch.style, {
      width: "26px",
      height: "26px",
      borderRadius: "4px",
      cursor: "pointer",
      border: "1px solid #999",
      backgroundColor: defaultColor,
    });
    container.appendChild(swatch);

    // When user clicks the swatch, open the REUSABLE colorPicker
    swatch.addEventListener("click", (ev: MouseEvent) => {
      // 1) Update the colorPicker's current color and callback
      this.colorPicker!.update(swatch.style.backgroundColor, (newColor) => {
        // We'll also set the swatch's background to the newly chosen color
        swatch.style.backgroundColor = newColor;
        onChange(newColor);
      });

      // 2) Open the colorPicker near the clicked swatch
      this.colorPicker!.openMenu(ev, swatch.offsetWidth, (newColor) => {
        // This "applySelection" callback is also triggered whenever the user picks a color
        swatch.style.backgroundColor = newColor;
        onChange(newColor);
      });
    });

    parent.appendChild(container);
  }
  /**
   * Adds a dropdown (select) control.
   * @param label The label to display.
   * @param options An array of option strings.
   * @param onChange Callback function when the selected option changes.
   * @param initial (Optional) The initial value to pre-select.
   */
  private addDropdown(
    label: string,
    options: string[],
    onChange: (selected: string) => void,
    initial?: string
  ) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.style.marginBottom = "8px";

    const lbl = document.createElement("span");
    lbl.innerText = label;
    container.appendChild(lbl);

    const select = document.createElement("select");
    select.style.backgroundColor = "#444";
    select.style.color = "#fff";
    select.style.border = "1px solid #555";
    select.style.borderRadius = "4px";
    select.style.outline = "none";

    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.innerText = opt;
      if (initial && opt === initial) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    if (initial) {
      select.value = initial;
    }

    select.onchange = () => onChange(select.value);
    container.appendChild(select);
    this.contentArea.appendChild(container);
  }

  private addButton(
    label: string,
    onClick: (event?: MouseEvent) => void,
    customStyle?: Partial<CSSStyleDeclaration>
  ) {
    const button = document.createElement("button");
    button.innerText = label;
    Object.assign(button.style, {
      padding: "8px 12px",
      margin: "4px 0",
      backgroundColor: "#008CBA",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontFamily: "sans-serif",
      fontSize: "16px",
    });
    if (customStyle) {
      Object.assign(button.style, customStyle);
    }
    button.onclick = onClick;
    this.contentArea.appendChild(button);
  }

  /**
   * Adds a numeric input field.
   */
  private addNumberField(
    label: string,
    initial: number,
    onChange: (val: number) => void
  ) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.style.marginBottom = "8px";

    const lbl = document.createElement("span");
    lbl.innerText = label;
    container.appendChild(lbl);

    const input = document.createElement("input");
    input.type = "number";
    input.value = initial.toString();
    input.style.width = "60px";
    input.style.backgroundColor = "#444";
    input.style.color = "#fff";
    input.style.border = "1px solid #555";
    input.style.borderRadius = "4px";
    input.oninput = () => {
      const val = parseFloat(input.value);
      onChange(isNaN(val) ? 0 : val);
    };

    container.appendChild(input);
    this.contentArea.appendChild(container);
  }

  /**
   * Adds a checkbox control.
   */
  private addCheckbox(
    label: string,
    initial: boolean,
    onChange: (checked: boolean) => void
  ) {
    const container = document.createElement("label");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.marginBottom = "8px";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = initial;
    input.style.marginRight = "8px";
    input.onchange = () => onChange(input.checked);
    container.appendChild(input);

    const span = document.createElement("span");
    span.innerText = label;
    container.appendChild(span);

    this.contentArea.appendChild(container);
  }

  /**
   * Retrieves the current option value from the chart given a dot‑separated path.
   */
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

  /**
   * Toggles the chart’s background type between solid and vertical-gradient.
   */
  private toggleBackgroundType(): void {
    // Get the current background settings
    const currentBg = this.handler.chart.options().layout?.background;

    // If there's no background at all, define a fallback
    if (!currentBg) {
      // Example: default to solid white
      this.handler.chart.applyOptions({
        layout: {
          background: {
            type: ColorType.Solid,
            color: "#FFFFFF",
          },
        },
      });
      this.buildLayoutOptionsTab();
      return;
    }

    // Check what the current background type is
    if (currentBg.type === ColorType.Solid) {
      // We are going from SOLID => VERTICAL GRADIENT

      // Use the current solid color as the topColor, or fallback
      const existingSolidColor = currentBg.color || "#FFFFFF";

      // Optionally, if you previously stored a bottom color somewhere,
      // you can retrieve that. Otherwise, pick a fallback:
      const defaultBottom = "rgba(0,255,0,0.33)";

      const updatedBackground = {
        type: ColorType.VerticalGradient,
        topColor: existingSolidColor,
        bottomColor: defaultBottom,
      };

      this.handler.chart.applyOptions({
        layout: { background: updatedBackground },
      });
    } else if (currentBg.type === ColorType.VerticalGradient) {
      // We are going from VERTICAL GRADIENT => SOLID

      // Choose which gradient color to adopt as your new "solid" color.
      // Often the top color is used, but you could pick bottom if you prefer.
      const currentTop = currentBg.topColor || "#FFFFFF";

      const updatedBackground = {
        type: ColorType.Solid,
        color: currentTop,
      };

      this.handler.chart.applyOptions({
        layout: { background: updatedBackground },
      });
    } else {
      // If it's some other background type or missing fields,
      // fallback to a default
      console.warn("Unknown background type. Falling back to solid #FFFFFF.");

      this.handler.chart.applyOptions({
        layout: {
          background: {
            type: ColorType.Solid,
            color: "#FFFFFF",
          },
        },
      });
    }

    // Finally, refresh the Layout Options tab so the new colors become current.
    this.buildLayoutOptionsTab();
  }

  /***********************************************************
   * 4. Helper Methods for UI Controls
   ***********************************************************/

  /** Simple function to create a text input row. */
  private addTextInput(
    label: string,
    defaultValue: string,
    onChange: (val: string) => void
  ) {
    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "8px",
      fontFamily: "sans-serif",
      fontSize: "16px",
    });
    const lbl = document.createElement("span");
    lbl.innerText = label;
    container.appendChild(lbl);

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    Object.assign(input.style, {
      width: "150px",
      padding: "4px",
      backgroundColor: "#444",
      color: "#fff",
      border: "1px solid #555",
      borderRadius: "4px",
    });
    input.oninput = () => onChange(input.value);

    container.appendChild(input);
    this.contentArea.appendChild(container);
  }
// At the top of your class, add a record to store original opacities by label.

/**
 * Adds two color swatches for “Up” and “Down” colors, plus a checkbox
 * that toggles both to alpha=0 when disabled and restores the original opacity
 * when enabled. Uses the single ColorPicker instance.
 *
 * The original opacity settings are stored in a class-level record, keyed by the label.
 */
private addSideBySideColors(
  label: string,
  defaultUpColor: string,
  defaultDownColor: string,
  onChange: (upColor: string, downColor: string) => void,
  parent: HTMLElement = this.contentArea
): void {
  // 1) Create row container for checkbox, label, and swatches
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    marginBottom: "8px",
    gap: "12px",
  });


  // 2) Checkbox to enable/disable alpha=0
  const enabledCheck = document.createElement("input");
  enabledCheck.type = "checkbox";
  enabledCheck.checked =  !(getAlphaFromColor(defaultUpColor) === 0 && getAlphaFromColor(defaultDownColor) === 0);; // Start “enabled”
  row.appendChild(enabledCheck);

  // 3) Label
  const lbl = document.createElement("span");
  lbl.innerText = label;
  Object.assign(lbl.style, { minWidth: "60px" });
  row.appendChild(lbl);

  // 4) Container for the up/down swatches
  const pickersContainer = document.createElement("div");
  Object.assign(pickersContainer.style, {
    display: "flex",
    gap: "8px",
  });
  row.appendChild(pickersContainer);

  // Track the “current” colors
  let currentUpColor = defaultUpColor;
  let currentDownColor = defaultDownColor;


  // If not already stored, record the original opacities for this label.
  if (!(label in this._originalOpacities)) {
    this._originalOpacities[label] = {
      up: getAlphaFromColor(defaultUpColor) ??1,
      down: getAlphaFromColor(defaultDownColor) ??1,
    };
  } 


  // 5) Create the two swatches (Up and Down)
  const upSwatch = document.createElement("div");
  Object.assign(upSwatch.style, {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    cursor: "pointer",
    border: "1px solid #999",
    backgroundColor: currentUpColor,
  });

  const downSwatch = document.createElement("div");
  Object.assign(downSwatch.style, {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    cursor: "pointer",
    border: "1px solid #999",
    backgroundColor: currentDownColor,
  });

  pickersContainer.appendChild(upSwatch);
  pickersContainer.appendChild(downSwatch);

  // Helper: notify the outside world about color changes
  const fireChange = () => {
    onChange(currentUpColor, currentDownColor);
  };
  // 6) Checkbox logic: when toggled, update the colors' opacity and adjust the checkbox state.
  enabledCheck.addEventListener("change", () => {
    if (enabledCheck.checked) {
      // Re-enabling: restore saved colors with original opacity from our record.
      currentUpColor = setOpacity(
        currentUpColor,
        this._originalOpacities[label].up ?? getAlphaFromColor(defaultUpColor)
      );
      currentDownColor = setOpacity(
        currentDownColor,
        this._originalOpacities[label].down ?? getAlphaFromColor(defaultDownColor)
      );
      upSwatch.style.border = "1px solid #999";
      downSwatch.style.border = "1px solid #999";
    } else {
      // Disabling: save current colors, then set opacity to 0.
      this._originalOpacities[label].up = getAlphaFromColor(currentUpColor);
      this._originalOpacities[label].down = getAlphaFromColor(currentDownColor);
      currentUpColor = setOpacity(currentUpColor, 0);
      currentDownColor = setOpacity(currentDownColor, 0);
      // Remove borders when disabled.
      upSwatch.style.border = "0px";
      downSwatch.style.border = "0px";
  
    }  
  
    upSwatch.style.backgroundColor = currentUpColor;
    downSwatch.style.backgroundColor = currentDownColor;
    // After the change, adjust the checkbox state based on the new opacity.
    enabledCheck.checked = !(
      getAlphaFromColor(currentUpColor) === 0 &&
      getAlphaFromColor(currentDownColor) === 0
    );
    fireChange();
  });

  // 7) Up swatch event: open color picker for up color.
  upSwatch.addEventListener("click", (evt: MouseEvent) => {
    if (!enabledCheck.checked) {
      enabledCheck.checked = true;
      enabledCheck.dispatchEvent(new Event("change"));
    }
 
    this.colorPicker!.openMenu(evt, upSwatch.offsetWidth + downSwatch.offsetWidth, (finalColor) => {
      currentUpColor = finalColor;
      upSwatch.style.backgroundColor = finalColor;
      fireChange();
    });
  });

  // 8) Down swatch event: open color picker for down color.
  downSwatch.addEventListener("click", (evt: MouseEvent) => {
    if (!enabledCheck.checked) {
      enabledCheck.checked = true;
      enabledCheck.dispatchEvent(new Event("change"));
    }
   
    this.colorPicker!.openMenu(evt, downSwatch.offsetWidth, (finalColor) => {
      currentDownColor = finalColor;
      downSwatch.style.backgroundColor = finalColor;
      fireChange();
    });
  });

  // 9) Finally, append the row to the parent element.
  parent.appendChild(row);
}



/**
 * Builds color controls for a primitive's options.
 * It groups related color options if both keys (e.g. upColor/downColor) exist;
 * for remaining keys that include "color", it creates a single color picker.
 * After any change, it calls updateFn with the new options so that
 * primitive.applyOptions() can be invoked.
 *
 * @param options The options object to process.
 * @param parent The container element to which the controls are appended.
 * @param updateFn A callback to update the primitive (typically, primitive.applyOptions(newOpts)).
 */
private buildPrimitiveColorOptions(
  options: Record<string, any>,
  parent: HTMLElement,
  updateFn: (newOpts: Record<string, any>) => void
): void {
  // Define groups of related color keys.
  const groups: Record<string, [string, string]> = {
    "Body": ["upColor", "downColor"],
    "Borders": ["borderUpColor", "borderDownColor"],
    "Wick": ["wickUpColor", "wickDownColor"]
  };

  // Track which keys have been processed.
  const processedKeys = new Set<string>();

  // Process each defined group.
  for (const groupLabel in groups) {
    const [key1, key2] = groups[groupLabel];
    if (key1 in options && key2 in options) {
      processedKeys.add(key1);
      processedKeys.add(key2);
      this.addSideBySideColors(
        groupLabel,
        options[key1],
        options[key2],
        (upColor: string, downColor: string) => {
          options[key1] = upColor;
          options[key2] = downColor;
          updateFn(options);
        },
        parent
      );
    }
  }

  // For any remaining keys that include "color" and weren't grouped:
  Object.keys(options).forEach((key) => {
    if (key.toLowerCase().includes("color") && !processedKeys.has(key)) {
      this.addColorPicker(
        key,
        options[key],
        (newColor: string) => {
          options[key] = newColor;
          updateFn(options);
        },
        parent
      );
    }
  });
}


};

/**
 * Iterates through each series in handler.seriesMap.
 * For each series, walks through its .options(), searching for property keys containing "color".
 */
function logSeriesColorsFromMap(this: any): void {
  // Make sure seriesMap exists
  if (!this.handler || !this.handler.seriesMap) {
    console.warn("No seriesMap found on handler.");
    return;
  }

  // Convert the Map to an array of [seriesName, seriesObject]
  const seriesEntries = Array.from(this.handler.seriesMap.entries()) as [
    string,
    any
  ][];

  if (seriesEntries.length === 0) {
    console.warn("Series map is empty. No series found.");
    return;
  }

  // Loop over each series
  for (const [seriesName, series] of seriesEntries) {
    const seriesOptions = series.options?.();
    // If .options() doesn’t exist, skip
    if (!seriesOptions) {
      console.warn(`Series "${seriesName}" has no options() method.`);
      continue;
    }

    console.group(`Color keys for Series: "${seriesName}"`);

    // Recursively find any property that has "color" in its key
    findColorOptions(seriesOptions, (path, val) => {
      console.log(`Found color: ${path} =`, val);
    });

    console.groupEnd();
  }

 
}




/* 
  Example usage somewhere in your code:
  
  logSeriesColorsFromMap.call(this);

  This will print to the console something like:

    > Color keys for Series: "MyCandles"
      Found color: upColor = "#1565C0"
      Found color: downColor = "#8B4513"
      Found color: borderUpColor = "#00FF00"
      Found color: borderDownColor = "#FF0000"
      ...
*/
