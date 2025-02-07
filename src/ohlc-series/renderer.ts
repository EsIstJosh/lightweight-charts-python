// -------------------------------------
// Imports
// -------------------------------------

import {
	CanvasRenderingTarget2D,
	BitmapCoordinatesRenderingScope,
} from 'fancy-canvas';

import {
	ICustomSeriesPaneRenderer,
	PaneRendererCustomData,
	IRange,
	Time,
	PriceToCoordinateConverter,
} from 'lightweight-charts';

import {
	ohlcSeriesOptions,
} from './ohlc-series';

import { ohlcSeriesData, BarItem, CandleShape, parseCandleShape } from './data';

import { setOpacity } from '../helpers/colors';
import { setLineStyle } from '../helpers/canvas-rendering';
import { gridAndCrosshairMediaWidth } from '../helpers/dimensions/crosshair-width';
import { ohlcRectangle, ohlcRounded, ohlcEllipse, ohlcArrow, ohlc3d, ohlcPolygon, ohlcBar } from './shapes';

// -------------------------------------
// Constants
// -------------------------------------

/**
 * Default color for upward-moving candles.
 * Format: RGBA with 33.3% opacity.
 */

/**
 * Default color for downward-moving candles.
 * Format: RGBA with 33.3% opacity.
 */

/**
 * Default line style for candle borders.
 * 1 represents a solid line.
 */
const DEFAULT_LINE_STYLE = 1;

/**
 * Default line width for candle borders.
 * 1 pixel.
 */
const DEFAULT_LINE_WIDTH = 1;

// -------------------------------------
// BarDataAggregator Class
// -------------------------------------

/**
 * Aggregates raw bar data into grouped bar items based on specified options.
 * Handles the styling and property consolidation for candle rendering.
 */
export class BarDataAggregator {
	/**
	 * Configuration options for data aggregation and candle styling.
	 */
	private _options: ohlcSeriesOptions | null;

	/**
	 * Constructs a new BarDataAggregator instance.
	 * @param options - Aggregation and styling options. Can be null to use defaults.
	 */
	constructor(options: ohlcSeriesOptions | null) {
		this._options = options;
	}

	/**
	 * Aggregates an array of BarItem objects into grouped BarItem objects.
	 * @param data - The raw bar data to aggregate.
	 * @param priceToCoordinate - Function to convert price values to canvas coordinates.
	 * @returns An array of aggregated BarItem objects.
	 */
	public staticAggregate(
		data: BarItem[],
		priceToCoordinate: PriceToCoordinateConverter
	): BarItem[] {
		// Determine the number of bars to group based on chandelierSize.
		const groupSize = this._options?.chandelierSize ?? 1;
		const aggregatedBars: BarItem[] = [];

		// Iterate over the data in increments of groupSize to create buckets.
		for (let i = 0; i < data.length; i += groupSize) {
			const bucket = data.slice(i, i + groupSize);
			const isInProgress =
				bucket.length < groupSize && i + bucket.length === data.length;

			// Warn and skip if an empty bucket is encountered.
			if (bucket.length === 0) {
				console.warn('Empty bucket encountered during aggregation.');
				continue;
			}

			// Aggregate the current bucket into a single BarItem.
			const aggregatedBar = this._chandelier(
				bucket,
				i,
				i + bucket.length - 1,
				priceToCoordinate,
				isInProgress
			);
			aggregatedBars.push(aggregatedBar);
		}

		return aggregatedBars;
	}
	public dynamicAggregate(data: BarItem[], priceToCoordinate: PriceToCoordinateConverter): BarItem[] {
		if (
			data.length === 0 || 
			typeof this._options?.dynamicTrigger !== "function" || 
			!this._options?.dynamicCandles
		) {
			return [];
		}
	
	
	
		const aggregatedBars: BarItem[] = [];
		let currentBucket: BarItem[] = [];
	
		for (let i = 0; i < data.length; i++) {
			const bar = data[i];
	
			// Add current bar to the bucket
			currentBucket.push(bar);
	
			// **Check dynamic trigger** – if it signals a new bar, aggregate the bucket
			const dynamicTriggerActivated = this._options.dynamicTrigger().newBar  || data[i].newBar;
			if (dynamicTriggerActivated) {
				const startIndex = i - currentBucket.length + 1;
				const endIndex = i;
				
				// Aggregate the collected bucket
				const aggregatedBar = this._chandelier(
					currentBucket,
					startIndex,
					endIndex,
					priceToCoordinate,
					false
				);
				aggregatedBars.push(aggregatedBar);
				console.log(`Aggregated candle from index ${startIndex} to ${endIndex} (Trigger: ${this._options.dynamicTrigger().newBar ?? data[i].newBar})`);
	
				// Reset bucket for the next candle
				currentBucket = [];
			}
		}
	
		return aggregatedBars;
	}
	

	/**
	 * Aggregates a single bucket of BarItem objects into one consolidated BarItem.
	 * @param bucket - The group of BarItem objects to aggregate.
	 * @param startIndex - The starting index of the bucket in the original data array.
	 * @param endIndex - The ending index of the bucket in the original data array.
	 * @param priceToCoordinate - Function to convert price values to canvas coordinates.
	 * @param isInProgress - Indicates if the aggregation is currently in progress.
	 * @returns A single aggregated BarItem.
	 * @throws Will throw an error if the bucket is empty.
	 */
	private _chandelier(
		bucket: BarItem[],
		startIndex: number,
		endIndex: number,
		priceToCoordinate: PriceToCoordinateConverter,
		isInProgress = false
	): BarItem {
		if (bucket.length === 0) {
			throw new Error('Bucket cannot be empty in _chandelier method.');
		}
		// Extract open and close prices from the first and last bars in the bucket.
		const openPrice = bucket[0].originalData?.open ?? bucket[0].open ?? 0;
		const closePrice =
			bucket[bucket.length - 1].originalData?.close ??
			bucket[bucket.length - 1].close ??
			0;

		// Convert open and close prices to canvas coordinates.
		const open = priceToCoordinate(openPrice) ?? 0;
		const close = priceToCoordinate(closePrice) ?? 0;

		// Extract high and low prices from all bars in the bucket.
		const highPrices = bucket.map(
			(bar) => bar.originalData?.high ?? bar.high
		);
		const lowPrices = bucket.map((bar) => bar.originalData?.low ?? bar.low);

		// Determine the highest and lowest prices in the bucket.
		const highPrice = highPrices.length > 0 ? Math.max(...highPrices) : 0;
		const lowPrice = lowPrices.length > 0 ? Math.min(...lowPrices) : 0;

		// Convert high and low prices to canvas coordinates.
		const high = priceToCoordinate(highPrice) ?? 0;
		const low = priceToCoordinate(lowPrice) ?? 0;

		// Position of the aggregated bar on the x-axis.
		const x = bucket[0].x;

		// Determine if the aggregated bar represents an upward movement.
		const isUp = closePrice > openPrice;

		// Explicitly map colors based on `isUp` status.
		const color = isUp
			? (this._options?.upColor || 'rgba(0,255,0,0.333)')
			: (this._options?.downColor || 'rgba(255,0,0,0.333)');

		const borderColor = isUp
			? (this._options?.borderUpColor || setOpacity(color, 1))
			: (this._options?.borderDownColor || setOpacity(color, 1));

		const wickColor = isUp
			? (this._options?.wickUpColor || borderColor)
			: (this._options?.wickDownColor || borderColor);


		// Aggregate lineStyle similarly to other properties.
		const lineStyle = bucket.reduce<number>(
			(style, bar) => bar.lineStyle ?? bar.originalData?.lineStyle ?? style,
			this._options?.lineStyle ?? DEFAULT_LINE_STYLE
		);

		// Aggregate lineWidth similarly to other properties.
		const lineWidth = bucket.reduce<number>(
			(currentWidth, bar) =>
				bar.lineWidth ?? bar.originalData?.lineWidth ?? currentWidth,
			this._options?.lineWidth ?? DEFAULT_LINE_WIDTH
		);
		// Aggregate shape similarly to other properties.
		const shape = bucket.reduce<CandleShape>(
			(currentShape, bar) => {
				const parsedShape = bar.shape
					? parseCandleShape(bar.shape)
					: bar.originalData?.shape
					? parseCandleShape(bar.originalData.shape)
					: undefined;

				// If parsing fails, retain the current shape.
				return parsedShape ?? currentShape;
			},
			this._options?.shape ?? CandleShape.Rectangle
		);
		const volume  = bucket.reduce<number>(
			(sum, bar) => sum + (bar.originalData?.volume ?? bar.volume ?? 0),
			0
		  );
		// Ensure that `shape` is never undefined. If it is, default to Rectangle.
		const finalShape = shape || CandleShape.Rectangle;
		// Return the aggregated BarItem with all consolidated properties.
		return {
			open,
			high,
			low,
			close,
			volume,
			x,
			isUp,
			startIndex,
			endIndex,
			isInProgress,
			color,
			borderColor,
			wickColor,
			shape: finalShape,
			lineStyle,
			lineWidth,
		};
	}




}

// -------------------------------------
// ohlcSeriesRenderer Class
// -------------------------------------

/**
 * Custom renderer for candle series, implementing various candle shapes and styles.
 * Utilizes BarDataAggregator for data aggregation and rendering logic for different candle shapes.
 * @template TData - The type of custom candle series data.
 */
export class ohlcSeriesRenderer<
	TData extends ohlcSeriesData
> implements ICustomSeriesPaneRenderer {
	/**
	 * The current data to be rendered.
	 */
	private _data: PaneRendererCustomData<Time, TData> | null = null;

	/**
	 * The current rendering options.
	 */
	private _options: ohlcSeriesOptions | null = null;

	/**
	 * The data aggregator instance.
	 */
	private _aggregator: BarDataAggregator | null = null;

	/**
	 * Draws the candle series onto the provided canvas target.
	 * @param target - The canvas rendering target.
	 * @param priceConverter - Function to convert price values to canvas coordinates.
	 */
	draw(
		target: CanvasRenderingTarget2D,
		priceConverter: PriceToCoordinateConverter
	): void {
		target.useBitmapCoordinateSpace((scope) =>
			this._drawImpl(scope, priceConverter)
		);
	}

	/**
	 * Updates the renderer with new data and options.
	 * @param data - The custom series data to render.
	 * @param options - The custom series options for styling and behavior.
	 */
	update(
		data: PaneRendererCustomData<Time, TData>,
		options: ohlcSeriesOptions
	): void {
		this._data = data;
		this._options = options;
		this._aggregator = new BarDataAggregator(options);
	}

	/**
	 * Internal implementation of the drawing logic.
	 * Processes data, aggregates bars, and delegates drawing to specific methods.
	 * @param renderingScope - The rendering scope containing canvas context and scaling information.
	 * @param priceToCoordinate - Function to convert price values to canvas coordinates.
	 */
	private _drawImpl(
		renderingScope: BitmapCoordinatesRenderingScope,
		priceToCoordinate: PriceToCoordinateConverter
	): void {
		// Exit early if there's no data or options to render.
		if (
			!this._data ||
			this._data.bars.length === 0 ||
			!this._data.visibleRange ||
			!this._options
		) {
			return;
		}

		// Transform raw data into BarItem objects with initial styling.
		const bars: BarItem[] = this._data.bars.map((bar, index) => ({
			open: bar.originalData?.open ?? 0,
			high: bar.originalData?.high ?? 0,
			low: bar.originalData?.low ?? 0,
			close: bar.originalData?.close ?? 0,
			volume: bar.originalData?.volume??0,
			x: bar.x,
			shape:
				(bar.originalData?.shape ??
					this._options?.shape ??
					'Rectangle') as CandleShape,
			lineStyle:
				bar.originalData?.lineStyle ??
				this._options?.lineStyle ??
				1,
			lineWidth:
				bar.originalData?.lineWidth ??
				this._options?.lineWidth ??
				1,
			isUp:
				(bar.originalData?.close ?? 0) >=
				(bar.originalData?.open ?? 0),
			color: this._options?.color ?? 'rgba(0,0,0,0)',
			borderColor: this._options?.borderColor ?? 'rgba(0,0,0,0)',
			wickColor: this._options?.wickColor ?? 'rgba(0,0,0,0)',
			startIndex: index,
			endIndex: index,
		}));

		let aggregatedBars
		// If volume candles are enabled and both volumeMALength and volumeMultiplier are defined, use aggregateByVolume.
		if (
			this._options.dynamicCandles &&
			typeof this._options.volumeMALength === "number" &&
			typeof this._options.volumeMultiplier === "number"
		) {
			aggregatedBars =
			this._aggregator?.dynamicAggregate(bars, priceToCoordinate) ?? [];
		} else {
			// Otherwise, use the standard aggregation method.
			aggregatedBars = this._aggregator?.staticAggregate(bars, priceToCoordinate) ?? [];
		}
  
		// Determine the radius for rounded shapes and candle width based on scaling.
		const radius = this._options.radius;
		const { horizontalPixelRatio, verticalPixelRatio } = renderingScope;
		const candleWidth = this._data.barSpacing * horizontalPixelRatio;

		// Delegate drawing of candle bodies and wicks.
		this._drawCandles(
			renderingScope,
			aggregatedBars,
			this._data.visibleRange,
			radius,
			candleWidth,
			horizontalPixelRatio,
			verticalPixelRatio
		);
		this._drawWicks(
			renderingScope,
			aggregatedBars,
			this._data.visibleRange
		);
	}

	/**
	 * Draws the wicks (high-low lines) for each aggregated candle.
	 * Skips rendering if the candle shape is '3d'.
	 * @param renderingScope - The rendering scope containing canvas context and scaling information.
	 * @param bars - Array of aggregated BarItem objects to draw wicks for.
	 * @param visibleRange - The range of visible bars to render.
	 */
	private _drawWicks(
		renderingScope: BitmapCoordinatesRenderingScope,
		bars: readonly BarItem[],
		visibleRange: IRange<number>
	): void {
		// Exit early if there's no data or options.
		if (this._data === null || this._options === null) {
			return;
		}

		// Skip wick drawing if the candle shape is '3d'.
		if (this._options.shape === '3d') {
			return;
		}

		const { context: ctx, horizontalPixelRatio, verticalPixelRatio } =
			renderingScope;
		const candleWidth = this._data.barSpacing * horizontalPixelRatio;
		const wickWidth = gridAndCrosshairMediaWidth(horizontalPixelRatio);

		// Iterate over each aggregated bar to draw its wicks.
		for (const bar of bars) {
			// Skip bars outside the visible range.
			if (
				bar.startIndex < visibleRange.from ||
				bar.endIndex > visibleRange.to
			) {
				continue;
			}

			// Calculate pixel positions for high, low, open, and close.
			const low = bar.low * verticalPixelRatio;
			const high = bar.high * verticalPixelRatio;
			const openCloseTop = Math.min(bar.open, bar.close) * verticalPixelRatio;
			const openCloseBottom =
				Math.max(bar.open, bar.close) * verticalPixelRatio;

			// Determine the X position for the wick.
			let wickX = bar.x * horizontalPixelRatio;
			const groupSize = bar.endIndex - bar.startIndex;
			if (groupSize && groupSize > 1) {
				wickX += candleWidth * Math.max(1, groupSize) / 2;
			}

			// Adjust wick heights for 'Polygon' shape candles.
			let upperWickTop = high;
			let upperWickBottom = openCloseTop;
			let lowerWickTop = openCloseBottom;
			let lowerWickBottom = low;

			if (this._options.shape === 'Polygon') {
				// For 'Polygon' candles, set halfway points.
				upperWickBottom = (high + openCloseTop) / 2;
				lowerWickTop = (low + openCloseBottom) / 2;
			}

			// Set fill and stroke styles for the wick.
			ctx.fillStyle = bar.color;
			ctx.strokeStyle = bar.wickColor ?? bar.color;

			/**
			 * Draws a rounded rectangle or a standard rectangle as a wick.
			 * @param x - The X-coordinate of the top-left corner.
			 * @param y - The Y-coordinate of the top-left corner.
			 * @param width - The width of the rectangle.
			 * @param height - The height of the rectangle.
			 * @param radius - The corner radius for rounded rectangles.
			 */
			const drawRoundedRect = (
				x: number,
				y: number,
				width: number,
				height: number,
				radius: number
			) => {
				if (ctx.roundRect) {
					ctx.roundRect(x, y, width, height, radius);
				} else {
					ctx.rect(x, y, width, height);
				}
			};

			// Draw the upper wick.
			const upperWickHeight = upperWickBottom - upperWickTop;
			if (upperWickHeight > 0) {
				ctx.beginPath();
				drawRoundedRect(
					wickX - Math.floor(wickWidth / 2),
					upperWickTop,
					wickWidth,
					upperWickHeight,
					wickWidth / 2 // Radius for rounded corners.
				);
				ctx.fill();
				ctx.stroke();
			}

			// Draw the lower wick.
			const lowerWickHeight = lowerWickBottom - lowerWickTop;
			if (lowerWickHeight > 0) {
				ctx.beginPath();
				drawRoundedRect(
					wickX - Math.floor(wickWidth / 2),
					lowerWickTop,
					wickWidth,
					lowerWickHeight,
					wickWidth / 2 // Radius for rounded corners.
				);
				ctx.fill();
				ctx.stroke();
			}
		}
	}

	/**
	 * Draws the candle bodies based on their specified shapes.
	 * Supports multiple shapes like Rectangle, Rounded, Ellipse, Arrow, 3D, and Polygon.
	 * @param renderingScope - The rendering scope containing canvas context and scaling information.
	 * @param bars - Array of aggregated BarItem objects to draw candles for.
	 * @param visibleRange - The range of visible bars to render.
	 * @param radius - The radius for rounded candle shapes.
	 * @param candleWidth - The width of the candle in pixels.
	 * @param horizontalPixelRatio - Scaling factor for horizontal dimensions.
	 * @param verticalPixelRatio - Scaling factor for vertical dimensions.
	 */
	private _drawCandles(
		renderingScope: BitmapCoordinatesRenderingScope,
		bars: readonly BarItem[],
		visibleRange: IRange<number>,
		radius: number,
		candleWidth: number,
		horizontalPixelRatio: number,
		verticalPixelRatio: number
	): void {
		const { context: ctx } = renderingScope;
		const barSpace = this._options?.barSpacing ?? 0.8;

		// Save the current canvas state before drawing.
		ctx.save();

		// Iterate over each aggregated bar to draw its body.
		for (const bar of bars) {
			const groupSize = bar.endIndex - bar.startIndex;

			// Calculate the horizontal span of the candle based on grouping.
			const barHorizontalSpan =
				this._options?.chandelierSize !== 1
					? candleWidth * Math.max(1, groupSize + 1) -
					  (1 - barSpace) * candleWidth
					: candleWidth * barSpace;

			// Determine the X position for the candle.
			const barHorizontalPos = bar.x * horizontalPixelRatio;

			// Calculate the actual width of the candle body.
			const candleBodyWidth = candleWidth * barSpace;

			// Skip rendering if the bar is outside the visible range.
			if (
				bar.startIndex < visibleRange.from ||
				bar.endIndex > visibleRange.to
			) {
				continue;
			}

			// Calculate vertical positions for the candle body.
			const barVerticalMax = Math.min(bar.open, bar.close) * verticalPixelRatio;
			const barVerticalMin = Math.max(bar.open, bar.close) * verticalPixelRatio;
			const barVerticalSpan = barVerticalMax - barVerticalMin;
			const barY = (barVerticalMax + barVerticalMin) / 2;

			// Precompute common X coordinates for drawing.
			const leftSide = barHorizontalPos - candleBodyWidth / 2;
			const rightSide = leftSide + barHorizontalSpan;
			const middle = leftSide + barHorizontalSpan / 2;

			// Set fill and stroke styles from bar properties.
			ctx.fillStyle =
				bar.color ?? this._options?.color ?? 'rgba(255,255,255,1)';
			ctx.strokeStyle =
				bar.borderColor ??
				this._options?.borderColor ??
				bar.color ??
				'rgba(255,255,255,1)';
			setLineStyle(ctx, bar.lineStyle);
			ctx.lineWidth = bar.lineWidth ?? DEFAULT_LINE_WIDTH;

			// Draw the candle based on its specified shape.
			switch (bar.shape) {
				case 'Rectangle':
        ohlcRectangle(
          ctx,
          leftSide,
          rightSide,
          barY,
          barVerticalSpan
        );
					break;

				case 'Rounded':
        ohlcRounded(
						ctx,
						leftSide,
						rightSide,
						barY,
						barVerticalSpan,
						radius
					);
					break;

				case 'Ellipse':
        ohlcEllipse(
						ctx,
						leftSide,
						rightSide,
						middle,
						barY,
          barVerticalSpan
					);
					break;

				case 'Arrow':
        ohlcArrow(
						ctx,
						leftSide,
						rightSide,
						middle,
						barY,
						barVerticalSpan,
						bar.high * verticalPixelRatio,
						bar.low * verticalPixelRatio,
						bar.isUp
					);
					break;

				case '3d':
        ohlc3d(
						ctx,
						barHorizontalPos,
						bar.high * verticalPixelRatio,
						bar.low * verticalPixelRatio,
						bar.open * verticalPixelRatio,
						bar.close * verticalPixelRatio,
						candleBodyWidth,
						barHorizontalSpan,
						bar.color ?? this._options?.color ?? 'rgba(255,255,255,1)',
						bar.borderColor ?? this._options?.borderColor ?? 'rgba(255,255,255,1)',
						bar.isUp,
						barSpace
						);
					break;

				case 'Polygon':
        ohlcPolygon(
						ctx,
						leftSide,
						rightSide,
						barY,
						barVerticalSpan,
						bar.high * verticalPixelRatio,
						bar.low * verticalPixelRatio,
						bar.isUp
					);
					break;
				case "Bar":
		ohlcBar(ctx, leftSide, rightSide, bar.high * verticalPixelRatio ,bar.low * verticalPixelRatio ,bar.open * verticalPixelRatio ,bar.close * verticalPixelRatio);
				break;  
				default:
					// Fallback to rectangle shape if unknown shape is specified.
					ohlcRectangle(ctx, leftSide, rightSide, barY, barVerticalSpan);
					break;
			}
		}

		// Restore the canvas state after drawing.
		ctx.restore();
	}
}
