import { IPrimitivePaneView, PrimitivePaneViewZOrder } from "lightweight-charts";
import { BandViewData, FillArea } from "./fill-area";
import { FillAreaPaneRenderer } from "./renderer";

export class FillAreaPaneView implements IPrimitivePaneView {
    _source: FillArea;
    _data: BandViewData;

    constructor(source: FillArea) {
        this._source = source;
        this._data = {
            data: [],
            options: this._source.options, // Pass the options for the renderer
        };
    }

    update() {
        const timeScale = this._source.chart.timeScale();

        this._data.data = this._source._bandsData.map((d) => ({
            x: timeScale.timeToCoordinate(d.time)!,
            origin: this._source._originSeries.priceToCoordinate(d.origin)!,
            destination: this._source._destinationSeries.priceToCoordinate(d.destination)!,
            isOriginAbove: d.origin > d.destination,
        }));

        // Ensure options are updated in the data
        this._data.options = this._source.options;
    }

    renderer() {
        return new FillAreaPaneRenderer(this._data);
    }
    zOrder() {
        return 'bottom' as PrimitivePaneViewZOrder;
    }
}
