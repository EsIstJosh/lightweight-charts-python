import { DrawingTool } from "../drawing/drawing-tool";
import { TrendLine } from "../trend-line/trend-line";
import { Box } from "../box/box";
import { defaultOptions } from "../drawing/options";
import { Drawing} from "../drawing/drawing";
import { Point } from "../drawing/data-source";
import { GlobalParams } from "./global-params";
import { IChartApi, ISeriesApi, Logical, SeriesType, Time } from "lightweight-charts";
import { HorizontalLine } from "../horizontal-line/horizontal-line";
import { RayLine } from "../horizontal-line/ray-line";
import { VerticalLine } from "../vertical-line/vertical-line";
import { PitchFork } from "../pitchfork/pitchfork";
import { Measure } from "../measure/measure";
import { Handler } from "./handler";
import { ensureExtendedSeries, ISeriesApiExtended } from "../helpers/series";
import { DataPoint, defaultSequenceOptions, SequenceOptions } from "../trend-trace/sequence";
import { TrendTrace } from "../trend-trace/trend-trace";

interface Icon {
    key: keyof typeof ToolBox.ICONS;   // ← add this

    div: HTMLDivElement,
    group: SVGGElement,
    type: new (...args: any[]) => Drawing
}

declare const window: GlobalParams;

export type ToolBoxMode = "static" | "toggle";
export class ToolBox {
  public static readonly ICONS: Record<string, string> = {
    import: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><g stroke="#FFFFFF" stroke-width="1" fill="none"><line x1="7" y1="22" x2="7" y2="14"/><rect x="5" y="16" width="4" height="6"/><line x1="14" y1="22" x2="14" y2="10"/><rect x="12" y="12" width="4" height="8"/><line x1="21" y1="22" x2="21" y2="6"/><rect x="19" y="8" width="4" height="12"/></g></svg>',
    trend: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="3.84" y="13.67" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -5.9847 14.4482)" width="21.21" height="1.56"/><path stroke="#FFFFFF" fill="none" d="M23,3.17L20.17,6L23,8.83L25.83,6L23,3.17z M23,7.41L21.59,6L23,4.59L24.41,6L23,7.41z"/><path stroke="#FFFFFF" fill="none" d="M6,20.17L3.17,23L6,25.83L8.83,23L6,20.17z M6,24.41L4.59,23L6,21.59L7.41,23L6,24.41z"/>',
    horz: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="4" y="14" width="9" height="1"/><rect stroke="#FFFFFF" fill="none" x="16" y="14" width="9" height="1"/><path stroke="#FFFFFF" fill="none" d="M11.67,14.5l2.83,2.83l2.83-2.83l-2.83-2.83L11.67,14.5z M15.91,14.5l-1.41,1.41l-1.41-1.41l1.41-1.41L15.91,14.5z"/>',
    ray: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="8" y="14" width="17" height="1"/><path stroke="#FFFFFF" fill="none" d="M3.67,14.5l2.83,2.83l2.83-2.83L6.5,11.67L3.67,14.5z M7.91,14.5L6.5,15.91L5.09,14.5l1.41-1.41L7.91,14.5z"/>',
    box: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="8" y="6" width="12" height="1"/><rect stroke="#FFFFFF" fill="none" x="9" y="22" width="11" height="1"/><path stroke="#FFFFFF" fill="none" d="M3.67,6.5L6.5,9.33L9.33,6.5L6.5,3.67L3.67,6.5z M7.91,6.5L6.5,7.91L5.09,6.5L6.5,5.09L7.91,6.5z"/><path stroke="#FFFFFF" fill="none" d="M19.67,6.5l2.83,2.83l2.83-2.83L22.5,3.67L19.67,6.5z M23.91,6.5L22.5,7.91L21.09,6.5l1.41-1.41L23.91,6.5z"/><path stroke="#FFFFFF" fill="none" d="M19.67,22.5l2.83,2.83l2.83-2.83l-2.83-2.83L19.67,22.5z M23.91,22.5l-1.41,1.41l-1.41-1.41l1.41-1.41L23.91,22.5z"/><path stroke="#FFFFFF" fill="none" d="M3.67,22.5l2.83,2.83l2.83-2.83L6.5,19.67L3.67,22.5z M7.91,22.5L6.5,23.91L5.09,22.5l1.41-1.41L7.91,22.5z"/><rect stroke="#FFFFFF" fill="none" x="22" y="9" width="1" height="11"/><rect stroke="#FFFFFF" fill="none" x="6" y="9" width="1" height="11"/>',
    vert: '<rect stroke="#FFFFFF" stroke-width="0.5" fill="none" x="8" y="14" width="17" height="1"/><path stroke="#FFFFFF" fill="none" d="M3.67,14.5l2.83,2.83l2.83-2.83L6.5,11.67L3.67,14.5z M7.91,14.5L6.5,15.91L5.09,14.5l1.41-1.41L7.91,14.5z"/>',
    pitch: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g stroke="#FFFFFF" stroke-width="0.5" fill="none" fill-rule="nonzero"><path d="M7.275 21.432l12.579-12.579-.707-.707-12.579 12.579z"/><path d="M6.69 13.397l7.913 7.913.707-.707-7.913-7.913z"/><path d="M7.149 10.558l7.058-7.058-.707-.707-7.058 7.058z" id="Line"/><path d="M20.149 21.558l7.058-7.058-.707-.707-7.058 7.558z"/><path d="M5.5 23h11v-1h-11z"/><path d="M4.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"/></g></svg>',
    measure: '<rect stroke="#FFFFFF" fill="none" x="4" y="10" width="20" height="8" rx="1"/><path stroke="#FFFFFF" stroke-width="0.5" fill="none" d="M7 10v4 M11 10v4 M15 10v4 M19 10v4 M23 10v4"/>'
};





  // … your existing fields …

  private fileInput!: HTMLInputElement;


  public readonly div: HTMLDivElement;
    private activeIcon: Icon | null = null;

    private buttons: HTMLDivElement[] = [];
    private _series: ISeriesApiExtended
    private _commandFunctions: Function[];
    private _handlerID: string;
    private _drawingTool: DrawingTool;
    constructor(
      private handler: Handler,
      chart: IChartApi,
      series: ISeriesApi<SeriesType>,
      commandFunctions: Function[],
      toggle: boolean = true    // ← now a boolean
    ) {
        this._handlerID = this.handler.id;
        this._series    = series as ISeriesApiExtended;

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

    // pick the mode based on the boolean
    const mode: ToolBoxMode = toggle ? "toggle" : "static";
    this.div = this._createToolBox(handler, mode);
    // hidden file‐picker for import
    this.fileInput = document.createElement("input");
    this.fileInput.type    = "file";
    this.fileInput.accept  = ".json";
    this.fileInput.style.display = "none";
    this.fileInput.addEventListener("change", this._handleFileInput);
    this.div.appendChild(this.fileInput);


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
    this._registerIcon(container, "import");

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
    this._registerIcon(content, "import");

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
      import: Box,
      measure: Measure,
      trend:   TrendLine,
      horz:    HorizontalLine,
      ray:     RayLine,
      box:     Box,
      vert:    VerticalLine,
      pitch:   PitchFork,
    };
  
    // …
   // 2) In _registerIcon, build the Icon with its key, **but never special-case** 'import' here:
private _registerIcon(
  container: HTMLElement,
  key: keyof typeof ToolBox.ICONS,
  rotate = false
) {
  const svgNS = "http://www.w3.org/2000/svg";
  const btn = document.createElement("div");
  btn.classList.add("toolbox-button");
  btn.dataset.tool = key;   // optional, if you need to find it later

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "28");
  svg.setAttribute("height", "28");
  svg.setAttribute("viewBox", "0 0 28 28");
  const g = document.createElementNS(svgNS, "g");
  g.innerHTML = ToolBox.ICONS[key];
  svg.appendChild(g);
  if (rotate) {
    svg.style.transform = "rotate(90deg)";
    svg.style.transformBox = "fill-box";
    svg.style.transformOrigin = "center";
  }

  btn.appendChild(svg);
  container.appendChild(btn);

    // always route clicks through _onIconClick
  const icon: Icon = { key, div: btn, group: g, type: ToolBox.TOOL_CLASSES[key]! };
  btn.addEventListener("click", () => this._onIconClick(icon));
  this.buttons.push(btn);

    container.appendChild(btn);
}
private _onIconClick(icon: Icon) {
  if (icon.key === "import") {
    // this opens the OS file dialog.  _handleFileInput will run on 'change'
    this.fileInput.click();
    return;
  }
  // …rest of your drawing logic…


  // otherwise—your existing drawing logic:
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

  /** Fired when user selects a .json file */
  private _handleFileInput = (ev: Event) => {
    const inp = ev.target as HTMLInputElement;
    const file = inp.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let raw: any;
      try {
        raw = JSON.parse(reader.result as string);
      } catch {
        window.alert("❌ Could not parse that file as JSON.");
        return;
      }
      // adapt for “type”/“object” wrapper:
      const payload = raw.object ?? raw;
      if (
        typeof payload.p1 !== "object" ||
        typeof payload.p2 !== "object" ||
        !Array.isArray(payload.data) ||
        typeof payload.options !== "object"
      ) {
        window.alert("❌ JSON isn’t a valid TrendTrace export.");
        return;
      }
      this._doImport(payload, file.name);
    };
    reader.readAsText(file);
    inp.value = "";
  };

  private _doImport(
    raw: {
      p1: { logical: number; price?: number | null; time?: Time | null };
      p2: { logical: number; price?: number | null; time?: Time | null };
      data: DataPoint[];
      options: SequenceOptions;
    },
    _name: string
  ) {
    // 1) Build properly typed LogicalPoints (never undefined)
    const p1: Point = {
      logical: raw.p1.logical as Logical,
      price:   raw.p1.price   ?? 0,
      time:    raw.p1.time    ?? null,
    };
    const p2: Point = {
      logical: raw.p2.logical as Logical,
      price:   raw.p2.price   ?? 0,
      time:    raw.p2.time    ?? null,
    };
  
    // 2) Compute min(low) & max(high) from the data
    const lows  = raw.data.filter(d => d.low != null).map(d => d.low!);
    const highs = raw.data.filter(d => d.high!= null).map(d => d.high!);
    if (lows.length) {
      p2.price = Math.min(...lows);
    }
    if (highs.length) {
      p1.price = Math.max(...highs);
    }
  
    // 3) Draw the box with those updated points
    const box = new Box(p1, p2, raw.options);
    this._drawingTool.addNewDrawing(box);
  
    // 4) Attach the TrendTrace exactly as before
    const ext = ensureExtendedSeries(
      this._series,
      (this.handler as any).legend
    ) as ISeriesApiExtended;
  
    const tt = new TrendTrace(
      this.handler,
      ext,
      p1,
      p2,
      raw.options
    );
    // hydrate it
    tt.fromJSON({
      data:    raw.data,
      p1,
      p2,
      options: raw.options,
    });
  
    ext.primitives["TrendTrace"] = tt;
    ext.attachPrimitive(
      tt,
      `${p1.logical} ⥵ ${p2.logical}`,
      false,
      true
    );
  
    ;(box as any).linkedObjects.push(tt);
  
    // 5) persist
    this.saveDrawings();
  }

  /** Remove active icon styling and persist drawings */
  private removeActiveAndSave() {
    window.setCursor("default");
    if (this.activeIcon) {
      this.activeIcon.div.classList.remove("active-toolbox-button");
      this.activeIcon = null;
    }
    this.saveDrawings();
    }

  /** Expose adding a drawing programmatically */
  public addNewDrawing(d: Drawing) {
        this._drawingTool.addNewDrawing(d);
    }

  /** Clear all drawings */
  public clearDrawings() {
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