import { DrawingPaneView, ViewPoint } from '../drawing/pane-view';
import { PointMarker } from './point-marker';
import { PointMarkerPaneRenderer } from './pane-renderer';
import { InteractionState } from '../drawing/drawing';

export class PointMarkerPaneView extends DrawingPaneView {
    _point: ViewPoint = { x: null, y: null };
    _source: PointMarker;

    constructor(source: PointMarker) {
        super(source);
        this._source = source;
    }

    update() {
        if (!this._source.point) return;
        
        const series = this._source.series;
        const point = this._source.point;
        const y = series.priceToCoordinate(point.price);
        
        let x;
        if (point.time) {
            x = this._source.chart.timeScale().timeToCoordinate(point.time);
        } else {
            x = this._source.chart.timeScale().logicalToCoordinate(point.logical);
        }
        
        this._point = { x, y };
    }

    renderer() {
        return new PointMarkerPaneRenderer(
            this._point,
            this._source._options,
            this._source.isHovered() // Use the public method instead
        );
    }
}