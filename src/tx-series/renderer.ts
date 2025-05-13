import {
	BitmapCoordinatesRenderingScope,
	CanvasRenderingTarget2D,
} from 'fancy-canvas';
import { isOHLCData, isSingleValueData } from '../helpers/typeguards';
import {
	customSeriesDefaultOptions,
	CustomSeriesOptions,
	CustomSeriesPricePlotValues,
	ICustomSeriesPaneView,
	WhitespaceData,
	ICustomSeriesPaneRenderer,
	PaneRendererCustomData,
	PriceToCoordinateConverter,
	Time,
	LineStyle,
	LineWidth,
	ISeriesApi,
	SeriesType,
	Coordinate,
} from 'lightweight-charts';
import { setLineStyle } from '../helpers/canvas-rendering';
import { scaleAlpha } from '../helpers/colors';
import { ClosestTimeIndexFinder } from '../helpers/closest-index';

export interface TradeData {
	time: Time;      
	entry?: number;       
	stop?: number;        
	target?: number;      
	displayInfo?: string;

	action?: 'increase' | 'decrease' | 'close' | 'entry';
	amount?: number; // Relative or absolute depending on mode

	lineWidth?: number;
}


export interface TradeSeriesOptions extends CustomSeriesOptions {
	side?: 'long' | 'short';
	mode?: 'relative' | 'absolute'; 
	baseSeries?: ISeriesApi<SeriesType>; 
	auto?: boolean;
	entryColor: string;
	stopColor: string;
	targetColor: string;
	backgroundColorStop: string;
	backgroundColorTarget: string;
	lineWidth: number;
	lineStyle: number; // 0 = Solid, 1 = Dotted, 2 = Dashed, etc.
	partialClosureLineColor: string;
	partialClosureLineWidth: number;
	partialClosureLineDash: number[];
	infoTextColor: string;
	infoFont: string;
	positionChangeColor: string;
}
export const tradeDefaultOptions: TradeSeriesOptions = {
	...customSeriesDefaultOptions,
	side: 'long',
	mode: 'relative', 
	auto: false,
	entryColor: '#FFFF00',
	stopColor: '#FF0000',
	targetColor: '#00FF00',
	backgroundColorStop: 'rgba(255,0,0,0.25)',
	backgroundColorTarget: 'rgba(0,255,0,0.25)',
	lineWidth: 1 as LineWidth,
	lineStyle: 3 as LineStyle, // Default to solid
	partialClosureLineColor: '#FFFFFF',
	partialClosureLineWidth: 1,
	partialClosureLineDash: [4, 2],
	infoTextColor: '#FFFFFF',
	infoFont: '12px Arial',
	positionChangeColor: '#FFFFFF'
};


export class TradeSeries<TData extends TradeData> implements ICustomSeriesPaneView<Time, TData, TradeSeriesOptions> {
    private _renderer: TradeSeriesRenderer;
    constructor() {
        this._renderer = new TradeSeriesRenderer();
    }

    priceValueBuilder(plotRow: TradeData): CustomSeriesPricePlotValues {
        const high = Math.max(plotRow.entry ?? NaN, plotRow.stop ?? NaN, plotRow.target ?? NaN);
        const low = Math.min(plotRow.entry ?? NaN, plotRow.stop ?? NaN, plotRow.target ?? NaN);
        const close = plotRow.entry ?? NaN;
        return [high, low, close];
    }

    renderer(): TradeSeriesRenderer {
        return this._renderer;
    }

    isWhitespace(data: TradeData | WhitespaceData): data is WhitespaceData {
        return (data as Partial<TradeData>).entry === undefined;
    }

    update(
        data: PaneRendererCustomData<Time, TradeData>,
        options: TradeSeriesOptions
    ): void {
        this._renderer.update(data, options);
    }

    defaultOptions() {
        return tradeDefaultOptions;
    }
}
// -------------------------------------
// Imports
// -------------------------------------

// -------------------------------------
// TradeDataAggregator Class
// -------------------------------------

// -------------------------------------
// TradeDataAggregator Class
// -------------------------------------

export class TradeDataAggregator {
    private _options: TradeSeriesOptions | null;

    constructor(options: TradeSeriesOptions | null) {
        this._options = options;
    }

    public aggregate(
        data: TradeData[],
        priceToCoordinate: PriceToCoordinateConverter
    ): Array<{
        entry: number;
        stop: number;
        target: number;
        startIndex: number;
        endIndex: number;
        isInProgress: boolean;
        displayInfo?: string | undefined;
    }> {
        const aggregatedTrades: Array<{
            entry: number;
            stop: number;
            target: number;
            startIndex: number;
            endIndex: number;
            isInProgress: boolean;
            displayInfo?: string;
        }> = [];
        let i = 0;

        while (i < data.length) {
            const trade = data[i];
            if (trade.action === 'increase' || trade.action === 'entry') {
                const startIndex = i;
            
                // Instead of:
                // const endIndex = this._findEndIndex(data, startIndex);
            
                // Use the cross-based logic:
                const endIndex = this._findEndIndexByCross(data, startIndex);
            
                // If no exit is found, trade is in progress
                const isInProgress = endIndex === null;
            
                const aggregatedTrade = this._aggregateSegment(
                    data.slice(startIndex, (endIndex ?? data.length - 1) + 1),
                    startIndex,
                    endIndex ?? data.length - 1,
                    priceToCoordinate,
                    isInProgress
                );
            

            

                // Include displayInfo if available in the first trade of the segment
                if (data[startIndex].displayInfo) {
                    aggregatedTrade.displayInfo = data[startIndex].displayInfo;
                }

                aggregatedTrades.push(aggregatedTrade);

                // Find the next trade's start index
                const nextStartIndex = this._findStartIndex(data, endIndex ?? data.length - 1);
                if (nextStartIndex !== null && nextStartIndex > i) {
                    i = nextStartIndex;
                } else {
                    // Move to the next index if no new trade is found
                    i = (endIndex ?? data.length - 1) + 1;
                }
            } else {
                // Move to the next trade if no 'increase' or 'entry' is encountered
                i++;
            }
        }

        return aggregatedTrades;
    }

    private _aggregateSegment(
        segment: TradeData[],
        startIndex: number,
        endIndex: number,
        priceToCoordinate: PriceToCoordinateConverter,
        isInProgress: boolean
    ): {
        entry: number;
        stop: number;
        target: number;
        startIndex: number;
        endIndex: number;
        isInProgress: boolean;
        displayInfo?: string | undefined;
    } {
        if (segment.length === 0) {
            throw new Error('Segment cannot be empty in _aggregateSegment method.');
        }

        // Extract the entry, stop, and target values from the segment
        const entry = segment[0].entry ?? NaN;
        const stop = segment.reduce(
            (maxStop, trade) => Math.max(maxStop, trade.stop ?? 0),
            0
        );
        const target = segment.reduce(
            (minTarget, trade) => Math.min(minTarget, trade.target ?? Infinity),
            Infinity
        );

        return {
            entry: entry,    // Raw price value
            stop: stop,      // Raw price value
            target: target,  // Raw price value
            startIndex,
            endIndex,
            isInProgress,
            displayInfo: segment[0].displayInfo ?? undefined
        };
    }

    /**
     * Finds the index of the first 'close' action after the given startIndex.
     * @param data - Array of TradeData objects.
     * @param startIndex - The index to start searching from.
     * @returns The index of the 'close' action or null if not found.
     */
    private _findEndIndex(
        data: TradeData[],
        startIndex: number
    ): number | null {
        for (let i = startIndex + 1; i < data.length; i++) {
            if (data[i].action === 'close') { 
                return i; // Found the closing action
            }
        }

        return null; // Trade is still open/in progress
    }

    /**
     * Finds the index of the next trade 'entry' or 'increase' action after the given prevEndIndex.
     * @param data - Array of TradeData objects.
     * @param prevEndIndex - The index of the previous trade's end.
     * @returns The index of the next 'entry' or 'increase' action or null if not found.
     */
    private _findStartIndex(
        data: TradeData[],
        prevEndIndex: number
    ): number | null {
        for (let i = prevEndIndex + 1; i < data.length; i++) {
            const currentAction = data[i].action;

            if (currentAction === 'entry') {
                return i;
            }

            if (currentAction === 'increase') {
                // Determine if this 'increase' signifies a new trade
                const isNewTrade = this._isNewTrade(data, i);
                if (isNewTrade) {
                    return i;
                }
            }

            // Additional logic can be added here for other actions if necessary
        }

        return null; // No new trade actions found
    }

    /**
     * Determines whether an 'increase' action at a given index signifies a new trade.
     * This method can be expanded based on more complex trade rules.
     * @param data - Array of TradeData objects.
     * @param index - The current index to evaluate.
     * @returns True if it's a new trade; otherwise, false.
     */
    private _isNewTrade(data: TradeData[], index: number): boolean {
        // Implement logic to determine if the 'increase' is part of a new trade
        // For simplicity, assume it's a new trade if the previous action was 'close' or undefined
        if (index === 0) return true; // First action is 'increase' => new trade

        const previousAction = data[index - 1].action;
        return previousAction === 'close' || previousAction === undefined;
    }


    private _findEndIndexByCross(
        data: TradeData[],
        startIndex: number
    ): number | null {
        const baseBars = this._options?.baseSeries?.data() ?? [];
        if (!baseBars.length) return null;
    
        const trade = data[startIndex];
        const stop    = trade.stop;
        const target  = trade.target;
        if (stop == null && target == null) return null;
    
        // 1) We get the side. If each trade has a side, use `trade.side`; 
        //    otherwise, use `this._options?.side` as fallback
        const side = (this._options?.side ?? 'long') as 'long' | 'short';
    
        // 2) Match the trade’s start time -> baseBars index
        const baseStartIndex = baseBars.findIndex((bar) => bar.time >= trade.time);
        if (baseStartIndex < 0) return null;
    
        // 3) Loop forward in the base series data
        for (let i = baseStartIndex; i < baseBars.length; i++) {
        const bar = baseBars[i];
    
        // If it's an OHLC bar, decide how you read the price
        // Usually you'd use `bar.close`, or if it's single-value => `bar.value`
        const barPrice =
            'close' in bar ? bar.close :
            'value' in bar ? bar.value :
            undefined;
        if (barPrice == null) continue;
    
        // 4) Different crossing logic for 'long' vs. 'short'
        if (side === 'long') {
            // For a long trade: if barPrice >= target => take profit. if barPrice <= stop => stop out.
            if (target != null && barPrice >= target) {
            return i; // exit index
            }
            if (stop != null && barPrice <= stop) {
            return i; 
            }
        } else {
            // For a short trade: if barPrice <= target => take profit. if barPrice >= stop => stop out.
            if (target != null && barPrice <= target) {
            return i;
            }
            if (stop != null && barPrice >= stop) {
            return i;
            }
        }
        }
    
        // If we reach here => never crossed target or stop => trade is open
        return null;
    }
    }


// -------------------------------------
// TradeSeriesRenderer Class
// -------------------------------------

/**
 * Custom renderer for trade series, utilizing TradeDataAggregator for data aggregation.
 */
// -------------------------------------
// TradeSeriesRenderer Class
// -------------------------------------

export class TradeSeriesRenderer implements ICustomSeriesPaneRenderer {
    private _data: PaneRendererCustomData<Time, TradeData> | null = null;
    private _options: TradeSeriesOptions | null = null;
    private _aggregator: TradeDataAggregator | null = null;

    /**
     * Updates the renderer with new data and options.
     * @param data - The custom series data to render.
     * @param options - The custom series options for styling and behavior.
     */
    update(
        data: PaneRendererCustomData<Time, TradeData>,
        options: TradeSeriesOptions
    ): void {
        this._data = data;
        this._options = options;
        this._aggregator = new TradeDataAggregator(options);
    }

    /**
     * Draws the trade series onto the provided canvas target.
     * @param target - The canvas rendering target.
     * @param priceConverter - Function to convert price values to canvas coordinates.
     */
    draw(
        target: CanvasRenderingTarget2D,
        priceConverter: PriceToCoordinateConverter
    ): void {
        if (!this._data || !this._data.bars.length || !this._data.visibleRange || !this._aggregator) {
            return;
        }

        target.useBitmapCoordinateSpace((scope) => this._drawImpl(scope, priceConverter));
    }

    /**
     * Internal implementation of the drawing logic.
     * Aggregates trade data and renders the aggregated trades.
     * @param renderingScope - The rendering scope containing canvas context and scaling information.
     * @param priceToCoordinate - Function to convert price values to canvas coordinates.
     */
    private _drawImpl(
        renderingScope: BitmapCoordinatesRenderingScope,
        priceToCoordinate: PriceToCoordinateConverter
    ): void {
    if (!this._data || !this._options || !this._aggregator || !this._data.visibleRange) {
            return;
        }

        const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;
        const { from, to } = this._data.visibleRange;
        const bars = this._data.bars;
    const aggregatedTrades = this._aggregator.aggregate(
        bars.map(b => b.originalData).filter(Boolean) as TradeData[],
        priceToCoordinate
    );

        ctx.save();

    aggregatedTrades.forEach(trade => {
        // If outside visible bar index range, skip
            if (trade.endIndex < from || trade.startIndex > to) {
                return;
            }

        // Convert bar indices to real chart X
        const xStart = bars[trade.startIndex].x * horizontalPixelRatio;
        const xEnd   = bars[trade.endIndex].x   * horizontalPixelRatio;

        // Convert prices to Y
        const yEntry  = (priceToCoordinate(trade.entry)  ?? 0) * verticalPixelRatio;
        const yStop   = (priceToCoordinate(trade.stop)   ?? 0) * verticalPixelRatio;
        const yTarget = (priceToCoordinate(trade.target) ?? 0) * verticalPixelRatio;

        // Now xStart/xEnd are correct chart coordinates, so the shape will 
        // move horizontally as the user pans or zooms the chart.
        this._fillArea(ctx, xStart, xEnd, yEntry, yStop,   this._options?.backgroundColorStop ?? 'rgba(255,0,0,0.25)');
        this._fillArea(ctx, xStart, xEnd, yEntry, yTarget, this._options?.backgroundColorTarget ?? 'rgba(0,255,0,0.25)');

        // ...etc. Additional drawing code remains the same...
        });

        ctx.restore();
    }

    /**
     * Calculates the current position size for a specific trade.
     * @param trade - The aggregated trade data.
     * @param mode - Whether the position adjustments are relative or absolute.
     * @param tradeDataArray - Array of all trade data.
     * @returns The final position size for the trade.
     */
    private _calculatePosition(
        trade: {
            entry: number;
            stop: number;
            target: number;
            startIndex: number;
            endIndex: number;
            isInProgress: boolean;
            displayInfo?: string;
        },
        mode: 'relative' | 'absolute',
        tradeDataArray: TradeData[]
    ): number {
        let position = 0; // Initial position
        let initialPosition: number | null = null;

        // Iterate over the trade's data between startIndex and endIndex
        for (let i = trade.startIndex; i <= trade.endIndex && i < tradeDataArray.length; i++) {
            const barData = tradeDataArray[i];

            if (barData.action === 'increase') {
                position = mode === 'relative'
                    ? position + position * (barData.amount ?? 1)
                    : position + (barData.amount ?? 1);

                if (initialPosition === null) {
                    initialPosition = position;
                }
            } else if (barData.action === 'decrease') {
                position = mode === 'relative'
                    ? position - position * (barData.amount ?? 1)
                    : position - (barData.amount ?? 1);
            } else if (barData.action === 'close') {
                position = 0; // Reset position on close
            }
        }

        console.log(`Trade from index ${trade.startIndex} to ${trade.endIndex}: Initial Position: ${initialPosition}, Final Position: ${position}`);
        return position;
    }

    /**
     * Fills an area between two Y coordinates over a range of X coordinates.
     * @param ctx - The canvas rendering context.
     * @param xStart - Starting X coordinate.
     * @param xEnd - Ending X coordinate.
     * @param y1 - First Y coordinate.
     * @param y2 - Second Y coordinate.
     * @param fillColor - Color to fill the area.
     */
    private _fillArea(
        ctx: CanvasRenderingContext2D,
        xStart: number,
        xEnd: number,
        y1: number,
        y2: number,
        fillColor: string
    ): void {
        const topY = Math.min(y1, y2);
        const bottomY = Math.max(y1, y2);

        const gradient = ctx.createLinearGradient(0, topY, 0, bottomY);
        const entryAtTop = (y1 === topY);

        if (entryAtTop) {
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, fillColor);
        } else {
            gradient.addColorStop(0, fillColor);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.rect(xStart, topY, xEnd - xStart, bottomY - topY);
        ctx.fill();
    }

 
private _findEndIndexByCross(
  tradeData: TradeData[],
  startIndex: number
): number | null {
  const baseBars = this._options?.baseSeries?.data() ?? [];
  if (!baseBars.length) return null;

  const trade = tradeData[startIndex];
  const stop    = trade.stop;
  const target  = trade.target;

  if (stop == null && target == null) return null;

  // Step 1: find base bar index by time
  const baseIndex = baseBars.findIndex((bar) => bar.time >= trade.time);
  if (baseIndex < 0) return null;

  // Step 2: loop from baseIndex forward
  for (let i = baseIndex; i < baseBars.length; i++) {
    const bar = baseBars[i];
    let barPrice = 'close' in bar ? bar.close : ('value' in bar ? bar.value : undefined);
    if (barPrice == null) continue;

    // target hit
    if (target != null && barPrice >= target) {
      return i; // we define 'endIndex' in terms of baseBars indices
    }

    // stop hit
    if (stop != null && barPrice <= stop) {
      return i;
    }
  }

  return null; // never crossed => in progress
}

}