import { DrawingTool } from "../drawing/drawing-tool";
import { TrendLine } from "../trend-line/trend-line";
import { Box } from "../box/box";
import { Drawing } from "../drawing/drawing";
import { GlobalParams } from "./global-params";
import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { HorizontalLine } from "../horizontal-line/horizontal-line";
import { RayLine } from "../horizontal-line/ray-line";
import { VerticalLine } from "../vertical-line/vertical-line";
import { PitchFork } from "../pitchfork/pitchfork";
import { Measure } from "../measure/measure";
import { Handler } from "./handler";

interface Icon {
    div: HTMLDivElement,
    group: SVGGElement,
    type: new (...args: any[]) => Drawing
}

declare const window: GlobalParams;

export type ToolBoxMode = "static" | "toggle";
export class ToolBox {
  private static readonly ICONS: Record<string, string> = {
    trend: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="3.84" y="13.67" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -5.9847 14.4482)" width="21.21" height="1.56"/><path stroke="#FFFFFF" fill="none" d="M23,3.17L20.17,6L23,8.83L25.83,6L23,3.17z M23,7.41L21.59,6L23,4.59L24.41,6L23,7.41z"/><path stroke="#FFFFFF" fill="none" d="M6,20.17L3.17,23L6,25.83L8.83,23L6,20.17z M6,24.41L4.59,23L6,21.59L7.41,23L6,24.41z"/>',
    horz: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="4" y="14" width="9" height="1"/><rect stroke="#FFFFFF" fill="none" x="16" y="14" width="9" height="1"/><path stroke="#FFFFFF" fill="none" d="M11.67,14.5l2.83,2.83l2.83-2.83l-2.83-2.83L11.67,14.5z M15.91,14.5l-1.41,1.41l-1.41-1.41l1.41-1.41L15.91,14.5z"/>',
    ray: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="8" y="14" width="17" height="1"/><path stroke="#FFFFFF" fill="none" d="M3.67,14.5l2.83,2.83l2.83-2.83L6.5,11.67L3.67,14.5z M7.91,14.5L6.5,15.91L5.09,14.5l1.41-1.41L7.91,14.5z"/>',
    box: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="8" y="6" width="12" height="1"/><rect stroke="#FFFFFF" fill="none" x="9" y="22" width="11" height="1"/><path stroke="#FFFFFF" fill="none" d="M3.67,6.5L6.5,9.33L9.33,6.5L6.5,3.67L3.67,6.5z M7.91,6.5L6.5,7.91L5.09,6.5L6.5,5.09L7.91,6.5z"/><path stroke="#FFFFFF" fill="none" d="M19.67,6.5l2.83,2.83l2.83-2.83L22.5,3.67L19.67,6.5z M23.91,6.5L22.5,7.91L21.09,6.5l1.41-1.41L23.91,6.5z"/><path stroke="#FFFFFF" fill="none" d="M19.67,22.5l2.83,2.83l2.83-2.83l-2.83-2.83L19.67,22.5z M23.91,22.5l-1.41,1.41l-1.41-1.41l1.41-1.41L23.91,22.5z"/><path stroke="#FFFFFF" fill="none" d="M3.67,22.5l2.83,2.83l2.83-2.83L6.5,19.67L3.67,22.5z M7.91,22.5L6.5,23.91L5.09,22.5l1.41-1.41L7.91,22.5z"/><rect stroke="#FFFFFF" fill="none" x="22" y="9" width="1" height="11"/><rect stroke="#FFFFFF" fill="none" x="6" y="9" width="1" height="11"/>',
    vert: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="8" y="14" width="17" height="1"/><path stroke="#FFFFFF" fill="none" d="M3.67,14.5l2.83,2.83l2.83-2.83L6.5,11.67L3.67,14.5z M7.91,14.5L6.5,15.91L5.09,14.5l1.41-1.41L7.91,14.5z"/>',
    pitch: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g stroke="#FFFFFF" stroke-width="0.5" fill="none" fill-rule="nonzero"><path d="M7.275 21.432l12.579-12.579-.707-.707-12.579 12.579z"/><path d="M6.69 13.397l7.913 7.913.707-.707-7.913-7.913z"/><path d="M7.149 10.558l7.058-7.058-.707-.707-7.058 7.058z" id="Line"/><path d="M20.149 21.558l7.058-7.058-.707-.707-7.058 7.558z"/><path d="M5.5 23h11v-1h-11z"/><path d="M4.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"/></g></svg>',
    measure: '<rect stroke="#FFFFFF" fill="none" x="4" y="10" width="20" height="8" rx="1"/><path stroke="#FFFFFF" stroke-width="0.5" fill="none" d="M7 10v4 M11 10v4 M15 10v4 M19 10v4 M23 10v4"/>'
};




  

  public readonly div: HTMLDivElement;
    private activeIcon: Icon | null = null;

    private buttons: HTMLDivElement[] = [];

    private _commandFunctions: Function[];
    private _handlerID: string;
    private _drawingTool: DrawingTool;
    constructor(
        private handler: Handler,
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        commandFunctions: Function[],
        overlay: boolean = true
      ) {
        this._handlerID = this.handler.id;
        this._commandFunctions = commandFunctions;
        this._drawingTool = new DrawingTool(chart, series, () => this.removeActiveAndSave());

    // Support undo (Ctrl+Z / Cmd+Z)
    commandFunctions.push((e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        const last = this._drawingTool.drawings.pop();
        if (last) this._drawingTool.delete(last);
                return true;
            }
            return false;
        });

    // Create toolbox according to overlay flag
    const mode: ToolBoxMode = overlay ? "toggle" : "static";
    this.div = this._createToolBox(handler, mode);

    handler.ContextMenu.setupDrawingTools(this.saveDrawings, this._drawingTool);

    // Global Alt+Key bindings for each icon
    commandFunctions.push((e: KeyboardEvent) => {
      if (this.handler.id !== window.handlerInFocus) return false;
      if (e.altKey) {
        for (const [i, key] of Object.keys(ToolBox.ICONS).entries()) {
          const code = ["M","T","H","R","B","V","P"][i]; // map index to M/T/H/R/B/V/P
          if (e.code === `Key${code}`) {
            e.preventDefault();
            this.buttons[i].click();
            return true;
          }
        }
      }
      return false;
    });
  }

  private _createToolBox(handler: Handler, mode: ToolBoxMode): HTMLDivElement {
    return mode === "toggle" ? this._makeToggleToolBox() : this._makeToolBox();
    }

  private _makeToolBox(): HTMLDivElement {
    const container = document.createElement("div");
    container.classList.add("toolbox");
    this._registerIcon(container, "measure");
    this._registerIcon(container, "trend");
    this._registerIcon(container, "horz");
    this._registerIcon(container, "ray");
    this._registerIcon(container, "box");
    this._registerIcon(container, "vert", true);
    this._registerIcon(container, "pitch");
    return container;
  }

    private _makeToggleToolBox(): HTMLDivElement {
    const outer = document.createElement("div");
    outer.classList.add("flyout-toolbox");
    Object.assign(outer.style, {
      position: "absolute",
      top: "0",
      left: "50%",
      transform: "translateX(-50%)",
      overflow: "hidden",
      transition: "height 0.3s ease",
      zIndex: "1000",
    });

    const content = document.createElement("div");
    content.classList.add("toolbox-content");
    Object.assign(content.style, {
      display: "none",
      inlineFlex: "row",
      padding: "5px",
      backgroundColor: "rgba(0,0,0,0.5)",
    });

    this._registerIcon(content, "measure");
    this._registerIcon(content, "trend");
    this._registerIcon(content, "horz");
    this._registerIcon(content, "ray");
    this._registerIcon(content, "box");
    this._registerIcon(content, "vert", true);
    this._registerIcon(content, "pitch");

    outer.appendChild(content);

    const tab = document.createElement("div");
    tab.textContent = "▼";
    Object.assign(tab.style, {
      width: "15px",
      height: "15px",
      textAlign: "center",
      lineHeight: "15px",
      cursor: "pointer",
      color: "#fff",
      background: "transparent",
    });

        let expanded = false;
    const tabHeight = 15;
    outer.style.height = `${tabHeight}px`;
        
    tab.onclick = () => {
          expanded = !expanded;
          if (expanded) {
        content.style.display = "inline-flex";
        const h = content.scrollHeight;
        outer.style.height = `${h + tabHeight}px`;
        tab.textContent = "▲";
          } else {
        content.style.display = "none";
        outer.style.height = `${tabHeight}px`;
        tab.textContent = "▼";
          }
        };
      
    outer.appendChild(tab);
    return outer;}


    private static readonly TOOL_CLASSES: {
      [K in keyof typeof ToolBox.ICONS]: new (...args: any[]) => Drawing
    } = {
      measure: Measure,
      trend:   TrendLine,
      horz:    HorizontalLine,
      ray:     RayLine,
      box:     Box,
      vert:    VerticalLine,
      pitch:   PitchFork,
    };
  
    // …
  private _registerIcon(
    container: HTMLElement,
    key: keyof typeof ToolBox.ICONS,
    rotate = false
  ) {
    const svgNS = "http://www.w3.org/2000/svg";
    const btn = document.createElement("div");
    btn.classList.add("toolbox-button");

    // 1) Create the SVG element with a fixed 28×28 viewport
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "28");
    svg.setAttribute("height", "28");
    svg.setAttribute("viewBox", "0 0 28 28");

    // 2) Create the <g> container and fill it with our icon paths
    const g = document.createElementNS(svgNS, "g");
    g.innerHTML = ToolBox.ICONS[key];
    svg.appendChild(g);

    // 3) Optionally rotate the entire SVG
    if (rotate) {
      svg.style.transform = "rotate(90deg)";
      svg.style.transformBox = "fill-box";
      svg.style.transformOrigin = "center";
    }

    // 4) Append to the button and into the container
    btn.appendChild(svg);
    container.appendChild(btn);

    // 5) Lookup the drawing class (guaranteed by our TOOL_CLASSES map)
    const drawingClass = ToolBox.TOOL_CLASSES[key];

    const icon: Icon = {
      div: btn,
      group: g,            // <-- this is the <g> element
      type: drawingClass,
    };

    btn.addEventListener("click", () => this._onIconClick(icon));
    this.buttons.push(btn);
  }

    private _onIconClick(icon: Icon) {
        if (this.activeIcon) {
      this.activeIcon.div.classList.remove("active-toolbox-button");
      this._drawingTool.stopDrawing();
            if (this.activeIcon === icon) {
        this.activeIcon = null;
        window.setCursor("default");
        return;
            }
        }
    this.activeIcon = icon;
    icon.div.classList.add("active-toolbox-button");
    window.setCursor("crosshair");
    this._drawingTool.beginDrawing(icon.type);
    }

  private removeActiveAndSave() {
    window.setCursor("default");
    if (this.activeIcon) {
      this.activeIcon.div.classList.remove("active-toolbox-button");
      this.activeIcon = null;
    }
    this.saveDrawings();
    }

    addNewDrawing(d: Drawing) {
        this._drawingTool.addNewDrawing(d);
    }

    clearDrawings() {
        this._drawingTool.clearDrawings();
    }

    saveDrawings = () => {
        const drawingMeta = []
        for (const d of this._drawingTool.drawings) {
            drawingMeta.push({
                type: d._type,
                points: d.points,
                options: d._options
            });
        }
        const string = JSON.stringify(drawingMeta);
        window.callbackFunction(`save_drawings${this._handlerID}_~_${string}`)
    }

    loadDrawings(drawings: any[]) { // TODO any
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
                // Add cases for pitchfork types if needed:
                case "PitchFork":
                    this._drawingTool.addNewDrawing(new PitchFork(d.points[0], d.points[1], d.points[2], d.options));
                    break;
        case "Measure":
          this._drawingTool.addNewDrawing(new Measure(d.points[0], d.points[1], d.options));
          break;
                }
                });
            }
        }
