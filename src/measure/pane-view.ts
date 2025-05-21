import { Measure, MeasureOptions } from './measure';
import { MeasurePaneRenderer } from './pane-renderer';
import { TwoPointDrawingPaneView } from '../drawing/pane-view';
import { BoxOptions } from '../box/box';

export class MeasurePaneView extends TwoPointDrawingPaneView {
    constructor(source: Measure) {
        super(source)
    }

    renderer() {
        return new MeasurePaneRenderer(
            this._source.series, // to help convert price coordinates
            this._source.chart, // to help convert time coordinates
            this._p1,
            this._p2,
            this._source._options as BoxOptions,
            this._source.hovered,
        );
    }
}