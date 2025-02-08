import { ColorType, LineStyle, PriceScaleMode } from "lightweight-charts";
import { ColorPicker } from "./color-picker"; // Or wherever your color picker is
import { GlobalParams } from "../general/global-params";
import { Handler } from "../general";

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

  /**
   * Pass in your chart handler so that the modal controls can read and update chart options.
   */
  constructor(handler: any) {
    this.handler = handler;

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
        label: "Time Scale Options",
        buildContent: () => this.buildTimeScaleOptionsTab(),
      },
      {
        id: "price-scale-options",
        label: "Price Scale Options",
        buildContent: () => this.buildPriceScaleOptionsTab(),
      },

      {
        id: "series-list",
        label: "Series List",
        buildContent: () => this.buildSeriesListTab(),
      },

      {
        id: "defaults-list",
        label: "Defaults",
        buildContent: () => this.buildDefaultsListTab(),
      },
    ];


    // Build left-nav buttons
    this.categories.forEach((cat) => {
      const catBtn = document.createElement("div");
      catBtn.innerText = cat.label;
      catBtn.style.padding = "8px 16px";
      catBtn.style.cursor = "pointer";
      catBtn.style.borderBottom = "1px solid #3C3C3C";
      catBtn.addEventListener("click", () => this.switchCategory(cat.id));
      leftNav.appendChild(catBtn);
    });

    // Start with the first category active.
    if (this.categories.length > 0) {
      this.switchCategory(this.categories[0].id);
    }
  }

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
  }

  public close(confirmed: boolean) {
    // If “Ok” was clicked, do final logic (like saving user changes).
    if (confirmed) {
      console.log("Settings Modal: OK clicked. Save changes here.");
      // Save logic if needed.
    } else {
      console.log("Settings Modal: Cancel clicked.");
      // Rollback logic if needed.
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

  /**
   * Switches to a new category by ID, building content on the right side.
   */
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
    title.style.fontSize = "14px";
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
    } else if (currentBackground && currentBackground.type === ColorType.VerticalGradient) {
      // Gradient background colors
      const topColor = currentBackground.topColor || "rgba(255,0,0,0.33)";
      const bottomColor = currentBackground.bottomColor || "rgba(0,255,0,0.33)";
      this.addColorPicker("Top Color", topColor, (color: string) => {
        this.handler.chart.applyOptions({
          layout: {
            background: { type: ColorType.VerticalGradient, topColor: color, bottomColor },
          },
        });
      });
      this.addColorPicker("Bottom Color", bottomColor, (color: string) => {
        this.handler.chart.applyOptions({
          layout: {
            background: { type: ColorType.VerticalGradient, topColor, bottomColor: color },
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
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);

    // Vertical grid line color
    const vertLineColor =
      this.getCurrentOptionValue("grid.vertLines.color") || "#D6DCDE";
    this.addColorPicker("Vertical Line Color", vertLineColor, (color: string) => {
      this.handler.chart.applyOptions({ grid: { vertLines: { color } } });
    });

    // Horizontal grid line color
    const horzLineColor =
      this.getCurrentOptionValue("grid.horzLines.color") || "#D6DCDE";
    this.addColorPicker("Horizontal Line Color", horzLineColor, (color: string) => {
      this.handler.chart.applyOptions({ grid: { horzLines: { color } } });
    });

    // 1) Build a lookup that maps the user-friendly string to the numeric enum
const styleMapping: Record<string, LineStyle> = {
    "Solid": LineStyle.Solid,
    "Dotted": LineStyle.Dotted,
    "Dashed": LineStyle.Dashed,
    "LargeDashed": LineStyle.LargeDashed,
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
    const defaultHorzStyle = "Solid";
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
    const vertVisible = this.getCurrentOptionValue("grid.vertLines.visible") !== false;
    this.addCheckbox("Show Vertical Lines", vertVisible, (visible: boolean) => {
      this.handler.chart.applyOptions({ grid: { vertLines: { visible } } });
    });
    const horzVisible = this.getCurrentOptionValue("grid.horzLines.visible") !== false;
    this.addCheckbox("Show Horizontal Lines", horzVisible, (visible: boolean) => {
      this.handler.chart.applyOptions({ grid: { horzLines: { visible } } });
    });
  }

  /**
   * Crosshair Options Tab  
   * Provides controls for crosshair and its line colors.
   */
  private buildCrosshairOptionsTab(): void {
    const title = document.createElement("div");
    title.innerText = "Crosshair Options";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);



    // Vertical crosshair line color
    const vertLineColor =
      this.getCurrentOptionValue("crosshair.vertLine.color") || "#000000";
    this.addColorPicker("Vertical Line Color", vertLineColor, (color: string) => {
      this.handler.chart.applyOptions({ crosshair: { vertLine: { color } } });
    });

    // Horizontal crosshair line color
    const horzLineColor =
      this.getCurrentOptionValue("crosshair.horzLine.color") || "#000000";
    this.addColorPicker("Horizontal Line Color", horzLineColor, (color: string) => {
      this.handler.chart.applyOptions({ crosshair: { horzLine: { color } } });
    });
  }

  /**
   * Time Scale Options Tab  
   * Provides numeric and boolean controls for time scale settings.
   */
  private buildTimeScaleOptionsTab(): void {
    const title = document.createElement("div");
    title.innerText = "Time Scale Options";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);

    // Right Offset
    const rightOffset = this.getCurrentOptionValue("timeScale.rightOffset") || 0;
    this.addNumberField("Right Offset", rightOffset, (val: number) => {
      this.handler.chart.applyOptions({ timeScale: { rightOffset: val } });
    });
    // Bar Spacing
    const barSpacing = this.getCurrentOptionValue("timeScale.barSpacing") || 10;
    this.addNumberField("Bar Spacing", barSpacing, (val: number) => {
      this.handler.chart.applyOptions({ timeScale: { barSpacing: val } });
    });
    // Min Bar Spacing
    const minBarSpacing = this.getCurrentOptionValue("timeScale.minBarSpacing") || 0.1;
    this.addNumberField("Min Bar Spacing", minBarSpacing, (val: number) => {
      this.handler.chart.applyOptions({ timeScale: { minBarSpacing: val } });
    });

    // Additional checkboxes (e.g., Fix Left/Right Edge, Lock Visible Range, etc.)
    const fixLeftEdge = this.getCurrentOptionValue("timeScale.fixLeftEdge") || false;
    this.addCheckbox("Fix Left Edge", fixLeftEdge, (val: boolean) => {
      this.handler.chart.applyOptions({ timeScale: { fixLeftEdge: val } });
    });
    const fixRightEdge = this.getCurrentOptionValue("timeScale.fixRightEdge") || false;
    this.addCheckbox("Fix Right Edge", fixRightEdge, (val: boolean) => {
      this.handler.chart.applyOptions({ timeScale: { fixRightEdge: val } });
    });
    const lockVisibleRange = this.getCurrentOptionValue("timeScale.lockVisibleTimeRangeOnResize") || false;
    this.addCheckbox("Lock Visible Range on Resize", lockVisibleRange, (val: boolean) => {
      this.handler.chart.applyOptions({ timeScale: { lockVisibleTimeRangeOnResize: val } });
    });
    const visible = this.getCurrentOptionValue("timeScale.visible");
    this.addCheckbox("Time Scale Visible", visible !== false, (val: boolean) => {
      this.handler.chart.applyOptions({ timeScale: { visible: val } });
    });
    const borderVisible = this.getCurrentOptionValue("timeScale.borderVisible");
    this.addCheckbox("Border Visible", borderVisible !== false, (val: boolean) => {
      this.handler.chart.applyOptions({ timeScale: { borderVisible: val } });
    });
    const borderColor = this.getCurrentOptionValue("timeScale.borderColor") || "#000000";
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
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    this.contentArea.appendChild(title);

    // For this example, we use the "right" price scale.
    const priceScale = this.handler.chart.priceScale("right");
    const currentMode: PriceScaleMode =
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
    const autoScale = priceScale.options().autoScale !== undefined
      ? priceScale.options().autoScale
      : true;
    this.addCheckbox("Auto Scale", autoScale, (val: boolean) => {
      priceScale.applyOptions({ autoScale: val });
    });
    const invertScale = priceScale.options().invertScale || false;
    this.addCheckbox("Invert Scale", invertScale, (val: boolean) => {
      priceScale.applyOptions({ invertScale: val });
    });
    const alignLabels = priceScale.options().alignLabels !== undefined
      ? priceScale.options().alignLabels
      : true;
    this.addCheckbox("Align Labels", alignLabels, (val: boolean) => {
      priceScale.applyOptions({ alignLabels: val });
    });
    const borderVisible = priceScale.options().borderVisible !== undefined
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

  // ── Series List Tab ──
  // This new tab lists all series. Clicking on one “opens” a new page with series settings.
  private buildSeriesListTab(): void {
    const title = document.createElement("div");
    title.innerText = "Series List";
    Object.assign(title.style, { fontSize: "16px", fontWeight: "bold", marginBottom: "12px" });
    this.contentArea.appendChild(title);

  
    // Get all series from handler.seriesMap.
    const seriesEntries = Array.from(this.handler.seriesMap.entries()) as [string, any][];
    seriesEntries.forEach(([seriesName, series]) => {
      this.addButton(seriesName, () => this.buildSeriesMenuTab(series), {
        backgroundColor: "#444",
        borderRadius: "8px",
      });
    });
  }
  // ── Series Menu Tab ──
  // When a series is selected, this method “opens” a new page with its settings.
  private buildSeriesMenuTab(series: any): void {
    // Clear content area to simulate a new page.
    this.contentArea.innerHTML = "";
    const title = document.createElement("div");
    title.innerText = "Series Settings - " + (series.options().title || "Untitled");
    Object.assign(title.style, { fontSize: "16px", fontWeight: "bold", marginBottom: "12px" });
    this.contentArea.appendChild(title);

    // Example: allow editing the series title.
    this.addTextInput("Title", series.options().title || "", (newTitle: string) => {
      series.applyOptions({ title: newTitle });
      // Optionally update seriesMap.
      if (this.handler.seriesMap.has(series.options().title)) {
        this.handler.seriesMap.delete(series.options().title);
      }
      this.handler.seriesMap.set(newTitle, series);
    });

    // Stub buttons for additional series settings:
    this.addButton("Clone Series ▸", () => {
      alert("Clone Series functionality not implemented in modal demo.");
    });
    this.addButton("Visibility Options ▸", () => {
      alert("Visibility Options not implemented in modal demo.");
    });
    this.addButton("Style Options ▸", () => {
      alert("Style Options not implemented in modal demo.");
    });
    this.addButton("Width Options ▸", () => {
      alert("Width Options not implemented in modal demo.");
    });
    this.addButton("Color Options ▸", () => {
      alert("Color Options not implemented in modal demo.");
    });
    this.addButton("Price Scale Options ▸", () => {
      alert("Price Scale Options not implemented in modal demo.");
    });
    this.addButton("Primitives ▸", () => {
      alert("Primitives not implemented in modal demo.");
    });
    this.addButton("Indicators ▸", () => {
      alert("Indicators not implemented in modal demo.");
    });
    this.addButton("Export/Import Series Data ▸", () => {
      alert("Export/Import Series Data not implemented in modal demo.");
    });

    // Back button to return to Series List
    this.addButton("⤝ Back to Series List", () => this.buildSeriesListTab(), {
      backgroundColor: "#444",
    });
  }
  private buildDefaultsListTab(): void {
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

    // For each key, add a button to open the default options editor
    allKeys.forEach((key) => {
      this.addButton(
        `Edit "${key}" Defaults`,
        () => {
          // We assume there's a dataMenu in your handler with openDefaultOptions(key)
          if (this.handler.ContextMenu.dataMenu && typeof this.handler.ContextMenu.dataMenu.openDefaultOptions === "function") {
            this.handler.ContextMenu.dataMenu.openDefaultOptions(key);
          } else {
            console.warn("No dataMenu or openDefaultOptions method found on handler.");
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

  /******************************
   * HELPER METHODS (Modern Style)
   ******************************/

  private addColorPicker(label: string, defaultColor: string, onChange: (color: string) => void) {
    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "8px",
      fontFamily: "sans-serif",
      fontSize: "14px",
    });
    const lbl = document.createElement("span");
    lbl.innerText = label;
    container.appendChild(lbl);

    const input = document.createElement("input");
    input.type = "color";
    input.value = defaultColor;
    Object.assign(input.style, {
      border: "none",
      borderRadius: "8px",
      width: "32px",
      height: "32px",
      cursor: "pointer",
      padding: "2px",
    });
    input.oninput = () => onChange(input.value);
    container.appendChild(input);
    this.contentArea.appendChild(container);
  }
  /**
   * Adds a dropdown (select) control.
   */
  private addDropdown(label: string, options: string[], onChange: (selected: string) => void) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.marginBottom = "8px";
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
      select.appendChild(option);
    });
    select.onchange = () => onChange(select.value);
    container.appendChild(select);
    this.contentArea.appendChild(container);
  }
  private addButton(label: string, onClick: () => void, customStyle?: Partial<CSSStyleDeclaration>) {
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
      fontSize: "14px",
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
  private addNumberField(label: string, initial: number, onChange: (val: number) => void) {
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
  private addCheckbox(label: string, initial: boolean, onChange: (checked: boolean) => void) {
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
    const currentBackground = this.handler.chart.options().layout?.background;
    let updatedBackground: any;

    if (currentBackground && currentBackground.type === "solid") {
      updatedBackground = {
        type: ColorType.VerticalGradient,
        topColor: "rgba(255,0,0,0.2)",
        bottomColor: "rgba(0,255,0,0.2)",
      };
    } else {
      updatedBackground = {
        type: "solid",
        color: "#000000",
      };
    }

    this.handler.chart.applyOptions({
      layout: { background: updatedBackground },
    });
    // Refresh the Layout Options tab so the new colors become current.
    this.buildLayoutOptionsTab();
  }

   /***********************************************************
     * 4. Helper Methods for UI Controls
     ***********************************************************/
  
    /** Simple function to create a text input row. */
    private addTextInput(label: string, defaultValue: string, onChange: (val: string) => void) {
        const container = document.createElement("div");
        Object.assign(container.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
          fontFamily: "sans-serif",
          fontSize: "14px",
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
}