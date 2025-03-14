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
import { PineTS } from "pinets";
import { Handler } from "../general/handler";
import { ISeriesApi,  SeriesType  } from "lightweight-charts";

import { GlobalParams } from "../general";
import {  addPlotToHandler} from "../helpers/series";

declare const window: GlobalParams;

/**
 * CodeEditor creates a bottom-docked pane-style Monaco Editor.
 * The pane spans the full width and can have its height adjusted via a drag handle.
 * 
 * New methods executePineTS and addPineTSToChart are added so that
 * the code from the editor is compiled, run via PineTS, and the resulting plots
 * are added to the chart using a provided Handler instance.
 */
// A shared base style for buttons to ensure same height & shape:
const baseButtonStyle = {
  color: "white",
  border: "none",
  padding: "5px 10px",         // same padding as 'Close' button
  cursor: "pointer",
  borderRadius: "12px",         // same round corners as 'Close' button
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
  transition: "transform 0.2s ease-in-out",
};


  /**
   * @param handler - The chart handler that manages the Lightweight Charts instance.
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
   // Store details about the executed scripts.
    private scripts: { 
      [key: string]: { 
        series:string; 
        volumeSeries:string | null 
        code: string; 
      } 
    } = {};
    // Store the Handler instance passed in the constructor.
    private handler: Handler;
    // Attributes to store the selected series and volume series.
    private selectedSeries: ISeriesApi<SeriesType> | null = null;
    private selectedVolumeSeries: ISeriesApi<SeriesType> | null = null;
    // Execution mode: "update" or "add"; default is update.
  
    constructor(handler: Handler) {
      this.handler = handler;
      this.selectedSeries = this.handler.series;
      this.selectedVolumeSeries = (this.handler.volumeSeries as ISeriesApi<SeriesType>) ?? null;
    
      // Create container pane.
      this.container = document.createElement("div");
      Object.assign(this.container.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        width: "100%",
        height: "300px",
        backgroundColor: "#000000",
        borderTop: "2px solid #222",
        zIndex: "10000",
        display: "none",
        flexDirection: "column",
      });
    
      // Create resizer.
      this.resizer = document.createElement("div");
      Object.assign(this.resizer.style, {
        height: "5px",
        width: "100%",
        backgroundColor: "#111",
        cursor: "ns-resize",
        userSelect: "none",
      });
      this.resizer.addEventListener("mousedown", this.onDragStart.bind(this));
      document.addEventListener("mousemove", this.onDrag.bind(this));
      document.addEventListener("mouseup", this.onDragEnd.bind(this));
      this.container.appendChild(this.resizer);
    
      // Create header.
      this.header = document.createElement("div");
      Object.assign(this.header.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px",
        backgroundColor: "#000",
      });
    
      // Left container holds title and action buttons.
      const leftContainer = document.createElement("div");
      leftContainer.style.display = "flex";
      leftContainer.style.alignItems = "center";
      leftContainer.style.gap = "10px";
    
      const title = document.createElement("span");
      title.innerText = "PineTS Script Editor ";
      title.style.color = "white";
      leftContainer.appendChild(title);
    
      // Actions container.
      const actionsContainer = document.createElement("div");
      actionsContainer.style.display = "flex";
      actionsContainer.style.gap = "10px";
    
      // Execute button.
      const executeButton = document.createElement("button");
      executeButton.innerText = "Execute";
      Object.assign(executeButton.style, baseButtonStyle, {
        backgroundColor: "#2A8D08",
      });
      executeButton.onmouseover = () => {
        executeButton.style.transform = "scale(1.05)";
      };
      executeButton.onmouseout = () => {
        executeButton.style.transform = "scale(1)";
      };
      executeButton.onclick = () => {
        this.executePineTS();
      };
      actionsContainer.appendChild(executeButton);
    
      // --- Merged Save / Save As Split Button ---
      const saveSplitContainer = document.createElement("div");
      Object.assign(saveSplitContainer.style, {
        display: "inline-flex",
        // We can keep a border if you like, or remove it to match the button's shape
        border: "1px solid #0A42FA",
        borderRadius: "8px",
        overflow: "hidden",
        position: "relative",
      });
    
      const saveMainButton = document.createElement("button");
      saveMainButton.innerText = "Save";
      Object.assign(saveMainButton.style, baseButtonStyle, {
        backgroundColor: "#0A42FA",
        borderRadius: "0px", // Because it's inside a container that already has borderRadius
      });
      saveMainButton.onmouseover = () => {
        saveMainButton.style.transform = "scale(1.05)";
      };
      saveMainButton.onmouseout = () => {
        saveMainButton.style.transform = "scale(1)";
      };
      saveMainButton.onclick = () => {
        this.saveScript();
      };
      saveSplitContainer.appendChild(saveMainButton);
    
      const saveDropdownButton = document.createElement("button");
      saveDropdownButton.innerText = "🛠";
      Object.assign(saveDropdownButton.style, baseButtonStyle, {
        backgroundColor: "#0A42FA",
        borderLeft: "1px solid #fff",
        borderRadius: "0px",
        padding: "5px", // narrower width for icon
      });
      saveDropdownButton.onmouseover = () => {
        saveDropdownButton.style.transform = "scale(1.05)";
      };
      saveDropdownButton.onmouseout = () => {
        saveDropdownButton.style.transform = "scale(1)";
      };
      saveDropdownButton.onclick = (event: MouseEvent) => {
        const existing = document.getElementById("save-dropdown");
        if (existing) {
          existing.remove();
          return;
        }
        const dropdown = document.createElement("div");
        dropdown.id = "save-dropdown";
        Object.assign(dropdown.style, {
          position: "absolute",
          backgroundColor: "#0A42FA",
          color: "white",
          border: "1px solid #fff",
          borderRadius: "4px",
          marginTop: "5px",
          zIndex: "100000",
        });
        const optionSaveAs = document.createElement("div");
        optionSaveAs.innerText = "Save As";
        optionSaveAs.style.padding = "5px 10px";
        optionSaveAs.style.cursor = "pointer";
        optionSaveAs.onclick = () => {
          this.saveToFile();
          dropdown.remove();
        };
        dropdown.appendChild(optionSaveAs);
        const rect = saveSplitContainer.getBoundingClientRect();
        dropdown.style.left = rect.left + "px";
        dropdown.style.top = rect.bottom + "px";
        document.body.appendChild(dropdown);
      };
      saveSplitContainer.appendChild(saveDropdownButton);
      actionsContainer.appendChild(saveSplitContainer);
      // --- End merged Save button ---
    
      // --- Merged Script Selection Split Button ---
      const scriptSplitContainer = document.createElement("div");
      Object.assign(scriptSplitContainer.style, {
        display: "inline-flex",
        border: "1px solid #AC0202",
        borderRadius: "8px",
        overflow: "hidden",
        position: "relative",
      });
    
      // Main Script button: shows current script key or "Script"
      const scriptMainButton = document.createElement("button");
      scriptMainButton.innerText = "Script";
      Object.assign(scriptMainButton.style, baseButtonStyle, {
        backgroundColor: "#AC0202",
        borderRadius: "0px",
      });
      scriptMainButton.onmouseover = () => {
        scriptMainButton.style.transform = "scale(1.05)";
      };
      scriptMainButton.onmouseout = () => {
        scriptMainButton.style.transform = "scale(1)";
      };
      scriptMainButton.onclick = () => {
        console.log("Current script: " + scriptMainButton.innerText);
      };
      scriptSplitContainer.appendChild(scriptMainButton);
    
      // Dropdown arrow button for script selection.
      const scriptDropdownButton = document.createElement("button");
      scriptDropdownButton.innerText = "🗄";
      Object.assign(scriptDropdownButton.style, baseButtonStyle, {
        backgroundColor: "#AC0202",
        borderLeft: "1px solid #fff",
        borderRadius: "0px",
        padding: "5px",
      });
      scriptDropdownButton.onmouseover = () => {
        scriptDropdownButton.style.transform = "scale(1.05)";
      };
      scriptDropdownButton.onmouseout = () => {
        scriptDropdownButton.style.transform = "scale(1)";
      };
      scriptDropdownButton.onclick = (event: MouseEvent) => {
        const existing = document.getElementById("script-dropdown");
        if (existing) {
          existing.remove();
          return;
        }
        const dropdown = document.createElement("div");
        dropdown.id = "script-dropdown";
        Object.assign(dropdown.style, {
          position: "absolute",
          backgroundColor: "#AC0202",
          color: "white",
          border: "1px solid #fff",
          borderRadius: "4px",
          marginTop: "5px",
          zIndex: "100000",
        });
        // Populate dropdown with currently loaded scripts.
        const scriptKeys = Object.keys(this.scripts);
        scriptKeys.forEach((key) => {
          const option = document.createElement("div");
          option.innerText = key;
          option.style.padding = "5px 10px";
          option.style.cursor = "pointer";
          option.onclick = () => {
            if (this.scripts[key] && this.scripts[key].code) {
              this.setValue(this.scripts[key].code);
              scriptMainButton.innerText = key;
              console.log(`Loaded script "${key}" from memory.`);
            }
            dropdown.remove();
          };
          dropdown.appendChild(option);
        });
        // Option to open from file.
        const openOption = document.createElement("div");
        openOption.innerText = "Open...";
        openOption.style.padding = "5px 10px";
        openOption.style.cursor = "pointer";
        openOption.onclick = () => {
          this.openScriptFromFile();
          dropdown.remove();
        };
        dropdown.appendChild(openOption);
    
        const rect = scriptSplitContainer.getBoundingClientRect();
        dropdown.style.left = rect.left + "px";
        dropdown.style.top = rect.bottom + "px";
        document.body.appendChild(dropdown);
      };
      scriptSplitContainer.appendChild(scriptDropdownButton);
      actionsContainer.appendChild(scriptSplitContainer);
      // --- End merged Script button ---
    
      // --- Merged Series Selection Split Button ---
      const seriesSplitContainer = document.createElement("div");
      Object.assign(seriesSplitContainer.style, {
        display: "inline-flex",
        border: "1px solid #696969",
        borderRadius: "8px",
        overflow: "hidden",
        position: "relative",
      });
      const selectMainSeriesButton = document.createElement("button");
      selectMainSeriesButton.innerText = "Select Main Series";
      Object.assign(selectMainSeriesButton.style, baseButtonStyle, {
        backgroundColor: "#696969",
        borderRadius: "0px",
      });
      selectMainSeriesButton.onmouseover = () => {
        selectMainSeriesButton.style.transform = "scale(1.05)";
      };
      selectMainSeriesButton.onmouseout = () => {
        selectMainSeriesButton.style.transform = "scale(1)";
      };
      selectMainSeriesButton.onclick = (event: MouseEvent) => {
        this.populateMainSeriesSelectMenu(event, (series) => {
          this.selectedSeries = series;
          console.log("Selected Main Series:", series);
        });
      };
      seriesSplitContainer.appendChild(selectMainSeriesButton);
    
      const seriesDropdownButton = document.createElement("button");
      seriesDropdownButton.innerText = "∿";
      Object.assign(seriesDropdownButton.style, baseButtonStyle, {
        backgroundColor: "#696969",
        borderLeft: "1px solid #fff",
        borderRadius: "0px",
        padding: "5px",
      });
      seriesDropdownButton.onmouseover = () => {
        seriesDropdownButton.style.transform = "scale(1.05)";
      };
      seriesDropdownButton.onmouseout = () => {
        seriesDropdownButton.style.transform = "scale(1)";
      };
      seriesDropdownButton.onclick = (event: MouseEvent) => {
        const existing = document.getElementById("series-dropdown");
        if (existing) {
          existing.remove();
          return;
        }
        const dropdown = document.createElement("div");
        dropdown.id = "series-dropdown";
        Object.assign(dropdown.style, {
          position: "absolute",
          backgroundColor: "#696969",
          color: "white",
          border: "1px solid #fff",
          borderRadius: "4px",
          marginTop: "5px",
          zIndex: "100000",
        });
        const optionMain = document.createElement("div");
        optionMain.innerText = "Select Main Series";
        optionMain.style.padding = "5px 10px";
        optionMain.style.cursor = "pointer";
        optionMain.onclick = (evt: MouseEvent) => {
          this.populateMainSeriesSelectMenu(evt, (series) => {
            this.selectedSeries = series;
            console.log("Selected Main Series:", series);
          });
          dropdown.remove();
        };
        dropdown.appendChild(optionMain);
    
        const optionVolume = document.createElement("div");
        optionVolume.innerText = "Select Volume Series";
        optionVolume.style.padding = "5px 10px";
        optionVolume.style.cursor = "pointer";
        optionVolume.onclick = (evt: MouseEvent) => {
          this.populateVolumeSeriesSelectMenu(evt, (volumeSeries) => {
            this.selectedVolumeSeries = volumeSeries;
            console.log("Selected Volume Series:", volumeSeries);
          });
          dropdown.remove();
        };
        dropdown.appendChild(optionVolume);
    
        const rect = seriesSplitContainer.getBoundingClientRect();
        dropdown.style.left = rect.left + "px";
        dropdown.style.top = rect.bottom + "px";
        document.body.appendChild(dropdown);
      };
      seriesSplitContainer.appendChild(seriesDropdownButton);
      actionsContainer.appendChild(seriesSplitContainer);
      // --- End merged Series button ---
    
      leftContainer.appendChild(actionsContainer);
    
      // Close button.
      this.closeButton = document.createElement("button");
      this.closeButton.innerText = "Close";
      Object.assign(this.closeButton.style, baseButtonStyle, {
        backgroundColor: "#ff0000",
      });
      this.closeButton.onmouseover = () => {
        this.closeButton.style.transform = "scale(1.05)";
      };
      this.closeButton.onmouseout = () => {
        this.closeButton.style.transform = "scale(1)";
      };
      this.closeButton.onclick = () => this.close();
    
      this.header.appendChild(leftContainer);
      this.header.appendChild(this.closeButton);
      this.container.appendChild(this.header);
    
      // Editor container.
      this.editorDiv = document.createElement("div");
      Object.assign(this.editorDiv.style, {
        flex: "1",
        height: "calc(100% - 45px)",
      });
      this.container.appendChild(this.editorDiv);
    
      document.body.appendChild(this.container);
    
      // Initialize Monaco Editor.
      this.initializeMonaco();
    
      // Load the most recent saved script from the handler's scriptManager.
      this.loadInitialScript();
    }
  private initializeMonaco(): void {
    let initialCode = "";
    // Attempt to retrieve the most recent saved script from the handler's scriptManager.
    if (this.handler.scriptsManager && typeof this.handler.scriptsManager.getLast === "function") {
      const recentScript = this.handler.scriptsManager.getLast();
      if (recentScript && recentScript.code) {
        initialCode = recentScript.code;
      }
    }
    
    // Fallback default code if no saved script is available.
    if (!initialCode) {
      initialCode = `


// * @EsIstJosh
// * This feature implements a variation of PineTS, source : <https://github.com/alaa-eddine/PineTS> and is 
// * licensed under the GNU AGPL v3.0. V
// * The original AGPL license text is included in the AGPL_LICENSE file in the repository.
// * 
// * Note: This file imports modules that remain under the MIT license 
// * The original MIT license text is included in the MIT_LICENSE file in the repository.
// *
// * For the full text of the GNU AGPL v3.0, see <https://www.gnu.org/licenses/agpl-3.0.html>.


// * //-----------------Work in Progress...-------------------//
// * EXAMPLE SCRIPT CONVERSION // 
// * PINE SCRIPT                                                                    ⥵    //PINE TS                      
// * 
// * //@version=5                                                                   ⥵    // @version=5
// * indicator('Simple EMA','EMA', overlay=true)                                    ⥵    indicator('Simple EMA','EMA', {overlay=true})              
// *                                                                                ⥵            
// * ema9 = ta.ema(close, 9);                                                       ⥵    const ema9 = ta.ema(close, 9)                      
// * ema18 = ta.ema(close, 18);                                                     ⥵    const ema18 = ta.ema(close, 18)
// * plot(ema9,'EMA9', color= #ff0000, linewidth= 2, style = plot.style_line)       ⥵    plot(ema9,'EMA9',{ style: 'line', color: '#ff0000', linewidth: 2 })
// * plot(ema18,'EMA18', color= #ff7700, linewidth= 2, style = plot.style_line)     ⥵    plot(ema18,'EMA18',{ style: 'line', color: '#ff7700', linewidth: 2 })



  indicator('Title', 'TA', { overlay : true })
  // 
  const ema1 = ta.ema(close,16)
  const ema2 = ta.ema(close,32)
  const ema3 = ta.ema(close,48)
  const ema4 = ta.ema(close,64)
  const ema5 = ta.ema(close,96)
  const ema6 = ta.ema(close,128)
  plot(ema1,'EMA1',{ style: 'line', color: '#ff0000', linewidth: 2 })
  plot(ema2,'EMA2',{ style: 'cross', color: '#ff7700', linewidth: 2 })
  plot(ema3,'EMA3',{ style: 'circles', color: '#ffee00', linewidth: 2 })
  plot(ema4,'EMA4',{ style: '<>', color: '#00ff00', linewidth: 2 })
  plot(ema5,'EMA5',{ style: 'triangleUp', color: '#0050ff', linewidth: 2 })
  plot(ema6,'EMA6',{ style: 'arrowDown', color: '#ffffff', linewidth: 2 })


      `;
    }
    
    // Initialize Monaco Editor with the determined initial code.
    this.editorInstance = monaco.editor.create(this.editorDiv, {
      value: initialCode,
      language: "javascript",
      theme: "vs-dark",
      automaticLayout: true,
    } as monaco.editor.IStandaloneEditorConstructionOptions);
    
    console.log("Monaco Editor initialized in pane with initial code.");
  }
  
  
  private loadInitialScript(): void {
    let initialCode = "";
    if (this.handler.scriptsManager && typeof this.handler.scriptsManager.getLast === "function") {
      const recentScript = this.handler.scriptsManager.getLast();
      if (recentScript && recentScript.code) {
        initialCode = recentScript.code;
      }
    }
    
    if (initialCode) {
      this.setValue(initialCode);
      console.log("Loaded most recent script from scriptsManager.");
    } else {
      console.log("No saved scripts available in scriptsManager; editor value remains unchanged.");
    }
  }
  

  public open(): void {
    this.container.style.display = "flex";
    // Refresh the layout after showing.
    this.editorInstance?.layout();
    window.monaco = true;
  }

  /**
   * Closes (hides) the pane.
   */
  public close(): void {
    this.container.style.display = "none";
    window.monaco = false;
  }

  /**
   * Sets the code value in the editor.
   * @param code - The code to set in the editor.
   */
  public setValue(code: string): void {
    this.editorInstance?.setValue(code);
  }

  public getValue(): string {
    return this.editorInstance?.getValue() || "";
  }
  public async executePineTS(): Promise<void> {
    try {
      // Get code from the editor.
      const code = this.getValue();
  

      // Extract the indicator title from the code, ignoring lines starting with // or *
      const indicatorRegex = /^(?!\s*\/\/)(?!\s*\*)(.*indicator\s*\(\s*['"]([^'"]+)['"])/m;
      const match = code.match(indicatorRegex);

      // Capture from group #2 and strip any stray quotes
      const scriptKey = match?.[2]
        ? match[2].replace(/['"]/g, "") // Remove any literal ' or "
        : "defaultScript";

      console.log("Extracted script key:", scriptKey);
  
      // Retrieve the series titles from options.
      // We assume each series has an options() method returning an object with a "title" property.
      const mainSeries = (this.selectedSeries ?? this.handler.series).options().title;
      const volumeSeries = (this.selectedVolumeSeries ?? this.handler.volumeSeries)?.options?.()?.title || "";
  
      // Instantiate a new PineTS instance.
      const transformedData = transformDataToArray(
        [...(this.selectedSeries ?? this.handler.series).data()],
        [...(this.selectedVolumeSeries ? this.selectedVolumeSeries.data() : [])]
      );
      const pineTS = new PineTS(
        transformedData,
        this.handler.series.options().title,
        '1D'
      );
  
  

        // Build the script dynamically.
        const script = `(context) => { 
          
const { close, open, high, low, hlc3, volume, hl2, ohlc4 } = context.data;
const { plotchar, plot, na, indicator, nz, plotcandle, plotbar} = context.core;
const ta = context.ta;
const math = context.math;
const input = context.input;

${code}
        }`;

      const { plots, candles, bars } = await pineTS.run(script, undefined, false);
      console.log("Plots:", plots);
      console.log("Candles:", candles);
      console.log("Bars:", bars);

      if (plots) {
        for (const plotName in plots) {
          if (plots.hasOwnProperty(plotName)) {
            addPlotToHandler(this.handler, plotName, plots[plotName]);
          }
        }
      }
    
      if (candles) {
        for (const plotName in candles) {
          if (plots.hasOwnProperty(plotName)) {
            addPlotToHandler(this.handler, plotName, plots[plotName], "Candlestick");
          }
        }
      }
    
      if (bars) {
        for (const plotName in bars) {
          if (plots.hasOwnProperty(plotName)) {
            addPlotToHandler(this.handler, plotName, plots[plotName], "Bar");
          }
        }
      }
    
      // Save the PineTS instance along with the series titles.
      this.scripts[scriptKey] = {
        code,
        series: mainSeries,
        volumeSeries: volumeSeries,
      };
    
      // Subscribe to data changes on the main series.
      const series = this.selectedSeries ?? this.handler.series;
      series.subscribeDataChanged(() => {
        this.executeSavedScript(scriptKey);
      });
    } catch (error) {
      console.error("Error executing PineTS code:", error);
    }}
  
  public async executeSavedScript(scriptKey: string): Promise<void> {
    try {
      const savedScript = this.scripts[scriptKey];
      if (!savedScript) {
        console.warn(`No saved script found for key: ${scriptKey}`);
        return;
      }
  
      const { code, series, volumeSeries} = savedScript;
  
      // Look up the main series and volume series from the handler's seriesMap.
      const mainSeries = this.handler.seriesMap.get(series);
      const volSeries = volumeSeries ? this.handler.seriesMap.get(volumeSeries) : null;
  
      if (!mainSeries) {
        console.warn(`Main series with title "${mainSeries}" not found.`);
        return;
      }
  
      const transformedData = transformDataToArray(
        [...mainSeries.data()],
        volSeries ? [...volSeries.data()] : []
      );
            // Retrieve the series titles from options.

      const pineTS = new PineTS(
        transformedData,
        this.handler.series.options().title,
        '1D'
      );

    // Build the dynamic script with the saved code.
    const script = `(context) => { 
      const { close, open, high, low, hlc3, volume, hl2, ohlc4 } = context.data;
      const { plotchar, plot, na, indicator, nz } = context.core;
      const ta = context.ta;
      const math = context.math;
      const input = context.input;
      
      ${code}
    }`;

    const { plots, candles, bars } = await pineTS.run(script, undefined, true);
    console.log("Plots:", plots);
    console.log("Candles:", candles);
    console.log("Bars:", bars);

    if (plots) {
      for (const plotName in plots) {
        if (plots.hasOwnProperty(plotName)) {
          addPlotToHandler(this.handler, plotName, plots[plotName],undefined, true);
        }
      }
    }
  
    if (candles) {
      for (const plotName in candles) {
        if (plots.hasOwnProperty(plotName)) {
          addPlotToHandler(this.handler, plotName, plots[plotName], "Candlestick");
        }
      }
    }
  
    if (bars) {
      for (const plotName in bars) {
        if (plots.hasOwnProperty(plotName)) {
          addPlotToHandler(this.handler, plotName, plots[plotName], "Bar");
        }
      }
    }
  

  } catch (error) {
    console.error("Error executing PineTS code:", error);
  }}


  public saveScript(): void {
    const code = this.getValue();
   
  // Extract the indicator title from the code, ignoring lines that start with // or *
  const indicatorRegex = /^(?!\s*\/\/)(?!\s*\*)(.*indicator\s*\(\s*['"]([^'"]+)['"])/m;
  const match = code.match(indicatorRegex);

  // Capture from group #2 and strip any stray quotes
  const currentScriptKey = match?.[2]
    ? match[2].replace(/['"]/g, "") 
    : "defaultScript";
  
  // Update (or create) the current script in memory (only saving the code).
  if (this.scripts[currentScriptKey]) {
    this.scripts[currentScriptKey].code = code;
  } else {
    this.scripts[currentScriptKey] = {
      series: (this.selectedSeries ?? this.handler.series).options().title,
      volumeSeries: (this.selectedVolumeSeries ?? this.handler.volumeSeries).options().title,
      code,
    };     
  }
  
  console.log(`Script "${currentScriptKey}" updated in memory.`);

  // Send all saved scripts via the callback.
  Object.keys(this.scripts).forEach((key) => {
    const scriptData = this.scripts[key];
    const optionsJson = JSON.stringify(scriptData, null, 2);
    const message = `save_script_~_${key};;;${optionsJson}`;
    window.callbackFunction(message);
    console.log(`Script "${key}" sent via callback.`);
  });
}

public async saveToFile(): Promise<void> {
  const code = this.getValue();
  const newScriptKey = prompt("Enter a new script name/title:", "MyNewScript");
  if (!newScriptKey) {
    console.warn("Save To File canceled or no name provided.");
    return;
  }

  this.scripts[newScriptKey] = {
    series: (this.selectedSeries ?? this.handler.series).options().title,
    volumeSeries: (this.selectedVolumeSeries ?? this.handler.volumeSeries).options().title,
    code,
  };
  console.log(`Script saved as "${newScriptKey}" in memory.`);

  // Save the new script to its own JSON file.
  const jsonData = JSON.stringify(this.scripts[newScriptKey], null, 2);
  const filename = `${newScriptKey}.json`;
  this.downloadJson(jsonData, filename);

  // Also update the cache.json file with this new script.
  const cacheData = JSON.stringify(this.scripts[newScriptKey], null, 2);
  const cacheFilename = "cache.json";
  this.downloadJson(cacheData, cacheFilename);
}

public openScriptFromFile(): void {
  // Create a hidden file input element.
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.style.display = "none";

  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result;
          if (typeof result === "string") {
            const jsonData = JSON.parse(result);
            if (jsonData && jsonData.code) {
              // Load the script code into the editor.
              this.setValue(jsonData.code);
              console.log("Loaded script from file.");
            } else {
              console.error("The selected file does not contain a valid script with a 'code' property.");
            }
          }
        } catch (err) {
          console.error("Error parsing JSON file:", err);
        }
      };
      reader.readAsText(file);
    }
  };

  // Append the input to the body, trigger click, then remove it.
  document.body.appendChild(input);
  input.click();
  input.remove();
}

private downloadJson(jsonData: string, filename: string): void {
  try {
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`Downloaded ${filename}`);
  } catch (error) {
    console.error("Failed to download data: " + error);
  }
}

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

  public populateMainSeriesSelectMenu(
    event: MouseEvent,
    onSelect: (series: ISeriesApi<SeriesType>) => void
  ): void {
    const menuContainer = document.createElement('div');
    Object.assign(menuContainer.style, {
      position: 'absolute',
      top: `${event.clientY}px`,
      left: `${event.clientX}px`,
      backgroundColor: '#333',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      zIndex: '100000',
    });

    const ul = document.createElement('ul');
    Object.assign(ul.style, {
      listStyle: 'none',
      margin: '0',
      padding: '0'
    });

    const seriesOptions = Array.from(this.handler.seriesMap.entries()).map(
      ([seriesName, series]) => ({
        label: seriesName,
        value: series,
      })
    );
    if (this.handler.volumeSeries) { 
      seriesOptions.push( { label: 'Volume', value: this.handler.volumeSeries });
      }  
    seriesOptions.forEach((option) => {
      const li = document.createElement('li');
      li.innerText = option.label;
      li.style.cursor = 'pointer';
      li.style.padding = '5px';
      li.onclick = () => {
        onSelect(option.value);
        document.body.removeChild(menuContainer);
      };
      ul.appendChild(li);
    });

    const cancelLi = document.createElement('li');
    cancelLi.innerText = 'Cancel';
    cancelLi.style.cursor = 'pointer';
    cancelLi.style.padding = '5px';
    cancelLi.onclick = () => {
      document.body.removeChild(menuContainer);
    };
    ul.appendChild(cancelLi);

    menuContainer.appendChild(ul);
    document.body.appendChild(menuContainer);
  }

  public populateVolumeSeriesSelectMenu(
    event: MouseEvent,
    onSelect: (volumeSeries: ISeriesApi<SeriesType> | null) => void
  ): void {
    const menuContainer = document.createElement('div');
    Object.assign(menuContainer.style, {
      position: 'absolute',
      top: `${event.clientY}px`,
      left: `${event.clientX}px`,
      backgroundColor: '#333',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      zIndex: '100000',
    });

    const ul = document.createElement('ul');
    Object.assign(ul.style, {
      listStyle: 'none',
      margin: '0',
      padding: '0'
    });

    const noneLi = document.createElement('li');
    noneLi.innerText = 'None';
    noneLi.style.cursor = 'pointer';
    noneLi.style.padding = '5px';
    noneLi.onclick = () => {
      onSelect(null);
      document.body.removeChild(menuContainer);
    };
    ul.appendChild(noneLi);

    const seriesOptions = Array.from(this.handler.seriesMap.entries()).map(
      ([seriesName, series]) => ({
        label: seriesName,
        value: series,
      })
    );

    if (this.handler.volumeSeries) { 
    seriesOptions.push( { label: 'Volume', value: this.handler.volumeSeries });
    }  
    seriesOptions.forEach((option) => {
      const li = document.createElement('li');
      li.innerText = option.label;
      li.style.cursor = 'pointer';
      li.style.padding = '5px';
      li.onclick = () => {
        onSelect(option.value);
        document.body.removeChild(menuContainer);
      };
      ul.appendChild(li);
    });

    const cancelLi = document.createElement('li');
    cancelLi.innerText = 'Cancel';
    cancelLi.style.cursor = 'pointer';
    cancelLi.style.padding = '5px';
    cancelLi.onclick = () => {
      document.body.removeChild(menuContainer);
    };
    ul.appendChild(cancelLi);

    menuContainer.appendChild(ul);
    document.body.appendChild(menuContainer);
  }
}





/**
 * Transforms an array of data objects (each containing at least a "time" field and OHLCV values)
 * into an array of objects with added "openTime" and "closeTime" fields.
 * If volume is missing on an item, it attempts to use a corresponding value from volumeData.
 *
 * @param data Array of data objects.
 * @param volumeData Array of volume data objects (optional).
 * @returns An array of transformed data objects.
 */
function transformDataToArray(data: any[], volumeData: any[] = []): any[] {
  return data.map((item, idx) => {
    // Parse the "time" field into a timestamp.
    let parsedTime: number;
    if (typeof item.time === "number") {
      parsedTime = item.time;
    } else {
      parsedTime = new Date(item.time).getTime();
    }
    if (isNaN(parsedTime)) {
      console.warn(`Invalid time format: ${item.time}`);
      return null; // Skip this item if time is invalid.
    }

    return {
      ...item,
      openTime: parsedTime,
      closeTime: parsedTime + 86399, // 1 second (1000ms) before openTime.
      // Parse volume; if missing, try to use volumeData.
      volume: item.volume !== undefined 
        ? Number(item.volume) 
        : (volumeData[idx] !== undefined ? Number(volumeData[idx].value) : 0)
    };
  }).filter(item => item !== null);
}
