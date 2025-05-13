import { MouseEventParams } from 'lightweight-charts';
import { Drawing, InteractionState } from '../drawing/drawing';
import { DiffPoint, Point } from '../drawing/data-source';
import { DrawingOptions, defaultOptions } from '../drawing/options';
import { PointMarkerPaneView } from './pane-view';  // Add this import

// Extended options for our point marker
export interface PointMarkerOptions extends DrawingOptions {
    radius: number;
    fillColor: string;
}

export const defaultPointMarkerOptions: PointMarkerOptions = {
    ...defaultOptions,
    radius: 5,
    fillColor: '#000000',
};

export class PointMarker extends Drawing {
    _type = 'PointMarker';

    constructor(point: Point, options?: Partial<PointMarkerOptions>) {
        super({
            ...defaultPointMarkerOptions,
            ...options,
        });
        this._points.push(point);
        // We'll set the pane view after constructor to avoid circular dependency
        // this._paneViews = [new PointMarkerPaneView(this)]; 
    }

    // Add this method to be called after construction
    initializeViews(): void {
        this._paneViews = [new PointMarkerPaneView(this)];
    }

    get point() { return this.points[0]; }

    protected _onMouseDown(): void {
        this._moveToState(InteractionState.DRAGGING);
    }

    protected _onDrag(diff: DiffPoint): void {
        this._addDiffToPoint(this.points[0], diff.logical, diff.price);
        this.requestUpdate();
    }

    protected _moveToState(state: InteractionState): void {
        switch (state) {
            case InteractionState.NONE:
                document.body.style.cursor = "default";
                this._unsubscribe("mousedown", this._handleMouseDownInteraction);
                break;
            case InteractionState.HOVERING:
                document.body.style.cursor = "pointer";
                this._subscribe("mousedown", this._handleMouseDownInteraction);
                this.chart.applyOptions({ handleScroll: true });
                break;
            case InteractionState.DRAGGING:
                document.body.style.cursor = "grabbing";
                this._subscribe("mouseup", this._handleMouseUpInteraction);
                this.chart.applyOptions({ handleScroll: false });
                break;
        }
        this._state = state;
    }

    protected _mouseIsOverDrawing(param: MouseEventParams): boolean {
        if (!param.point || !this.points[0]) return false;
        
        const point = this.points[0];
        const y = this.series.priceToCoordinate(point.price);
        if (!y) return false;
        
        // Get x-coordinate from time or logical index
        let x;
        if (point.time) {
            x = this.chart.timeScale().timeToCoordinate(point.time);
        } else {
            x = this.chart.timeScale().logicalToCoordinate(point.logical);
        }
        
        if (!x) return false;
        
        // Check if mouse is over the marker (circular area)
        const options = this._options as PointMarkerOptions;
        const radius = options.radius;
        const tolerance = 4; // Extra pixels for easier interaction
        
        const dx = param.point.x - x;
        const dy = param.point.y - y;
        return (dx * dx + dy * dy) <= ((radius + tolerance) * (radius + tolerance));
    }

    // Add this method to the PointMarker class
    public isHovered(): boolean {
        return this._state !== InteractionState.NONE;
    }
}