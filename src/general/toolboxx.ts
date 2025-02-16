/* ---------------------------------- */
/*   Interfaces for the new approach  */
/* ---------------------------------- */

/**
 * Basic interface that all Toolbox buttons must implement
 * for the new, more generic approach.
 */
export interface IToolBoxButton {
    buttonElement: HTMLDivElement;
    hotKey?: string;
    onClick: () => void;
  }
  
  /**
   * For buttons that involve a "drawing" mode,
   * we add an optional deactivate() method and any special properties.
   */
  export interface IDrawingToolButton extends IToolBoxButton {
    /**
     * Called by the ToolBox when another drawing button is selected
     * or we want to stop the current drawing mode.
     */
    deactivate: () => void;
  }
  
  
  /* ---------------------------------- */
  /*        Example new button          */
  /* ---------------------------------- */
  
  /**
   * An example of a non-drawing button that toggles some feature (e.g. a grid).
   * It's recognized by the Toolbox as an IToolBoxButton, so it
   * doesn't interfere with drawing logic.
   */
  export class ToggleGridButton implements IToolBoxButton {
    public buttonElement: HTMLDivElement;
    public hotKey: string | undefined;
  
    constructor(hotKey?: string) {
      this.hotKey = hotKey;
      this.buttonElement = this._createButton();
    }
  
    public onClick = (): void => {
      // Perform non-drawing action, e.g. toggling grid lines
      console.log('Toggling grid lines!');
    };
  
    private _createButton(): HTMLDivElement {
      const btn = document.createElement('div');
      btn.classList.add('toolbox-button');
      btn.textContent = 'Grid'; // You could place an SVG here as well
      return btn;
    }
  }
  
  
  /* ---------------------------------- */
  /*      OLD CODE + NEW CODE           */
  /*    "Hybrid" ToolBox Implementation */
  /* ---------------------------------- */
  
  import { DrawingTool } from "../drawing/drawing-tool";
  import { TrendLine } from "../trend-line/trend-line";
  import { Box } from "../box/box";
  import { Drawing } from "../drawing/drawing";
  import { GlobalParams } from "./global-params";
  import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
  import { HorizontalLine } from "../horizontal-line/horizontal-line";
  import { RayLine } from "../horizontal-line/ray-line";
  import { VerticalLine } from "../vertical-line/vertical-line";
  import { Handler } from "./handler";
  import { PitchFork } from "../pitchfork/pitchfork";
  
  interface Icon {
    div: HTMLDivElement;
    group: SVGGElement;
    type: new (...args: any[]) => Drawing;
  }
  
  declare const window: GlobalParams;
  
  export class ToolBox {
    div: HTMLDivElement;
    private activeIcon: Icon | null = null;
    private buttons: HTMLDivElement[] = [];
    private _commandFunctions: Array<(event: KeyboardEvent) => boolean>;
    private _handlerID: string;
    private _drawingTool: DrawingTool;
    private handler: Handler;
  
    // Additional storage for the *new* approach
    private _registeredButtons: IToolBoxButton[] = [];
    private _activeButton: IDrawingToolButton | null = null;
  
    // Old SVG references, for your existing tools:
    private static readonly TREND_SVG = '<rect x="3.84" y="13.67" .../>';
    private static readonly HORZ_SVG = '<rect x="4" y="14" .../>';
    private static readonly RAY_SVG  = '<rect x="8" y="14" .../>';
    private static readonly BOX_SVG  = '<rect x="8" y="6" .../>';
    private static readonly VERT_SVG = ToolBox.RAY_SVG;
    private static readonly PITCHFORK_SVG = '<svg xmlns="http://www.w3.org/...">...</svg>';
  
    constructor(
      handler: Handler,
      handlerID: string,
      chart: IChartApi,
      series: ISeriesApi<SeriesType>,
      commandFunctions: Array<(event: KeyboardEvent) => boolean>
    ) {
      this._handlerID = handlerID;
      this._commandFunctions = commandFunctions;
      this._drawingTool = new DrawingTool(chart, series, () => this.removeActiveAndSave());
      this.div = this._makeToggleToolBox();
      this.handler = handler;
  
      // For context menu, etc.
      this.handler.ContextMenu.setupDrawingTools(this.saveDrawings, this._drawingTool);
  
      // Example undo function
      commandFunctions.push((event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.code === "KeyZ") {
          const drawingToDelete = this._drawingTool.drawings.pop();
          if (drawingToDelete) this._drawingTool.delete(drawingToDelete);
          return true;
        }
        return false;
      });
  
      // Create old-style existing drawing buttons
      this._initializeOldDrawingButtons();
    }
  
    toJSON() {
      // Exclude the chart attribute from serialization, etc.
      const { ...serialized } = this;
      return serialized;
    }
  
    /* 
     * The old approach: Create the top container with a hideable flyout panel,
     * along with a toggle tab at the bottom.
     */
    private _makeToggleToolBox(): HTMLDivElement {
      const outerDiv = document.createElement("div");
      outerDiv.classList.add("flyout-toolbox");
  
      // Position and styling
      outerDiv.style.position = "absolute";
      outerDiv.style.top = "0";
      outerDiv.style.left = "50%";
      outerDiv.style.transform = "translateX(-50%)";
      outerDiv.style.zIndex = "1000";
      outerDiv.style.overflow = "hidden";
      outerDiv.style.transition = "height 0.3s ease";
  
      const contentDiv = document.createElement("div");
      contentDiv.classList.add("toolbox-content");
      contentDiv.style.display = "none"; // Initially hidden
      contentDiv.style.flexDirection = "row";
      contentDiv.style.justifyContent = "center";
      contentDiv.style.alignItems = "center";
      contentDiv.style.padding = "5px";
      contentDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      contentDiv.style.display = "inline-flex";
  
      // We want to keep the reference in place so we can
      // append new buttons from the *new* approach as well.
      outerDiv.appendChild(contentDiv);
  
      const toggleTab = document.createElement("div");
      toggleTab.textContent = "▼";
      toggleTab.style.width = "15px";
      toggleTab.style.height = "10px";
      toggleTab.style.backgroundColor = "rgba(0, 0, 0, 0)";
      toggleTab.style.color = "#fff";
      toggleTab.style.textAlign = "center";
      toggleTab.style.lineHeight = "15px";
      toggleTab.style.cursor = "pointer";
  
      outerDiv.appendChild(toggleTab);
  
      const tabHeight = 15;
      let expanded = false;
      outerDiv.style.height = `${tabHeight}px`;
  
      toggleTab.onclick = () => {
        expanded = !expanded;
        if (expanded) {
          contentDiv.style.display = "inline-flex";
          const contentHeight = contentDiv.scrollHeight;
          outerDiv.style.height = `${tabHeight + contentHeight}px`;
          toggleTab.textContent = "▲";
        } else {
          contentDiv.style.display = "none";
          outerDiv.style.height = `${tabHeight}px`;
          toggleTab.textContent = "▼";
        }
      };
  
      return outerDiv;
    }
  
    /**
     * Creates the old approach "default" drawing buttons and hooks them up.
     * This is what you originally had. It's left intact for backward compatibility.
     */
    private _initializeOldDrawingButtons(): void {
      const contentDiv = this.div.querySelector(".toolbox-content") as HTMLDivElement;
  
      // Create your old style drawing buttons
      this.buttons = [];
      this.buttons.push(this._makeToolBoxElement(TrendLine, "KeyT", ToolBox.TREND_SVG));
      this.buttons.push(this._makeToolBoxElement(HorizontalLine, "KeyH", ToolBox.HORZ_SVG));
      this.buttons.push(this._makeToolBoxElement(RayLine, "KeyR", ToolBox.RAY_SVG));
      this.buttons.push(this._makeToolBoxElement(Box, "KeyB", ToolBox.BOX_SVG));
      this.buttons.push(this._makeToolBoxElement(VerticalLine, "KeyV", ToolBox.VERT_SVG, true));
      this.buttons.push(this._makeToolBoxElement(PitchFork, "KeyP", ToolBox.PITCHFORK_SVG));
  
      // Append them
      for (const button of this.buttons) {
        contentDiv.appendChild(button);
      }
    }
  
    /**
     * The old function that creates a single button for a drawing tool,
     * hooking up the click event, the hotkey, etc.
     */
    private _makeToolBoxElement(
      DrawingType: new (...args: any[]) => Drawing,
      keyCmd: string,
      paths: string,
      rotate = false
    ): HTMLDivElement {
      const elem = document.createElement("div");
      elem.classList.add("toolbox-button");
  
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "29");
      svg.setAttribute("height", "29");
  
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.innerHTML = paths;
      group.setAttribute("fill", window.pane.color);
  
      svg.appendChild(group);
      elem.appendChild(svg);
  
      const icon: Icon = { div: elem, group, type: DrawingType };
  
      elem.addEventListener("click", () => this._onIconClick(icon));
  
      this._commandFunctions.push((event: KeyboardEvent) => {
        if (this._handlerID !== window.handlerInFocus) return false;
        if (event.altKey && event.code === keyCmd) {
          event.preventDefault();
          this._onIconClick(icon);
          return true;
        }
        return false;
      });
  
      if (rotate) {
        svg.style.transform = "rotate(90deg)";
        svg.style.transformBox = "fill-box";
        svg.style.transformOrigin = "center";
      }
  
      return elem;
    }
  
    /**
     * The old approach: handle a click on an Icon-based button (drawing tool).
     */
    private _onIconClick(icon: Icon) {
      if (this.activeIcon) {
        this.activeIcon.div.classList.remove("active-toolbox-button");
        window.setCursor("crosshair");
        this._drawingTool?.stopDrawing();
        if (this.activeIcon === icon) {
          // Clicking same icon again -> turn off
          this.activeIcon = null;
          return;
        }
      }
      this.activeIcon = icon;
      this.activeIcon.div.classList.add("active-toolbox-button");
      window.setCursor("crosshair");
      this._drawingTool?.beginDrawing(this.activeIcon.type);
    }
  
    /**
     * Removes the active old-style icon button highlight
     * and triggers a save.
     */
    public removeActiveAndSave = (): void => {
      window.setCursor("default");
      if (this.activeIcon) {
        this.activeIcon.div.classList.remove("active-toolbox-button");
      }
      this.activeIcon = null;
      this.saveDrawings();
    };
  
    /* 
     * -------------------------------
     *   NEW, MORE GENERIC METHODS
     * -------------------------------
     */
  
    /**
     * Register a new button that follows the IToolBoxButton interface.
     * This can be a drawing or a non-drawing button.
     */
    public registerButton(button: IToolBoxButton): void {
      this._registeredButtons.push(button);
  
      // Append to the existing content div so all buttons are visually grouped
      const contentDiv = this.div.querySelector(".toolbox-content") as HTMLDivElement;
      contentDiv.appendChild(button.buttonElement);
  
      // Wire up the click
      button.buttonElement.addEventListener("click", () => {
        this._onGenericButtonClick(button);
      });
  
      // If the button specifies a hotKey, set that up
      if (button.hotKey) {
        this._commandFunctions.push((event: KeyboardEvent) => {
          if (this._handlerID !== window.handlerInFocus) return false;
          if (event.altKey && event.code === button.hotKey) {
            event.preventDefault();
            this._onGenericButtonClick(button);
            return true;
          }
          return false;
        });
      }
    }
  
    /**
     * Handles the newly registered button clicks. If the button is
     * an IDrawingToolButton, we handle activation/deactivation.
     */
    private _onGenericButtonClick(button: IToolBoxButton): void {
      // If it's a drawing tool button, handle exclusive activation
      if ("deactivate" in button) {
        // This is an IDrawingToolButton
        const drawingButton = button as IDrawingToolButton;
        // Deactivate current if we have one
        if (this._activeButton) {
          this._activeButton.deactivate();
          if (this._activeButton === drawingButton) {
            // Same button clicked again -> turn off
            this._activeButton = null;
            window.setCursor("default");
            return;
          }
        }
        // Activate the new one
        this._activeButton = drawingButton;
        window.setCursor("crosshair");
      } else {
        // Non-drawing button logic, e.g. toggle a grid
        window.setCursor("default");
      }
  
      button.onClick();
    }
  
    /* 
     * -------------- 
     *   DRAWINGS
     * --------------
     */
  
    public addNewDrawing(d: Drawing) {
      this._drawingTool.addNewDrawing(d);
    }
  
    public clearDrawings() {
      this._drawingTool.clearDrawings();
    }
  
    public saveDrawings = () => {
      const drawingMeta = [];
      for (const d of this._drawingTool.drawings) {
        drawingMeta.push({
          type: d._type,
          points: d.points,
          options: d._options,
        });
      }
      const string = JSON.stringify(drawingMeta);
      window.callbackFunction(`save_drawings${this._handlerID}_~_${string}`);
    };
  
    public loadDrawings(drawings: any[]) {
      drawings.forEach((d) => {
        switch (d.type) {
          case "Box":
            this._drawingTool.addNewDrawing(new Box(d.points[0], d.points[1], d.options));
            break;
          case "TrendLine":
            this._drawingTool.addNewDrawing(new TrendLine(d.points[0], d.points[1], d.options));
            break;
          case "HorizontalLine":
            this._drawingTool.addNewDrawing(new HorizontalLine(d.points[0], d.options));
            break;
          case "RayLine":
            this._drawingTool.addNewDrawing(new RayLine(d.points[0], d.options));
            break;
          case "VerticalLine":
            this._drawingTool.addNewDrawing(new VerticalLine(d.points[0], d.options));
            break;
          case "PitchFork":
            this._drawingTool.addNewDrawing(new PitchFork(d.points[0], d.points[1], d.points[2], d.options));
            break;
          // Additional future cases here...
        }
      });
    }
  }
  