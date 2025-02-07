import {
	CustomSeriesOptions,
	CustomSeriesPricePlotValues,
	ICustomSeriesPaneView,
	PaneRendererCustomData,
	customSeriesDefaultOptions,
	CandlestickSeriesOptions,
	WhitespaceData,
	Time,
	LineStyle,
	LineWidth
} from 'lightweight-charts';
import { ohlcSeriesData, CandleShape } from './data';
import { ohlcSeriesRenderer} from './renderer';

export interface ohlcSeriesOptions
	extends CustomSeriesOptions,
		Exclude<
			CandlestickSeriesOptions,
			'borderColor'
		> {
	radius: number;
	shape:CandleShape;
	chandelierSize: number; 
	barSpacing: number;
	lineStyle: LineStyle;
	lineWidth: LineWidth;
	dynamicCandles:boolean;
	volumeMALength?: number;    // e.g. 20 (default if not provided)
	volumeMultiplier?: number;  // e.g. 1.0 (default if not provided)
	dynamicTrigger: () => { newBar: boolean }; // Corrected function signature

		}
	//upperUpColor: string|undefined
	//upperDownColor: string|undefined
	//lowerUpColor: string|undefined
	//lowerDownColor: string|undefined
export const ohlcdefaultOptions: ohlcSeriesOptions = {
	...customSeriesDefaultOptions,
	upColor: '#008000',
	downColor: '#8C0000',
	wickVisible: true,
	borderVisible: true,
	borderColor: '#737375',
	borderUpColor: '#008000',
	borderDownColor: '#8C0000',
	wickColor: '#737375',
	wickUpColor: '#008000',
	wickDownColor: '#8C0000',
	radius: .6,
	shape: 'Rounded' as CandleShape,  // Default shape
	chandelierSize: 1,
	barSpacing: 0.8,
	lineStyle: 0 as LineStyle,
	lineWidth: 2 as  LineWidth,
	dynamicCandles: false,
	dynamicTrigger: () => ({ newBar: true }) // Corrected function implementation
} as const;
	//upperUpColor: undefined,
	//upperDownColor: undefined,
	//lowerUpColor: undefined,
	//lowerDownColor: undefined,
export class ohlcSeries<TData extends ohlcSeriesData>
	implements ICustomSeriesPaneView<Time, TData, ohlcSeriesOptions>
{
	_renderer: ohlcSeriesRenderer<TData>;

	constructor() {
		this._renderer = new ohlcSeriesRenderer();
	}

	priceValueBuilder(plotRow: TData): CustomSeriesPricePlotValues {
		return [plotRow.high, plotRow.low, plotRow.close];
	}

	renderer(): ohlcSeriesRenderer<TData> {
		return this._renderer;
	}

	isWhitespace(data: TData | WhitespaceData): data is WhitespaceData {
		return (data as Partial<TData>).close === undefined;
	}

	update(
		data: PaneRendererCustomData<Time, TData>,
		options: ohlcSeriesOptions
	): void {
		this._renderer.update(data, options);
	}

	defaultOptions() {
		return ohlcdefaultOptions;
	}
}
// ./types.ts

