/*
 * Copyright (C) 2025 EsIstJosh
 *
 * This file is part of [lightweight-charts-python] and is licensed under the GNU AGPL v3.0.
 * 
 * Note: This file imports modules that remain under the MIT license (e.g., from the original project).
 * The original MIT license text is included in the MIT_LICENSE file in the repository.
 *
 * For the full text of the GNU AGPL v3.0, see <https://www.gnu.org/licenses/agpl-3.0.html>.
 */


import * as monaco from "monaco-editor";
import {PineTS, Provider} from "pinets"
import { Handler } from "../general/handler";

/**
 * CodeEditor creates a bottom-docked pane-style Monaco Editor.
 * The pane spans the full width and can have its height adjusted via a drag handle.
 * 
 * New methods executePineTS and addPineTSToChart are added so that
 * the code from the editor is compiled, run via PineTS, and the resulting plots
 * are added to the chart using a provided Handler instance.
 */
export class CodeEditor {
  private container: HTMLDivElement;
  private header: HTMLDivElement;
  private editorDiv: HTMLDivElement;
  private resizer: HTMLDivElement;
  private editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
  private closeButton: HTMLButtonElement;
  private isResizing: boolean = false;
  private startY: number = 0;
  private startHeight: number = 0;
  private readonly MIN_HEIGHT: number = 100; // Minimum pane height in pixels
  private readonly MAX_HEIGHT: number = window.innerHeight - 50; // Maximum pane height

  // Store the Handler instance passed in the constructor.
  private handler: Handler;

  /**
   * @param handler - The chart handler that manages the Lightweight Charts instance.
   */
  constructor(handler: Handler) {
    this.handler = handler;

    // Create the container pane with bottom docking.
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      width: "100%",
      height: "300px", // default height
      backgroundColor: "#1e1e1e",
      borderTop: "2px solid #444",
      zIndex: "10000",
      display: "none",
      flexDirection: "column",
    });

    // Create the resizer handle.
    this.resizer = document.createElement("div");
    Object.assign(this.resizer.style, {
      height: "5px",
      width: "100%",
      backgroundColor: "#666",
      cursor: "ns-resize",
      userSelect: "none",
    });
    // Attach mouse events for resizing.
    this.resizer.addEventListener("mousedown", this.onDragStart.bind(this));
    document.addEventListener("mousemove", this.onDrag.bind(this));
    document.addEventListener("mouseup", this.onDragEnd.bind(this));
    this.container.appendChild(this.resizer);

    // Create the header.
    this.header = document.createElement("div");
    Object.assign(this.header.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px",
      backgroundColor: "#333",
    });

    // Left container holds title and action buttons.
    const leftContainer = document.createElement("div");
    leftContainer.style.display = "flex";
    leftContainer.style.alignItems = "center";
    leftContainer.style.gap = "10px";

    const title = document.createElement("span");
    title.innerText = "Code Editor";
    title.style.color = "white";
    leftContainer.appendChild(title);

    // Actions container holds the new buttons.
    const actionsContainer = document.createElement("div");
    actionsContainer.style.display = "flex";
    actionsContainer.style.gap = "10px";

    // Execute button.
    const executeButton = document.createElement("button");
    executeButton.innerText = "Execute";
    Object.assign(executeButton.style, {
      backgroundColor: "#4caf50",
      color: "white",
      border: "none",
      padding: "5px 10px",
      cursor: "pointer",
    });
    executeButton.onclick = () => {
      // Call the integrated execute method.
      this.executePineTS();
    };
    actionsContainer.appendChild(executeButton);

    // Add to Chart button.
    const addToChartButton = document.createElement("button");
    addToChartButton.innerText = "Add to Chart";
    Object.assign(addToChartButton.style, {
      backgroundColor: "#2196f3",
      color: "white",
      border: "none",
      padding: "5px 10px",
      cursor: "pointer",
    });
    addToChartButton.onclick = () => {
      // Call the integrated add-to-chart method.
      this.addPineTSToChart();
    };
    actionsContainer.appendChild(addToChartButton);

    // Append left container (title + actions) and then the close button.
    leftContainer.appendChild(actionsContainer);

    // Create the close button.
    this.closeButton = document.createElement("button");
    this.closeButton.innerText = "Close";
    Object.assign(this.closeButton.style, {
      backgroundColor: "#ff5555",
      color: "white",
      border: "none",
      padding: "5px 10px",
      cursor: "pointer",
    });
    this.closeButton.onclick = () => this.close();

    // Append left container and close button to header.
    this.header.appendChild(leftContainer);
    this.header.appendChild(this.closeButton);

    this.container.appendChild(this.header);

    // Create the editor container.
    this.editorDiv = document.createElement("div");
    Object.assign(this.editorDiv.style, {
      flex: "1",
      height: "calc(100% - 45px)", // Subtract resizer (5px) and header (40px approx)
    });

    this.container.appendChild(this.editorDiv);

    // Append the container pane to the document body.
    document.body.appendChild(this.container);

    // Initialize Monaco Editor in the editor container.
    this.initializeMonaco();
  }

  /**
   * Initializes the Monaco Editor in the editor pane.
   */
  private initializeMonaco(): void {
    this.editorInstance = monaco.editor.create(this.editorDiv, {
      value: "Feature not implemented yet",
      language: "typescript",
      theme: "vs-dark",
      automaticLayout: true,
    } as monaco.editor.IStandaloneEditorConstructionOptions);
    console.log("Monaco Editor initialized in pane.");
  }

  /**
   * Opens (displays) the pane.
   */
  public open(): void {
    this.container.style.display = "flex";
    // Refresh the layout after showing.
    this.editorInstance?.layout();
  }

  /**
   * Closes (hides) the pane.
   */
  public close(): void {
    this.container.style.display = "none";
  }

  /**
   * Sets the code value in the editor.
   * @param code - The code to set in the editor.
   */
  public setValue(code: string): void {
    this.editorInstance?.setValue(code);
  }

  /**
   * Gets the current code from the editor.
   * @returns The code in the editor.
   */
  public getValue(): string {
    return this.editorInstance?.getValue() || "";
  }

  /**
   * Executes the PineTS code from the editor.
   * It compiles the code into a function that accepts 'context', runs it via PineTS,
   * and then adds the resulting plots to the chart using the global Handler instance.
   */
  public async executePineTS(): Promise<void> {
    try {
      const code = this.getValue();
      const userCallback = new Function('context', code) as (context: any) => any;
      
      // Create a new PineTS instance (adjust parameters as needed).
      const pineTS = new PineTS(Provider.yFinance, 'BTCUSDT', 'D', 100);
      
      // Run the indicator code.
      const { result, plots } = await pineTS.run(userCallback);
      console.log("PineTS execution result:", result);
      
      // Use the Handler passed via constructor.
      for (const plotName in plots) {
        if (plots.hasOwnProperty(plotName)) {
          addPlotToHandler(this.handler, plotName, plots[plotName]);
        }
      }
    } catch (error) {
      console.error("Error executing PineTS code:", error);
    }
  }

  /**
   * Adds or updates the chart series using the PineTS code from the editor.
   * The logic is similar to executePineTS; you can modify it to update existing series if desired.
   */
  public async addPineTSToChart(): Promise<void> {
    try {
      const code = this.getValue();
      const userCallback = new Function('context', code) as (context: any) => any;
      const pineTS = new PineTS(Provider.yFinance, 'BTCUSDT', 'D', 100);
      const { result, plots } = await pineTS.run(userCallback);
      console.log("PineTS run (Add to Chart) result:", result);
      
      for (const plotName in plots) {
        if (plots.hasOwnProperty(plotName)) {
          // For simplicity, we're adding a new series.
          // You can add logic to check for an existing series and update it.
          addPlotToHandler(this.handler, plotName, plots[plotName]);
        }
      }
    } catch (error) {
      console.error("Error executing PineTS code (Add to Chart):", error);
    }
  }

  /**
   * Handler for the start of a drag event on the resizer.
   * @param event - The mouse down event.
   */
  private onDragStart(event: MouseEvent): void {
    this.isResizing = true;
    this.startY = event.clientY;
    this.startHeight = parseInt(window.getComputedStyle(this.container).height, 10);
    event.preventDefault();
  }

  /**
   * Handler for the dragging event to resize the pane.
   * @param event - The mouse move event.
   */
  private onDrag(event: MouseEvent): void {
    if (!this.isResizing) return;
    // Calculate the new height as the distance from the bottom.
    const newHeight = this.startHeight + (this.startY - event.clientY);
    // Clamp the new height between MIN_HEIGHT and MAX_HEIGHT.
    const clampedHeight = Math.min(Math.max(newHeight, this.MIN_HEIGHT), this.MAX_HEIGHT);
    this.container.style.height = `${clampedHeight}px`;
    // Notify Monaco that the container size has changed.
    this.editorInstance?.layout();
  }

  /**
   * Handler for the end of a drag event.
   * @param event - The mouse up event.
   */
  private onDragEnd(event: MouseEvent): void {
    if (this.isResizing) {
      this.isResizing = false;
    }
  }
}
/**
 * Convert a single PineTS plot object into a Lightweight Charts series using Handler.
 * @param handler   Your existing Handler instance (manages the chart).
 * @param plotName  The name of the plot (e.g. "Momentum", "Cross", etc.).
 * @param plotObj   The object returned by PineTS for this plot.
 */
export function addPlotToHandler(handler: Handler, plotName: string, plotObj: any) {
    const { data, options } = plotObj;
    const style = options?.style || 'line'; // default to 'line' if not specified
  
    // 1) Prepare a config object for Handler's createXSeries methods
    //    (color, linewidth, lineStyle, etc.)
    const baseOptions: any = {
      color: options?.color,
      lineWidth: options?.linewidth,
      // You can add more fields if needed, e.g. lineStyle, upColor, downColor, etc.
    };
  
    // 2) Create the appropriate series based on style
    let createdSeries;
    switch (style) {
      case 'line':
        createdSeries = handler.createLineSeries(plotName, baseOptions);
        break;
      case 'histogram':
        createdSeries = handler.createHistogramSeries(plotName, baseOptions);
        break;
      case 'area':
        createdSeries = handler.createAreaSeries(plotName, baseOptions);
        break;
      case 'bar':
        createdSeries = handler.createBarSeries(plotName, baseOptions);
        break;
      case 'cross':
        // "cross" isn't a native style in Lightweight Charts.
        // Often, we approximate with a line series having a thick or special style:
        baseOptions.lineWidth = baseOptions.lineWidth ?? 6; // e.g. big line
        createdSeries = handler.createLineSeries(plotName, baseOptions);
        break;
      default:
        console.warn(`Unsupported plot style: ${style}. Using line instead.`);
        createdSeries = handler.createLineSeries(plotName, baseOptions);
        break;
    }
  
    // 3) Convert PineTS data into a format Lightweight Charts expects: { time, value, color? }
    //    PineTS often uses milliseconds. Lightweight Charts expects 'time' in seconds or a Date-like object.
    const seriesData = data.map((pt: any) => ({
      time: Math.floor(pt.time / 1000), // convert ms -> seconds
      value: pt.value,
      // If you want per-point color, pass 'color' here. The series must support it (e.g. histogram).
      color: pt.color ?? options?.color,
    }));
  
    // 4) Set data on the newly created series
    createdSeries.series.setData(seriesData);
  }
  