import { Point } from './data-source';
import { DrawingOptions, defaultOptions } from './options';
import { Drawing } from './drawing';
import { TwoPointDrawingPaneView } from './pane-view';
import { PluginBase } from '../plugin-base';
import { ISeriesApiExtended } from '../helpers/series';
import { PluginRegistry } from '../helpers/general';
import { MouseEventParams } from 'lightweight-charts';


export abstract class TwoPointDrawing extends Drawing {
    _paneViews: TwoPointDrawingPaneView[] = [];

    protected _hovered: boolean = false;

    public linkedObjects: PluginBase[] = []
    constructor(
        p1: Point,
        p2: Point,
        options?: Partial<DrawingOptions>
    ) {
        super()
        this.points.push(p1);
        this.points.push(p2);
        this._options = {
            ...defaultOptions,
            ...options,
        };
    }

    setFirstPoint(point: Point) {
        this.updatePoints(point);
    }

    setSecondPoint(point: Point) {
        this.updatePoints(null, point);
    }



  /**
   * Subclasses must implement this to determine if the mouse is over this object itself.
   */
  protected abstract _mouseIsOverTwoPointDrawing(param: MouseEventParams): boolean;

  /**
   * Checks all linked objects for any mouse-over or hovered behavior.
   * It iterates over all properties of each linked object, and if the property name contains
   * either "mouseIsOver" or "_hovered" and is a function, it calls that function.
   * If any such function returns true, this method returns true.
   */
  protected _mouseIsOverObjects(param: MouseEventParams): boolean {
    for (const obj of this.linkedObjects as any) {
        
        for (const key in obj) {
          if (key.includes("mouseIsOver") && typeof obj[key] === "function") {
            if (obj[key](param)) {
              return true;
            }
          }
          if (key.includes("_hovered") && typeof obj[key] === "function") {
            if (obj[key]()) {
              return true;
            }
          }
        }
      }
    return false;
  }

  public _mouseIsOverDrawing(param: MouseEventParams): boolean {
    const selfResult = this._mouseIsOverTwoPointDrawing(param);
    const objectsResult = this._mouseIsOverObjects(param);
    const finalResult = selfResult || objectsResult;

    // Decorate: log intermediate values for debugging.
    console.debug("Mouse over check", {
      selfResult,
      objectsResult,
      finalResult,
    });

    return finalResult;
  }

    
    public detach(): void {
        this.linkedObjects.forEach((primitive:PluginBase) => {
            const series = primitive.series
            if (series){
            (series as ISeriesApiExtended).detachPrimitive(primitive)
            
            }
        });
        this.linkedObjects = [];  // Clear linked objects after detaching
        super.detach()

    }

    get p1() { return this.points[0]; }
    get p2() { return this.points[1]; }

    get hovered() { return this._hovered; }


  }