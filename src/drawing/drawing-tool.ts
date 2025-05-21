import {
    IChartApi,
    ISeriesApi,
    Logical,
    MouseEventParams,
    SeriesType,
} from 'lightweight-charts';
import { Drawing } from './drawing';
import { TwoPointDrawing } from '../drawing/two-point-drawing';
import { ThreePointDrawing } from '../drawing/three-point-drawing';
import { FourPointDrawing } from '../drawing/four-point-drawing';
import { Point } from '../drawing/data-source';

export class DrawingTool {
    private _chart: IChartApi;
    private _series: ISeriesApi<SeriesType>;
    private _finishDrawingCallback: Function | null = null;

    private _drawings: Drawing[] = [];
    private _activeDrawing: Drawing | null = null;
    private _isDrawing: boolean = false;
    private _drawingType: (new (...args: any[]) => Drawing) | null = null;

    // Temporary storage for multi-click drawings.
    // For three-point drawings we only need the first point.
    // For four-point drawings we need both the first and second temporary points.
    private _tempStartPoint: Point | null = null;
    private _tempSecondPoint: Point | null = null;

    // Track the number of clicks for the active drawing.
    private _clickCount: number = 0;

    constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, finishDrawingCallback: Function | null = null) {
        this._chart = chart;
        this._series = series;
        this._finishDrawingCallback = finishDrawingCallback;

        this._chart.subscribeClick(this._clickHandler);
        this._chart.subscribeCrosshairMove(this._moveHandler);
    }

    private _clickHandler = (param: MouseEventParams) => this._onClick(param);
    private _moveHandler = (param: MouseEventParams) => this._onMouseMove(param);

    beginDrawing(DrawingType: new (...args: any[]) => Drawing) {
        this._drawingType = DrawingType;
        this._isDrawing = true;
        this._tempStartPoint = null;
        this._tempSecondPoint = null;
        this._clickCount = 0;
    }

    stopDrawing() {
        this._isDrawing = false;
        this._activeDrawing = null;
        this._tempStartPoint = null;
        this._tempSecondPoint = null;
        this._clickCount = 0;
    }

    get drawings() {
        return this._drawings;
    }

    addNewDrawing(drawing: Drawing) {
        this._series.attachPrimitive(drawing);
        this._drawings.push(drawing);
    }

    delete(d: Drawing | null) {
        if (d == null) return;
        const idx = this._drawings.indexOf(d);
        if (idx == -1) return;
        this._drawings.splice(idx, 1);
        d.detach();
    }

    clearDrawings() {
        for (const d of this._drawings) d.detach();
        this._drawings = [];
    }

    repositionOnTime() {
        for (const drawing of this.drawings) {
            const newPoints = [];
            for (const point of drawing.points) {
                if (!point) {
                    newPoints.push(point);
                    continue;
                }
                const logical = point.time
                    ? this._chart.timeScale().coordinateToLogical(
                          this._chart.timeScale().timeToCoordinate(point.time) || 0
                      )
                    : point.logical;
                newPoints.push({
                    time: point.time,
                    logical: logical as Logical,
                    price: point.price,
                });
            }
            drawing.updatePoints(...newPoints);
        }
    }

    private _onClick(param: MouseEventParams): void {
        if (!this._isDrawing) return;

        const point = Drawing._eventToPoint(param, this._series);
        if (!point) return;

        // 1) Determine the required number of points based on the drawing type.
        let requiredPoints: number;
        if (this._drawingType) {
            if (this._drawingType.prototype instanceof FourPointDrawing) {
                requiredPoints = 4;
            } else if (this._drawingType.prototype instanceof ThreePointDrawing) {
                requiredPoints = 3;
            } else if (this._drawingType.prototype instanceof TwoPointDrawing) {
                requiredPoints = 2;
            } else {
                // default to 2 if unknown
                requiredPoints = 2;
            }
        } else {
            return;
        }

        // 2) Handle drawing creation based on the required points.
        if (requiredPoints === 3) {
            // --- Three-point drawing logic ---
            if (this._activeDrawing == null) {
                // First click: store temporary starting point.
                if (this._tempStartPoint == null) {
                    this._tempStartPoint = point;
                    this._clickCount = 1;
                    return;
                } else {
                    // Second click: create the drawing with p1 and p2.
                    this._activeDrawing = new this._drawingType(
                        this._tempStartPoint,
                        point,
                        null
                    );
                    this._series.attachPrimitive(this._activeDrawing);
                    this._clickCount = 2;
                    // Clear temporary storage so that we can set the third point next.
                    this._tempStartPoint = null;
                    return;
                }
            } else {
                // Third click: set p3 and finalize.
                if (this._clickCount === 2) {
                    (this._activeDrawing as ThreePointDrawing).setThirdPoint(point);
                    this._clickCount = 3;
                    this._drawings.push(this._activeDrawing);
                    this.stopDrawing();

                    if (this._finishDrawingCallback) {
                        this._finishDrawingCallback();
                    }
                }
            }
        } else if (requiredPoints === 4) {
            // --- Four-point drawing logic (initialize on click 3) ---
            if (this._activeDrawing == null) {
                // No active drawing yet.
                if (this._tempStartPoint == null) {
                    // Click 1: store first point.
                    this._tempStartPoint = point;
                    this._clickCount = 1;
                    return;
                } else if (this._tempSecondPoint == null) {
                    // Click 2: store second point.
                    this._tempSecondPoint = point;
                    this._clickCount = 2;
                    return;
                } else {
                    // Click 3: initialize the active drawing using the stored first two points
                    // and the current point as the third point. p4 remains null.
                    this._activeDrawing = new this._drawingType(
                        this._tempStartPoint,
                        this._tempSecondPoint,
                        point,
                        null
                    );
                    this._series.attachPrimitive(this._activeDrawing);
                    this._clickCount = 3;
                    // Clear temporary storage.
                    this._tempStartPoint = null;
                    this._tempSecondPoint = null;
                    return;
                }
            } else {
                // Active drawing is already initialized.
                // Click 4: set p4 and finalize.
                if (this._clickCount === 3) {
                    (this._activeDrawing as FourPointDrawing).setFourthPoint(point);
                    this._clickCount = 4;
                    this._drawings.push(this._activeDrawing);
                    this.stopDrawing();
                    if (this._finishDrawingCallback) {
                        this._finishDrawingCallback();
                    }
                }
            }
        } else {
            // --- Two-point drawing logic ---
            if (this._activeDrawing == null) {
                // First click: create drawing with (p1, p2 = same).
                this._activeDrawing = new this._drawingType(point, point);
                this._series.attachPrimitive(this._activeDrawing);
                this._clickCount = 1;
            } else {
                // Second click: finalize p2.
                (this._activeDrawing as TwoPointDrawing).setSecondPoint(point);
                this._clickCount = 2;
                this._drawings.push(this._activeDrawing);
                this.stopDrawing();
                if (this._finishDrawingCallback) {
                    this._finishDrawingCallback();
                }
            }
        }
    }

    /**
     * Called whenever the user moves the mouse on the chart (crosshair).
     * Used for real-time preview of the current drawing.
     */
    private _onMouseMove(param: MouseEventParams): void {
        if (!param) return;

        // 1) Hover logic for all existing drawings.
        for (const d of this._drawings) {
            d._handleHoverInteraction(param);
        }

        // 2) If we are in the middle of drawing, update the last "live" point.
        if (!this._isDrawing || !this._activeDrawing) return;

        const point = Drawing._eventToPoint(param, this._series);
        if (!point) return;

        // Determine if the drawing is two-, three-, or four-point.
        const isThreePoint = this._drawingType && (this._drawingType.prototype instanceof ThreePointDrawing);
        const isFourPoint = this._drawingType && (this._drawingType.prototype instanceof FourPointDrawing);

        if (isFourPoint) {
            // For four-point drawing:
            // - If click count is 2 (waiting for the third click), preview the third point.
            // - If click count is 3 (active drawing created and waiting for p4), preview the fourth point.
            if (this._clickCount === 2) {
                (this._activeDrawing as FourPointDrawing).updatePoints(null, null, point, null);
            } else if (this._clickCount === 3) {
                (this._activeDrawing as FourPointDrawing).updatePoints(null, null, null, point);
            }
        } else if (isThreePoint) {
            // For three-point drawing: preview the third point if click count is 2.
            if (this._clickCount === 2) {
                (this._activeDrawing as ThreePointDrawing).updatePoints(null, null, point);
            }
        } else {
            // For two-point drawing: preview the second point.
            (this._activeDrawing as TwoPointDrawing).setSecondPoint(point);
        }
    }
}
