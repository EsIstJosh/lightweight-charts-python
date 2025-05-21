import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
	CrosshairMode,
	IPrimitivePaneRenderer,
	IPrimitivePaneView,
	MouseEventParams,
	PrimitivePaneViewZOrder,
	ISeriesPrimitive,
	SeriesAttachedParameter,
	LineData,
	WhitespaceData,
	CandlestickData,
	Time,

} from 'lightweight-charts';
import { TooltipElement, TooltipOptions } from './tooltip-element';
import { positionsLine } from '../helpers/dimensions/positions';
import { convertTime, formattedDateAndTime } from '../helpers/time';
import { ISeriesApiExtended } from '../helpers/series';
class TooltipCrosshairLinePaneRenderer implements IPrimitivePaneRenderer {
	_data: TooltipCrosshairLineData;

	constructor(data: TooltipCrosshairLineData) {
		this._data = data;
	}

	draw(target: CanvasRenderingTarget2D) {
		if (!this._data.visible) return;
		target.useBitmapCoordinateSpace((scope) => {
			const ctx = scope.context;
			const crosshairPos = positionsLine(
				this._data.x,
				scope.horizontalPixelRatio,
				1
			);
			ctx.fillStyle = this._data.color; // Use the color directly from _data
			ctx.fillRect(
				crosshairPos.position,
				this._data.topMargin * scope.verticalPixelRatio,
				crosshairPos.length,
				scope.bitmapSize.height
			);
		});
	}
}


class MultiTouchCrosshairPaneView implements IPrimitivePaneView {
	_data: TooltipCrosshairLineData;
	constructor(data: TooltipCrosshairLineData) {
		this._data = data;
	}

	update(data: TooltipCrosshairLineData): void {
		this._data = data;
	}

	renderer(): IPrimitivePaneRenderer | null {
		return new TooltipCrosshairLinePaneRenderer(this._data);
	}

	zOrder(): PrimitivePaneViewZOrder {
		return 'bottom';
	}
}

interface TooltipCrosshairLineData {
	x: number;
	visible: boolean;
	color: string;
	topMargin: number;
}

const defaultOptions: TooltipPrimitiveOptions = {
	lineColor: 'rgba(0, 0, 0, 0.2)',
	priceExtractor: (data: LineData | CandlestickData | WhitespaceData) => {
		if ((data as LineData).value !== undefined) {
			return (data as LineData).value.toFixed(2);
		}
		if ((data as CandlestickData).close !== undefined) {
			return (data as CandlestickData).close.toFixed(2);
		}
		return '';
	}
};

export interface TooltipPrimitiveOptions {
	lineColor: string;
	tooltip?: Partial<TooltipOptions>;
	autoColor?: boolean
	priceExtractor: <T extends WhitespaceData>(dataPoint: T) => string;
}

export class TooltipPrimitive implements ISeriesPrimitive<Time> {
	private _options: TooltipPrimitiveOptions;
	private _tooltip: TooltipElement | undefined = undefined;
	_paneViews: MultiTouchCrosshairPaneView[];
	_data: TooltipCrosshairLineData = {
		x: 0,
		visible: false,
		color: 'rgba(0, 0, 0, 0.2)',
		topMargin: 0,
	};
	_attachedParams: SeriesAttachedParameter<Time> | undefined;
	constructor(options: Partial<TooltipPrimitiveOptions>) {
		this._options = {
			...defaultOptions,
			...options,
		};
		this._data.color =  this._options.lineColor; // Set the initial color
		this._paneViews = [new MultiTouchCrosshairPaneView(this._data)];
	}
	

	attached(param: SeriesAttachedParameter<Time>): void {
		this._attachedParams = param;
		const series = this.series();
		if (series) {
			const seriesOptions = series.options() as any;
			const lineColor = seriesOptions.lineColor || seriesOptions.color || 'rgba(0,0,0,0.2)';
	
			if (this._options.autoColor) {// Apply the extracted lineColor to the primitive
			this.applyOptions({
				lineColor,
			});
		}}
	
		this._setCrosshairMode();
		param.chart.subscribeCrosshairMove(this._moveHandler);
		this._createTooltipElement();
	}

	detached(): void {
		const chart = this.chart();
		if (chart) {
			chart.unsubscribeCrosshairMove(this._moveHandler);
		}
		this._hideCrosshair()
		this._hideTooltip()
	}
	
	
	paneViews() {
		return this._paneViews;
	}

	updateAllViews() {
        this._paneViews.forEach((pw) => pw.update(this._data));
	}

	setData(data: TooltipCrosshairLineData) {
		this._data = data;
		this.updateAllViews();
		this._attachedParams?.requestUpdate();
	}

	currentColor() {
		return this._options.lineColor;
	}

	chart() {
		return this._attachedParams?.chart;
	}

	series() {
		return this._attachedParams?.series;
	}

	applyOptions(options: Partial<TooltipPrimitiveOptions>) {
		this._options = {
			...this._options,
			...options,
		};
	
		// Update the data color to match the lineColor if provided
		if (options.lineColor) {
			this.setData({
				...this._data,
				color: options.lineColor,
			});
		}
	
		// Update the tooltip if it exists
		if (this._tooltip) {
			this._tooltip.applyOptions({
				...this._options.tooltip,
			});
		}
		this._attachedParams?.requestUpdate()
	}
	

	private _setCrosshairMode() {
		const chart = this.chart();
		if (!chart) {
			throw new Error(
				'Unable to change crosshair mode because the chart instance is undefined'
			);
		}
		chart.applyOptions({
			crosshair: {
				mode: CrosshairMode.Magnet,
				vertLine: {
					visible: false,
					labelVisible: false,
				},
				horzLine: {
					visible: false,
					labelVisible: false,
                },
			},
		});
	}

	private _moveHandler = (param: MouseEventParams) => this._onMouseMove(param);

	public switch(series: ISeriesApiExtended) {
		if (this.series() === series) {
			console.log('Tooltip is already attached to this series.');
			return;
		}
	
		this._hideCrosshair();
		series.attachPrimitive(this, 'Tooltip', true, false);
	
		const seriesOptions = series.options() as any;
		const lineColor = seriesOptions.lineColor || seriesOptions.color || 'rgba(0,0,0,0.2)';
	
		if (this._options.autoColor) {// Apply the extracted lineColor to the primitive
			this.applyOptions({
				lineColor,
			});
		}
		console.log('Switched tooltip to the new series.');
	}
 	

	private _hideCrosshair() {
		this._hideTooltip();
		this.setData({
			x: 0,
			visible: false,
			color: this._options.lineColor,
			topMargin: 0,
		});
	}

	private _hideTooltip() {
		if (!this._tooltip) return;
		this._tooltip.updateTooltipContent({
			title: '',
			price: '',
			date: '',
			time: '',
		});
		this._tooltip.updatePosition({
			paneX: 0,
			paneY: 0,
			visible: false,
		});
	}

	private _onMouseMove(param: MouseEventParams) {
		const chart = this.chart();
		const series = this.series();
		const logical = param.logical;
	
		if (!logical || !chart || !series) {
            this._hideCrosshair();
			return;
		}
	
		const data = param.seriesData.get(series);
		if (!data) {
			this._hideCrosshair();
			return;
		}
	
		const price = this._options.priceExtractor(data);
		const coordinate = chart.timeScale().logicalToCoordinate(logical);
		const [date, time] = formattedDateAndTime(param.time ? convertTime((param.time as string)) : undefined);
	
		if (this._tooltip) {
            const title = series.options()?.title || 'Unknown Series';
			const tooltipOptions = this._tooltip.options();
			const topMargin = tooltipOptions.followMode === 'top' ? tooltipOptions.topOffset + 10 : 0;
	
			this.setData({
				x: coordinate ?? 0,
				visible: coordinate !== null,
				color: this._options.lineColor,
				topMargin,
			});
	
			this._tooltip.updateTooltipContent({
                title, // Display the series title here
				price,
				date,
				time,
			});
	
			this._tooltip.updatePosition({
				paneX: param.point?.x ?? 0,
				paneY: param.point?.y ?? 0,
				visible: true,
			});
		}
	}
	

	private _createTooltipElement() {
		const chart = this.chart();
		if (!chart)
			throw new Error('Unable to create Tooltip element. Chart not attached');
		this._tooltip = new TooltipElement(chart, {
			...this._options.tooltip,
		});
	}
}
