import {
	CustomSeriesPricePlotValues,
	ICustomSeriesPaneView,
	PaneRendererCustomData,
	WhitespaceData,
	Time,
} from 'lightweight-charts';
import { SymbolSeriesOptions, defaultSymbolSeriesOptions } from './options';
import { SymbolSeriesRenderer } from './renderer';
import { SymbolSeriesData } from './data';

export class SymbolSeries<TData extends SymbolSeriesData>
	implements ICustomSeriesPaneView<Time, TData, SymbolSeriesOptions>
{
	_renderer: SymbolSeriesRenderer<TData>;

	constructor() {
		this._renderer = new SymbolSeriesRenderer();
	}

	priceValueBuilder(plotRow: TData): CustomSeriesPricePlotValues {
		return [plotRow.value];
	}

	isWhitespace(data: TData | WhitespaceData): data is WhitespaceData {
		return (data as Partial<TData>).value === undefined;
	}

	renderer(): SymbolSeriesRenderer<TData> {
		return this._renderer;
	}

	update(
		data: PaneRendererCustomData<Time, TData>,
		options: SymbolSeriesOptions
	): void {
		this._renderer.update(data, options);
	}

	defaultOptions() {
		return defaultSymbolSeriesOptions;
	}
}
