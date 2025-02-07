import { Point } from './data-source';
import { DrawingOptions, defaultOptions } from './options';
import { Drawing } from './drawing';
import { ThreePointDrawingPaneView } from './pane-view';
import { ISeriesApiExtended } from '../helpers/series';
import { PluginBase } from '../plugin-base';


export abstract class ThreePointDrawing extends Drawing {
    _paneViews: ThreePointDrawingPaneView[] = [];

    protected _hovered: boolean = false;
    public linkedObjects: PluginBase[] = []

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
    constructor(
        p1: Point,
        p2: Point,
        p3: Point,
        options?: Partial<DrawingOptions>
    ) {
        super()
        this.points.push(p1);
        this.points.push(p2);
        this.points.push(p3);

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
    setThirdPoint(point: Point) {
        this.updatePoints(null, null, point);
    }

    get p1() { return this.points[0]; }
    get p2() { return this.points[1]; }
    get p3() { return this.points[2]; }
    get hovered() { return this._hovered; }

}
