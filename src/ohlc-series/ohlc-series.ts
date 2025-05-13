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
		}
	//upperUpColor: string|undefined
	//upperDownColor: string|undefined
	//lowerUpColor: string|undefined
	//lowerDownColor: string|undefined
export const ohlcdefaultOptions: ohlcSeriesOptions = {
	...customSeriesDefaultOptions,
	upColor: '#26a69a',
	downColor: '#ef5350',
	wickVisible: true,
	borderVisible: true,
	borderColor: '#378658',
	borderUpColor: '#26a69a',
	borderDownColor: '#ef5350',
	wickColor: '#737375',
	wickUpColor: '#26a69a',
	wickDownColor: '#ef5350',
	radius: .6,
	shape: 'Rounded' as CandleShape,  // Default shape
	chandelierSize: 1,
	barSpacing: 0.8,
	lineStyle: 0 as LineStyle,
	lineWidth: 2 as  LineWidth

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

