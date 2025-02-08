import { DrawingTool } from "../drawing/drawing-tool";
import { TrendLine } from "../trend-line/trend-line";
import { Box } from "../box/box";
import { Drawing } from "../drawing/drawing";
import { GlobalParams } from "./global-params";
import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { HorizontalLine } from "../horizontal-line/horizontal-line";
import { RayLine } from "../horizontal-line/ray-line";
import { VerticalLine } from "../vertical-line/vertical-line";
// Right alongside your existing imports for other drawing classes:
import { Handler } from "./handler";

// Import the pitchfork tools
import { PitchFork } from "../pitchfork/pitchfork";

//import { FibonacciCircleDrawing,
//     FibonacciExtensionDrawing,
//      FibonacciSegmentDrawing,
//       FibonacciSpiralDrawing,
//        GannBoxDrawing } from "../technical-analysis/technical-analysis";
interface Icon {
    div: HTMLDivElement,
    group: SVGGElement,
    type: new (...args: any[]) => Drawing
}

declare const window: GlobalParams

export class ToolBox {
    private static readonly TREND_SVG: string = '<rect x="3.84" y="13.67" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -5.9847 14.4482)" width="21.21" height="1.56"/><path d="M23,3.17L20.17,6L23,8.83L25.83,6L23,3.17z M23,7.41L21.59,6L23,4.59L24.41,6L23,7.41z"/><path d="M6,20.17L3.17,23L6,25.83L8.83,23L6,20.17z M6,24.41L4.59,23L6,21.59L7.41,23L6,24.41z"/>';
    private static readonly HORZ_SVG: string = '<rect x="4" y="14" width="9" height="1"/><rect x="16" y="14" width="9" height="1"/><path d="M11.67,14.5l2.83,2.83l2.83-2.83l-2.83-2.83L11.67,14.5z M15.91,14.5l-1.41,1.41l-1.41-1.41l1.41-1.41L15.91,14.5z"/>';
    private static readonly RAY_SVG: string = '<rect x="8" y="14" width="17" height="1"/><path d="M3.67,14.5l2.83,2.83l2.83-2.83L6.5,11.67L3.67,14.5z M7.91,14.5L6.5,15.91L5.09,14.5l1.41-1.41L7.91,14.5z"/>';
    private static readonly BOX_SVG: string = '<rect x="8" y="6" width="12" height="1"/><rect x="9" y="22" width="11" height="1"/><path d="M3.67,6.5L6.5,9.33L9.33,6.5L6.5,3.67L3.67,6.5z M7.91,6.5L6.5,7.91L5.09,6.5L6.5,5.09L7.91,6.5z"/><path d="M19.67,6.5l2.83,2.83l2.83-2.83L22.5,3.67L19.67,6.5z M23.91,6.5L22.5,7.91L21.09,6.5l1.41-1.41L23.91,6.5z"/><path d="M19.67,22.5l2.83,2.83l2.83-2.83l-2.83-2.83L19.67,22.5z M23.91,22.5l-1.41,1.41l-1.41-1.41l1.41-1.41L23.91,22.5z"/><path d="M3.67,22.5l2.83,2.83l2.83-2.83L6.5,19.67L3.67,22.5z M7.91,22.5L6.5,23.91L5.09,22.5l1.41-1.41L7.91,22.5z"/><rect x="22" y="9" width="1" height="11"/><rect x="6" y="9" width="1" height="11"/>';
    private static readonly VERT_SVG: string = ToolBox.RAY_SVG;

    // Add new static SVG icons for pitchfork tools:
    private static readonly PITCHFORK_SVG: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g fill="#ffffff" fill-rule="nonzero"><path d="M7.275 21.432l12.579-12.579-.707-.707-12.579 12.579z"/><path d="M6.69 13.397l7.913 7.913.707-.707-7.913-7.913z"/><path d="M7.149 10.558l7.058-7.058-.707-.707-7.058 7.058z" id="Line"/><path d="M20.149 21.558l7.058-7.058-.707-.707-7.058 7.558z"/><path d="M5.5 23h11v-1h-11z"/><path d="M4.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"/></g></svg>';
    //sprivate static readonly SCHIFF_PITCHFORK_SVG: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g fill="#ffffff" fill-rule="nonzero"><path d="M7.354 21.354l14-14-.707-.707-14 14z"/><path d="M8.336 13.043l8.621 8.621.707-.707-8.621-8.621z"/><path d="M9.149 10.558l7.058-7.058-.707-.707-7.058 7.058z" id="Line"/><path d="M20.149 21.558l7.058-7.058-.707-.707-7.058 7.558z"/><path d="M5.5 23h10v-1h-10z"/><path d="M4.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"/></g></svg>';
    //sprivate static readonly MODIFIED_SCHIFF_PITCHFORK_SVG: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g fill="#ffffff" fill-rule="nonzero"><path d="M10.275 20.432l11.579-11.579-.707-.707-11.579 11.579z"/><path d="M6.69 13.397l7.913 7.913.707-.707-7.913-7.913z"/><path d="M7.149 10.558l7.058-7.058-.707-.707-7.058 7.058z" id="Line"/><path d="M20.149 21.558l7.058-7.058-.707-.707-7.058 7.558z"/><path d="M5.5 23h11v-1h-11z"/><path d="M4.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"/></g></svg>';
    //sprivate static readonly INSIDE_PITCHFORK_SVG: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g fill="#ffffff" fill-rule="nonzero"><path d="M6.5 23h12v-1h-12z" id="Line"/><path d="M21.596 20.715l3.091-9.66-.952-.305-3.091 9.66z"/><path d="M8.413 22.664l1.95-6.094-.952-.305-1.95 6.094z"/><path d="M11.602 12.695l3.085-9.641-.952-.305-3.085 9.641z"/><path d="M11.783 16.167l6.817 5.454.625-.781-6.817-5.454z"/><path d="M15.976 18.652l3.711-11.598-.952-.305-3.711 11.598z"/><path d="M4.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"/></g></svg>';
    //sprivate static readonly SEGMENT_SVG: string = '<line x1="5" y1="10" x2="25" y2="10" stroke="black" stroke-width="1"/>';
    //sprivate static readonly EXTENSION_SVG: string = '<line x1="5" y1="10" x2="25" y2="10" stroke="black" stroke-width="1" stroke-dasharray="4,2"/>';
    //sprivate static readonly CIRCLE_SVG: string = '<circle cx="15" cy="15" r="10" stroke="black" stroke-width="1" fill="none"/>';
    //sprivate static readonly SPIRAL_SVG: string = '<path d="M15 15 m -10,0 a 10,10 0 1,0 20,0 a 10,10 0 1,0 -20,0" fill="none" stroke="black" stroke-width="1"/>';
    //sprivate static readonly GANN_SVG: string = '<rect x="8" y="8" width="12" height="12" stroke="black" fill="none" stroke-width="1"/><line x1="8" y1="8" x2="20" y2="20" stroke="black" stroke-width="1"/><line x1="20" y1="8" x2="8" y2="20" stroke="black" stroke-width="1"/>';

    div: HTMLDivElement;
    private activeIcon: Icon | null = null;

    private buttons: HTMLDivElement[] = [];

    private _commandFunctions: Function[];
    private _handlerID: string;
    private _drawingTool: DrawingTool;
    private handler: Handler 
    constructor(handler: Handler, handlerID: string, chart: IChartApi, series: ISeriesApi<SeriesType>, commandFunctions: Function[]) {
        this._handlerID = handlerID;
        this._commandFunctions = commandFunctions;
        this._drawingTool = new DrawingTool(chart, series, () => this.removeActiveAndSave());
        this.div = this._makeToggleToolBox();
        this.handler = handler;
        this.handler.ContextMenu.setupDrawingTools(this.saveDrawings, this._drawingTool);

        commandFunctions.push((event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
                const drawingToDelete = this._drawingTool.drawings.pop();
                if (drawingToDelete) this._drawingTool.delete(drawingToDelete);
                return true;
            }
            return false;
        });
    }

    toJSON() {
        // Exclude the chart attribute from serialization
        const { ...serialized} = this;
        return serialized;
    }
    
    private _makeToggleToolBox(): HTMLDivElement {
        const outerDiv = document.createElement('div');
        outerDiv.classList.add('flyout-toolbox');
        
        // Position the container absolutely at the top center.
        outerDiv.style.position = 'absolute';
        outerDiv.style.top = '0';
        outerDiv.style.left = '50%';
        outerDiv.style.transform = 'translateX(-50%)';
        outerDiv.style.zIndex = '1000';
        outerDiv.style.overflow = 'hidden';
        outerDiv.style.transition = 'height 0.3s ease';
      
        // Create the container for the toolbox content (the buttons).
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('toolbox-content');
        // Use inline-flex so its width is determined by its content.
        contentDiv.style.display = 'inline-flex';
        contentDiv.style.flexDirection = 'row';
        contentDiv.style.justifyContent = 'center';
        contentDiv.style.alignItems = 'center';
        contentDiv.style.padding = '5px';
        contentDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        // Initially, content is hidden.
        contentDiv.style.display = 'none';
      
        // Create toolbox buttons using your existing method.
        this.buttons = [];
        this.buttons.push(this._makeToolBoxElement(TrendLine, 'KeyT', ToolBox.TREND_SVG));
        this.buttons.push(this._makeToolBoxElement(HorizontalLine, 'KeyH', ToolBox.HORZ_SVG));
        this.buttons.push(this._makeToolBoxElement(RayLine, 'KeyR', ToolBox.RAY_SVG));
        this.buttons.push(this._makeToolBoxElement(Box, 'KeyB', ToolBox.BOX_SVG));
        this.buttons.push(this._makeToolBoxElement(VerticalLine, 'KeyV', ToolBox.VERT_SVG, true));
        this.buttons.push(this._makeToolBoxElement(PitchFork, 'KeyP', ToolBox.PITCHFORK_SVG));
      
        // Append each button to the content container.
        for (const button of this.buttons) {
          contentDiv.appendChild(button);
        }
        
        // Create the toggle tab that will always be visible and is attached to the bottom.
        const toggleTab = document.createElement('div');
        toggleTab.textContent = '▼'; // Down arrow for collapsed state.
        toggleTab.style.width = '15px';
        toggleTab.style.height = '10px';
        toggleTab.style.backgroundColor = 'rgba(0, 0, 0, 0)'
        toggleTab.style.color = '#fff';
        toggleTab.style.textAlign = 'center';
        toggleTab.style.lineHeight = '15px';
        toggleTab.style.cursor = 'pointer';
        // No extra margin needed since we want it attached.
        
        // Append both content and toggle tab to the outer container.
        outerDiv.appendChild(contentDiv);
        outerDiv.appendChild(toggleTab);
      
        // Define heights.
        const tabHeight = 15;  // Height of the toggle tab.
        let expanded = false;
        
        // When collapsed, outerDiv's height is exactly the toggle tab's height.
        outerDiv.style.height = `${tabHeight}px`;
        
        // Toggle behavior: clicking the tab shows or hides the content.
        toggleTab.onclick = () => {
          expanded = !expanded;
          if (expanded) {
            // Show content.
            contentDiv.style.display = 'inline-flex';
            // Force reflow to measure the content height.
            const contentHeight = contentDiv.scrollHeight;
            // Set the outer container's height to content + tab height.
            outerDiv.style.height = `${tabHeight + contentHeight}px`;
            toggleTab.textContent = '▲';  // Up arrow indicates expanded.
          } else {
            // Hide content.
            contentDiv.style.display = 'none';
            outerDiv.style.height = `${tabHeight}px`;
            toggleTab.textContent = '▼';  // Down arrow indicates collapsed.
          }
        };
      
        return outerDiv;
      }
      
    

    private _makeToolBoxElement(DrawingType: new (...args: any[]) => Drawing, keyCmd: string, paths: string, rotate=false) {
        const elem = document.createElement('div')
        elem.classList.add("toolbox-button");

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "29");
        svg.setAttribute("height", "29");

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.innerHTML = paths
        group.setAttribute("fill", window.pane.color)

        svg.appendChild(group)
        elem.appendChild(svg);

        const icon: Icon = {div: elem, group: group, type: DrawingType}

        elem.addEventListener('click', () => this._onIconClick(icon));

        this._commandFunctions.push((event: KeyboardEvent) => {
            if (this._handlerID !== window.handlerInFocus) return false;

            if (event.altKey && event.code === keyCmd) {
                event.preventDefault()
                this._onIconClick(icon);
                return true
            }
            return false;
        })

        if (rotate == true) {
            svg.style.transform = 'rotate(90deg)';
            svg.style.transformBox = 'fill-box';
            svg.style.transformOrigin = 'center';
        }

        return elem
    }

    private _onIconClick(icon: Icon) {
        if (this.activeIcon) {

            this.activeIcon.div.classList.remove('active-toolbox-button');
            window.setCursor('crosshair');
            this._drawingTool?.stopDrawing()
            if (this.activeIcon === icon) {
                this.activeIcon = null
                return 
            }
        }
        this.activeIcon = icon
        this.activeIcon.div.classList.add('active-toolbox-button')
        window.setCursor('crosshair');
        this._drawingTool?.beginDrawing(this.activeIcon.type);
    }

    removeActiveAndSave = () => {
        window.setCursor('default');
        if (this.activeIcon) this.activeIcon.div.classList.remove('active-toolbox-button')
        this.activeIcon = null
        this.saveDrawings()
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
                //case "SchiffPitchfork":
                //    this._drawingTool.addNewDrawing(new PitchFork(d.points[0], d.points[1], d.points[2], {...d.options, variant: "schiff"}));
                //    break;
                //case "ModifiedSchiffPitchfork":
                //    this._drawingTool.addNewDrawing(new PitchFork(d.points[0], d.points[1], d.points[2], {...d.options, variant: "modifiedSchiff"}));
                //    break;
                //case "InsidePitchfork":
                //    this._drawingTool.addNewDrawing(new PitchFork(d.points[0], d.points[1], d.points[2], {...d.options, variant: "inside"}));
                //    break;
                //case "FibonacciSegment":
                //    this._drawingTool.addNewDrawing(new FibonacciSegmentDrawing(d.points[0], d.points[1], d.options));
                //    break;
                //case "FibonacciExtension":
                //    this._drawingTool.addNewDrawing(new FibonacciExtensionDrawing(d.points[0], d.points[1], d.options));
                //    break;
                //case "FibonacciCircle":
                //    this._drawingTool.addNewDrawing(new FibonacciCircleDrawing(d.points[0], d.points[1], d.options));
                //    break;
                //case "FibonacciSpiral":
                //    this._drawingTool.addNewDrawing(new FibonacciSpiralDrawing(d.points[0], d.points[1], d.options));
                //    break;
                //case "GannBox":
                //    this._drawingTool.addNewDrawing(new GannBoxDrawing(d.points[0], d.points[1], d.points[2], d.points[3], d.options));
                //    break;
                }
                });
            }
        }