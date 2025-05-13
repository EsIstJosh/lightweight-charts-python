import { CanvasRenderingTarget2D } from "fancy-canvas";
import { ISeriesPrimitivePaneRenderer, Coordinate, ISeriesPrimitivePaneView, Time, ISeriesPrimitive, SeriesAttachedParameter, DataChangedScope, SeriesDataItemTypeMap, SeriesType, Logical, AutoscaleInfo, BarData, LineData, ISeriesApi } from "lightweight-charts";
import { PluginBase } from "../plugin-base";
import { setOpacity } from "../helpers/colors";
import { ClosestTimeIndexFinder } from '../helpers/closest-index';
import { hasColorOption } from "../helpers/typeguards";
export class FillArea extends PluginBase implements ISeriesPrimitive<Time> {
    static type = "Fill Area"; // Explicitly set the type name
    
    _paneViews: FillAreaPaneView[];
    _originSeries: ISeriesApi<SeriesType>;
    _destinationSeries: ISeriesApi<SeriesType>;
    _bandsData: BandData[] = [];
    options: Required<FillAreaOptions>;
	_timeIndices: ClosestTimeIndexFinder<{ time: number }>;

    constructor(
        originSeries: ISeriesApi<SeriesType>,
        destinationSeries: ISeriesApi<SeriesType>,
        options: FillAreaOptions
    ) {
        super();
    
        // Existing logic for setting colors
        const defaultOriginColor = setOpacity('#0000FF', 0.25); // Blue
        const defaultDestinationColor = setOpacity('#FF0000', 0.25); // Red
        const originSeriesColor = hasColorOption(originSeries)
            ? setOpacity((originSeries.options() as any).lineColor || defaultOriginColor, 0.3)
            : setOpacity(defaultOriginColor, 0.3);
        const destinationSeriesColor = hasColorOption(destinationSeries)
            ? setOpacity((destinationSeries.options() as any).lineColor || defaultDestinationColor, 0.3)
            : setOpacity(defaultDestinationColor, 0.3);
    
        this.options = {
            ...defaultFillAreaOptions,
            ...options,
            originColor: options.originColor ?? originSeriesColor,
            destinationColor: options.destinationColor ?? destinationSeriesColor,
        };
    
        this._paneViews = [new FillAreaPaneView(this)];
        this._timeIndices = new ClosestTimeIndexFinder([]);
        this._originSeries = originSeries;
        this._destinationSeries = destinationSeries;
    
        // Subscribe to data changes in both series
        this._originSeries.subscribeDataChanged(() => {
            console.log("Origin series data has changed. Recalculating bands.");
            this.dataUpdated('full');
            this.updateAllViews();
        });
    
        this._destinationSeries.subscribeDataChanged(() => {
            console.log("Destination series data has changed. Recalculating bands.");
            this.dataUpdated('full');
            this.updateAllViews();
        });
    }
    
    

    updateAllViews() {
        this._paneViews.forEach(pw => pw.update());
    }
    applyOptions(options: Partial<FillAreaOptions>) {
        const defaultOriginColor = '#0000FF'; // Blue
        const defaultDestinationColor = '#FF0000'; // Red
    
        const originSeriesColor = hasColorOption(this._originSeries)
            ? setOpacity((this._originSeries.options() as any).lineColor || (this._originSeries.options() as any).color || defaultOriginColor, 0.3)
            : setOpacity(defaultOriginColor, 0.3);
    
        const destinationSeriesColor = hasColorOption(this._destinationSeries)
            ? setOpacity((this._destinationSeries.options() as any).lineColor || (this._destinationSeries.options() as any).color || defaultDestinationColor, 0.3)
            : setOpacity(defaultDestinationColor, 0.3);
    
        this.options = {
            ...this.options,
            ...options,
            originColor: options.originColor || originSeriesColor,
            destinationColor: options.destinationColor || destinationSeriesColor,
        };
    
        this.calculateBands();
        this.updateAllViews();
        super.requestUpdate();
    
        console.log("FillArea options updated:", this.options);
    }
    
    
    
    paneViews() {
        return this._paneViews;
    }

    attached(p: SeriesAttachedParameter<Time>): void {
        super.attached(p);
        this.dataUpdated('full');
    }

    dataUpdated(scope: DataChangedScope) {
        this.calculateBands();
        if (scope === 'full') {
            const originData = this._originSeries.data();
            this._timeIndices = new ClosestTimeIndexFinder(
                [...originData]  as { time: number }[]
            );
        }
    }

    calculateBands() {
        const originData = this._originSeries.data();
        const destinationData = this._destinationSeries.data();

        // Ensure both datasets have the same length
        const alignedData = this._alignDataLengths([...originData], [...destinationData]);

        const bandData: BandData[] = [];
        for (let i = 0; i < alignedData.origin.length; i++) {
            let points = extractPrices(alignedData.origin[i],alignedData.destination[i]);

            if (points?.originValue === undefined || points?.destinationValue === undefined) continue;

            // Determine which series is upper and lower
            const upper = Math.max(points?.originValue, points?.destinationValue);
            const lower = Math.min(points?.originValue, points?.destinationValue);

            bandData.push({
                time: alignedData.origin[i].time,
                origin: points?.originValue,
                destination: points?.destinationValue,
                upper,
                lower,
            });
        }

        this._bandsData = bandData;
    }

    _alignDataLengths(
        originData: SeriesDataItemTypeMap[SeriesType][],
        destinationData: SeriesDataItemTypeMap[SeriesType][]
    ): { origin: SeriesDataItemTypeMap[SeriesType][], destination: SeriesDataItemTypeMap[SeriesType][] } {
        const originLength = originData.length;
        const destinationLength = destinationData.length;

        if (originLength > destinationLength) {
            const lastKnown = destinationData[destinationLength - 1];
            while (destinationData.length < originLength) {
                destinationData.push({ ...lastKnown });
            }
        } else if (destinationLength > originLength) {
            const lastKnown = originData[originLength - 1];
            while (originData.length < destinationLength) {
                originData.push({ ...lastKnown });
            }
        }

        return { origin: originData, destination: destinationData };
    }

    autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo {
        const ts = this.chart.timeScale();
        const startTime = (ts.coordinateToTime(
            ts.logicalToCoordinate(startTimePoint) ?? 0
        ) ?? 0) as number;
        const endTime = (ts.coordinateToTime(
            ts.logicalToCoordinate(endTimePoint) ?? 5000000000
        ) ?? 5000000000) as number;
        const startIndex = this._timeIndices.findClosestIndex(startTime, 'left');
        const endIndex = this._timeIndices.findClosestIndex(endTime, 'right');

        const range = {
            minValue: Math.min(...this._bandsData.map(b => b.lower).slice(startIndex, endIndex + 1)),
            maxValue: Math.max(...this._bandsData.map(b => b.upper).slice(startIndex, endIndex + 1)),
        };

        return {
            priceRange: {
                minValue: range.minValue,
                maxValue: range.maxValue,
            },
        };
    }
}
class FillAreaPaneRenderer implements ISeriesPrimitivePaneRenderer {
    _viewData: BandViewData;
    _options: FillAreaOptions;

    constructor(data: BandViewData) {
        this._viewData = data;
        this._options = data.options;
    }

    draw() {}
    drawBackground(target: CanvasRenderingTarget2D) {
        const points: BandRendererData[] = this._viewData.data;
        const options = this._options;

        if (points.length < 2) return; // Ensure there are enough points to draw

        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);

            let currentPathStarted = false;
            let startIndex = 0;

            for (let i = 0; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];

                if (!currentPathStarted || current.isOriginAbove !== points[i - 1]?.isOriginAbove) {
                    if (currentPathStarted) {
                        for (let j = i - 1; j >= startIndex; j--) {
                            ctx.lineTo(points[j].x, points[j].destination);
                        }
                        ctx.closePath();
                        ctx.fill();
                    }

                    ctx.beginPath();
                    ctx.moveTo(current.x, current.origin);

                    ctx.fillStyle = current.isOriginAbove
                        ? options.originColor || 'rgba(0, 0, 0, 0)' // Default to transparent if null
                        : options.destinationColor || 'rgba(0, 0, 0, 0)'; // Default to transparent if null

                    startIndex = i;
                    currentPathStarted = true;
                }

                ctx.lineTo(next.x, next.origin);

                if (i === points.length - 2 || next.isOriginAbove !== current.isOriginAbove) {
                    for (let j = i + 1; j >= startIndex; j--) {
                        ctx.lineTo(points[j].x, points[j].destination);
                    }
                    ctx.closePath();
                    ctx.fill();
                    currentPathStarted = false;
                }
            }

            if (options.lineWidth) {
                ctx.lineWidth = options.lineWidth;
                ctx.strokeStyle = options.originColor || 'rgba(0, 0, 0, 0)';
                ctx.stroke();
            }
        });
    }
}

class FillAreaPaneView implements ISeriesPrimitivePaneView {
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
}



export interface FillAreaOptions {
    originColor: string | null; // Color for origin on top
    destinationColor: string | null; 
    lineWidth: number | null;
};

export const defaultFillAreaOptions: Required<FillAreaOptions> = {
    originColor: null,
    destinationColor: null,
    lineWidth: null,
};

interface BandData {
    time: Time;
    origin: number; // Price value from the origin series
    destination: number; // Price value from the destination series
    upper: number; // The upper value for rendering
    lower: number; // The lower value for rendering
};
interface BandViewData {
	data: BandRendererData[];
	options: Required<FillAreaOptions>;
};
interface BandRendererData {
    x: Coordinate | number;
    origin: Coordinate | number;
    destination: Coordinate | number;
    isOriginAbove: boolean; // True if the origin series is above the destination series
}

function extractPrices(
	originPoint: SeriesDataItemTypeMap[SeriesType],
	destinationPoint: SeriesDataItemTypeMap[SeriesType]
): {originValue: number| undefined, destinationValue: number| undefined} | undefined {
	let originPrice: number | undefined;
	let destinationPrice: number | undefined;

	// Extract origin price
	if ((originPoint as BarData).close !== undefined) {
		const originBar = originPoint as BarData;
		originPrice = originBar.close; // Use close price for comparison
	} else if ((originPoint as LineData).value !== undefined) {
		originPrice = (originPoint as LineData).value; // Use value for LineData
	}

	// Extract destination price
	if ((destinationPoint as BarData).close !== undefined) {
		const destinationBar = destinationPoint as BarData;
		destinationPrice = destinationBar.close; // Use close price for comparison
	} else if ((destinationPoint as LineData).value !== undefined) {
		destinationPrice = (destinationPoint as LineData).value; // Use value for LineData
	}

	// Ensure both prices are defined
	if (originPrice === undefined || destinationPrice === undefined) {
		return undefined;
	}

	// Handle mixed types and determine the appropriate values to return
	if (originPrice < destinationPrice) {
		// origin > destination: min(open, close) for BarData (if applicable), otherwise value
		const originValue =
			(originPoint as BarData).close !== undefined
				? Math.min((originPoint as BarData).open, (originPoint as BarData).close)
				: originPrice;

		const destinationValue =
			(destinationPoint as BarData).close !== undefined
				? Math.max((destinationPoint as BarData).open, (destinationPoint as BarData).close)
				: destinationPrice;

		return {originValue, destinationValue};
	} else {
		// origin <= destination: max(open, close) for BarData (if applicable), otherwise value
		const originValue =
			(originPoint as BarData).close !== undefined
				? Math.max((originPoint as BarData).open, (originPoint as BarData).close)
				: originPrice;

		const destinationValue =
			(destinationPoint as BarData).close !== undefined
				? Math.min((destinationPoint as BarData).open, (destinationPoint as BarData).close)
				: destinationPrice;

		return {originValue, destinationValue};
	}
}