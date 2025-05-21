import { Time, ISeriesApi, SeriesType } from "lightweight-charts";
import { DrawingOptions } from "../drawing/options";
import { Handler } from "../general";
import { setOpacity } from "../helpers/colors";
import { ISeriesApiExtended } from "../helpers/series";
import { CandleShape, parseCandleShape } from "../ohlc-series/data";
import { Point as LogicalPoint } from '../drawing/data-source';
import { isISeriesApi } from "../helpers/typeguards";

export interface Scale {
    x: number;
    y: number;
}
export interface Shift {
    x: number;
    y: number;
}
export interface Spatial {
    scale: Scale;
    shift: Shift;
}

export interface OriginalData {
    x?: number
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    value?: number;
    volume?: number 
    lineStyle?: number;
    lineWidth?: number;
    shape?: CandleShape;
    color?: string;
    borderColor?: string;
    wickColor?: string;
    isUp?: boolean;
}

export interface DataPoint {
    x1: number;
    x2: number;
    time?: Time;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    value?: number;
    volume?:number; 
    isUp?: boolean;
    isInProgress?: boolean;
    originalData?: OriginalData;
    barSpacing?: number;
    lineStyle?: number;
    lineWidth?: number;
    shape?: CandleShape;
    color?: string;
    borderColor?: string;
    wickColor?: string;
}

export interface SequenceOptions extends DrawingOptions {
    visible: boolean,
    autoScale:boolean
    xScaleLock?:boolean,
    yScaleLock?:boolean,
    color?: string;
    lineWidth?: number;
    upColor?: string;
    downColor?: string;
    wickVisible?: boolean;
    borderVisible?: boolean;
    borderColor?: string;
    borderUpColor?: string;
    borderDownColor?: string;
    wickColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
    radius?: number;
    shape?: CandleShape;
    chandelierSize?: number;
    barSpacing?: number;
    lineStyle: number;
    lineColor: string;
    width: number;
}
export const defaultSequenceOptions: SequenceOptions = {
    visible: true,
    autoScale: false,
    xScaleLock:false,
    yScaleLock:false,
    color: '#737375',
    lineWidth: 1.5,
    upColor: 'rgba(0,255,0,.25)',
    downColor: 'rgba(255,0,0,.25)',
    wickVisible: true,
    borderVisible: true,
    borderColor: '#737375',
    borderUpColor: '#1c9d1c',
    borderDownColor: '#d5160c',
    wickColor: '#737375',
    wickUpColor: '#1c9d1c',
    wickDownColor: '#d5160c',
    radius: 100,
    shape: 'Rounded' as CandleShape,
    chandelierSize: 1,
    barSpacing: 0.7,
    lineStyle: 0,
    lineColor: '#ffffff',
    width: 1,
};


/* ============================================================================
  HELPER CLASS: Sequence
============================================================================ */
/**
 * The Sequence class now slices the data ONLY ONCE in the constructor
 * (using _originalP1, _originalP2). Then it applies scale/shift to that
 * already-sliced data whenever p1 or p2 changes.
 */
export class Sequence {
    public get data(): DataPoint[] {
        return this.convertAndAggregateDataPoints();
    }
    public get sourceData(): DataPoint[] {
        return this._originalData;
    }
    public _originalP1: LogicalPoint;
    public _originalP2: LogicalPoint;
    public _barWidth: number = 0.8;
    public p1: LogicalPoint;
    public p2: LogicalPoint;
    public _options: SequenceOptions;
    private series: ISeriesApi<SeriesType>;
    private _originalData: DataPoint[] = [];
    private _originalSlice: DataPoint[] = [];
    public offset: number;
    /**
     * This array holds only the slice from _originalP1 to _originalP2,
     * so we never repeatedly slice the entire series data again.
     */

    public onComplete?: () => void;

    public get spatial(): Spatial {
        return this.recalculateSpatial();
    } 
    public transform: Spatial =  {
        scale: { x: 1, y: 1 },
        shift: { x: 0, y: 0 }
    };
    constructor(
        public handler: Handler,
        series: ISeriesApiExtended|Sequence,
        p1: LogicalPoint,
        p2: LogicalPoint,
        options: SequenceOptions,
        pOffset?: number
    ) {
        this._options = { ...options, ...defaultSequenceOptions };
        let left: LogicalPoint, right:LogicalPoint
        if (Math.min(p1.logical,p2.logical) === p1.logical){
            left = p1
            right = p2

        }else {
            left = p2
            right = p1
        } 
    
        this._originalP1 = { ...left }; 
        this._originalP2 = { ...right };
        this.offset = pOffset??0
        this.p1 = p1;
        this.p2 = p2;

        if (isISeriesApi(series)) {
        this.series = series 
        this._originalData = this.series.data().map((data, index) => ({
            ...data,
            x1: index,
            x2: index+1
        }))
        } else {
            this.series =  this.handler.series || this.handler._seriesList[0];
            this._originalData = series._originalData 
        }

 
        /**
         * We find the min and max of the original points' logical indexes
         * and slice the data range. We store that in _originalData so subsequent
         * calls only transform, not re-slice.
         */
        const x1 = Math.min(this._originalP1.logical, this._originalP2.logical);
        const x2 = Math.max(this._originalP1.logical, this._originalP2.logical) ;
        if (pOffset && pOffset> 0){ 
        this._originalSlice = this._originalData.slice(x2, Math.min(this.series.data().length-1,x2 + 1+ pOffset));
        console.log("Data Sliced with Offset",x1,x2,pOffset, "Offset Point:", Math.min(this.series.data().length-1,x2 + 1+ pOffset))
        } 
        else {
            this._originalSlice = this._originalData.slice(x1, x2 + 1);
            console.log("Data Sliced:",x1,x2)
        }
            // If a pOffset is provided, adjust each bar in the slice by adding the offset to x1 and x2.
        if (pOffset && pOffset > 0) {
            this._originalSlice = this._originalSlice.map((bar: any) => ({
            ...bar,
            x1: bar.x1 + pOffset,
            x2: bar.x2 + pOffset
            }));
            console.log("Adjusted originalSlice with pOffset:", pOffset);
        }

        // Adjust this once initially
        this.transform= this.recalculateSpatial();

        if (this.p1 && this.p2) {
            this.setPoints(this.p1, this.p2);
        }
    }
    public setData(data:DataPoint[]){
        this._originalSlice = data 
    }
    public setPoints(p1: LogicalPoint, p2: LogicalPoint): void {
        let left: LogicalPoint, right:LogicalPoint
        if (Math.min(p1.logical,p2.logical) === p1.logical){
            left = p1
            right = p2

        }else {
            left = p2
            right = p1
        } 
    

    
            if (this._originalP1 === null) {
                this._originalP1 = { ...left };
                console.log('First point (p1) set:', this._originalP1);
            } else if (this._originalP2 === null) {
                this._originalP2 = { ...right };
                console.log('Second point (p2) set:', this._originalP2);
            }
        

        this.p1 = left
        this.p2 = right

        this.recalculateSpatial(); // Ensure we just recalc scale/shift
        this.processSequence();
    }

    public updatePoint(pointIndex: number, newPoint: LogicalPoint): void {
        if (pointIndex === 1) {
            this.p1 = newPoint;
        } else if (pointIndex === 2) {
            if (!this._originalP2) {
                this._originalP2 = newPoint;
            }
            this.p2 = newPoint;
        }

        this.recalculateSpatial(); // Ensure we just recalc scale/shift
        this.processSequence();
    }


    private recalculateSpatial(): Spatial {
        if (!this.p1 || !this.p2 || !this._originalP1 || !this._originalP2) {
            console.warn('Cannot recalc spatial without valid p1/p2.');
            return  {
                scale: { x: 1, y: 1 },
                shift: { x: 0, y: 0 }
            };
        }
        const dxOrig = Math.abs(this._originalP1.logical - this._originalP2.logical);
        const dyOrig = Math.abs(this._originalP1.price - this._originalP2.price);

        if (dxOrig === 0 || dyOrig === 0) {
            console.warn('Cannot recalc scale if original points are zero difference.');
            return  {
                scale: { x: 1, y: 1 },
                shift: { x: 0, y: 0 }
            };
        }
        const dxNew = Math.abs(this.p1.logical - this.p2.logical);
        const dyNew = ((this._originalP2.price> this._originalP1.price? this.p2.price: this.p1.price)
         - (this._originalP2.price> this._originalP1.price? this.p1.price: this.p2.price));

        const scaleX = dxNew / dxOrig;
        const scaleY = dyNew / dyOrig;
        if (!this._options.xScaleLock){ 
            this.transform.scale.x = scaleX
        }
        if (!this._options.yScaleLock){ 
            this.transform.scale.y = scaleY
        }


    if (this._options.autoScale) {
        if (scaleX > -1 && scaleX < 1) {
            const downsample = Math.abs(Math.ceil(1 / scaleX));
            this.applyOptions({chandelierSize: downsample})
        } }


    const spatial: Spatial = {
        scale: {
            x: scaleX !== 0 ? Math.round(scaleX * 100) / 100 : 1,
            y: scaleY !== 0 ? Math.round(scaleY * 100) / 100 : 1
        },
        shift: {
            x: (this._originalP1.logical - this.p1.logical),
            y: this._originalP1.price - this.p1.price
        }
    };

    this._barWidth = Math.abs(this.p1.logical - this.p2.logical) / this._originalData.length;

    console.log(
        'Spatial recalculated:',
        'scaleX=', spatial.scale.x,
        'scaleY=', spatial.scale.y,
        'shiftX=', spatial.shift.x,
        'shiftY=', spatial.shift.y
    );

    if (spatial.scale.x === 0 || spatial.scale.y === 0) {
        console.warn('Scale factors cannot be zero.');
        return {
            scale: { x: 1, y: 1 },
            shift: { x: 0, y: 0 }
        };
    }

    return spatial;
}
    public processSequence(): void {
        if (!this.p1 || !this.p2) {
            console.warn('Cannot process sequence without valid p1/p2.');
            return;
        }

        this.convertAndAggregateDataPoints(); // Simply triggers the creation of data
        if (this.onComplete) {
            this.onComplete();
        }
    }

    private convertAndAggregateDataPoints(): DataPoint[] {
        // 1) Find min/max among all relevant fields (open, high, etc.) in _originalSlice
        let dataMin = Number.POSITIVE_INFINITY;
        let dataMax = Number.NEGATIVE_INFINITY;
        const transform:  Spatial = {...this.spatial}

        this._originalSlice.forEach(orig => {
            // We check whichever fields matter to you: open, high, low, close, value...
            const values: number[] = [];
    
            if (orig.open  !== undefined) { values.push(orig.open); }
            if (orig.high  !== undefined) { values.push(orig.high); }
            if (orig.low   !== undefined) { values.push(orig.low); }
            if (orig.close !== undefined) { values.push(orig.close); }
            if (orig.value !== undefined) { values.push(orig.value); }
    
            for (const v of values) {
                if (v < dataMin) dataMin = v;
                if (v > dataMax) dataMax = v;
            }
        });
    
        // If dataMin===dataMax, ensure dataRange is 1 so we avoid dividing by 0
        const dataRange = (dataMax === dataMin) ? 1 : (dataMax - dataMin);
    
        // 2) The base X origin is (originalP1.logical + shift.x)
        //    We rely on `index` for local indexing in the already-sliced data.

        const originX = this.p1.logical
        
        // 3) Map each item, normalizing its Y fields into [0..1], then scaling
        const dataPoints: DataPoint[] = this._originalSlice.map((orig, index) => {
            // X dimension logic
            const barX = originX + index;

            // Y dimension logic with min–max normalization
            function normalizeY(val: number | undefined, spatial: Spatial): number | undefined {
                if (val === undefined) return undefined;
                const rel = (val - dataMin) / dataRange;  // yields 0..1
                // Then we scale by (spatial.scale.y * dataRange) and add spatial.shift.y
                return (dataMin - spatial.shift.y) + (rel * spatial.scale.y * dataRange);
            }
            // Apply normalization to each relevant field
            const openPrice  = normalizeY(orig.open,  transform);
            const closePrice = normalizeY(orig.close, transform);
            const highPrice  = normalizeY(orig.high,  transform);
            const lowPrice   = normalizeY(orig.low,   transform);
            const valuePrice = normalizeY(orig.value, transform);
    
            // Decide if we have OHLC or single-value
            if (
                openPrice !== undefined ||
                closePrice !== undefined ||
                highPrice  !== undefined ||
                lowPrice   !== undefined
            ) {
                // This bar is OHLC data
                const isUp = (closePrice??0) > (openPrice??0);
    
                // Construct your color/border/wick logic
                const color = isUp
                    ? (this._options.upColor || 'rgba(0,255,0,0.333)')
                    : (this._options.downColor || 'rgba(255,0,0,0.333)');
                const borderColor = isUp
                    ? (this._options.borderUpColor || setOpacity(color, 1))
                    : (this._options.borderDownColor || setOpacity(color, 1));
                const wickColor   = isUp
                    ? (this._options.wickUpColor || borderColor)
                    : (this._options.wickDownColor || borderColor);
    
                // You might compute lineStyle, lineWidth, shape, etc. for each bar if needed
                // For now, let's keep it simpler and not mention "bucket" here.
                // (bucket logic is in your aggregator below.)
    
                return {
                    open: openPrice,
                    close: closePrice,
                    high: highPrice,
                    low: lowPrice,
                    isUp,
                    x1: barX   + this.offset,
                    x2: barX+ 1    + this.offset,
                    isInProgress: false,
                    originalData: {...orig, x1: index},
                    barSpacing: this._barWidth,
                    // Optional style fields
                    color,
                    borderColor,
                    wickColor,
                    lineStyle: this._options.lineStyle,
                    lineWidth: this._options.lineWidth,
                    shape: this._options.shape??'Rounded' as CandleShape
                };
            } else {
                // Single-value data
                // If your single-value doesn't need normalization, you could skip that step,
                // but here we use `valuePrice`.
                return {
                    value: valuePrice,
                    isUp: undefined,
                    x1: barX  + this.offset,
                    x2: barX +1  + this.offset,
                    isInProgress: false,
                    originalData: orig,
                    barSpacing: this._options.barSpacing ?? 0.8
                };
            }
        });
    
        // 4) Optional aggregator step (e.g., chandelier)
        const groupSize = this._options.chandelierSize ?? 1;
        if (groupSize <= 1) {
            return dataPoints;
        }
    
        const aggregatedBars: DataPoint[] = [];
        for (let i = 0; i < dataPoints.length; i += groupSize) {
            const bucket = dataPoints.slice(i, i + groupSize);
            if (bucket.length === 0) continue;
    
            const isInProgress = bucket.length < groupSize && (i + bucket.length === dataPoints.length);
            const aggregatedBar = this._chandelier(bucket, isInProgress, groupSize);
            aggregatedBars.push(aggregatedBar);
        }
        return aggregatedBars;
    }
    
    private _chandelier(
        bucket: DataPoint[],

        isInProgress = false,
        chandelierSize: number
    ): DataPoint {
        if (bucket.length === 0) {
            throw new Error('Bucket cannot be empty in _chandelier method.');
        }
        const aggregatedx1 = bucket[0].x1;
        const aggregatedx2 =aggregatedx1 + bucket.length;

        // If it's an OHLC bucket:
        if (bucket[0].originalData?.open !== undefined) {
            const openPrice = bucket[0].open ?? 0;
            const closePrice = bucket[bucket.length - 1].close ?? 0;
            const highPrice = bucket.reduce((acc, cur) => Math.max(acc, cur.high || 0), 0);
            const lowPrice = bucket.reduce((acc, cur) => Math.min(acc, cur.low || Infinity), Infinity);
            const isUp = closePrice > openPrice;
            const color = isUp
                ? this._options.upColor || 'rgba(0,255,0,0.333)'
                : this._options.downColor || 'rgba(255,0,0,0.333)';
            const borderColor = isUp
                ? this._options.borderUpColor || setOpacity(color, 1)
                : this._options.borderDownColor || setOpacity(color, 1);
            const wickColor = isUp
                ? this._options.wickUpColor || borderColor
                : this._options.wickDownColor || borderColor;
            const lineStyle = bucket.reduce<number>(
                (style, bar) => bar.lineStyle ?? bar.originalData?.lineStyle ?? style,
                this._options.lineStyle
            );
            const lineWidth = bucket.reduce<number>(
                (currentWidth, bar) => bar.lineWidth ?? bar.originalData?.lineWidth ?? currentWidth,
                this._options.lineWidth ?? 1
            );
            const shape = this._options.shape??"Rounded" as CandleShape


            return {
                open: openPrice,
                high: highPrice,
                low: lowPrice,
                close: closePrice,
                isUp,
                x1: aggregatedx1,
                x2: aggregatedx2,
                isInProgress,
                color,
                borderColor,
                wickColor,
                shape,
                lineStyle,
                lineWidth
            };
        } else {
            // Single-value version for aggregation.
            const openVal = bucket[0].value ?? 0;
            const closeVal = bucket[bucket.length - 1].value ?? 0;
            const isUp = closeVal > openVal;
            const color = isUp
                ? this._options.upColor || 'rgba(0,255,0,0.333)'
                : this._options.downColor || 'rgba(255,0,0,0.333)';
            const borderColor = isUp
                ? this._options.borderUpColor || setOpacity(color, 1)
                : this._options.borderDownColor || setOpacity(color, 1);
            const wickColor = isUp
                ? this._options.wickUpColor || borderColor
                : this._options.wickDownColor || borderColor;
            const lineStyle = bucket.reduce<number>(
                (style, bar) => bar.lineStyle ?? bar.originalData?.lineStyle ?? style,
                this._options.lineStyle
            );
            const lineWidth = bucket.reduce<number>(
                (currentWidth, bar) => bar.lineWidth ?? bar.originalData?.lineWidth ?? currentWidth,
                this._options.lineWidth ?? 1
            );
            const shape = this._options.shape??"Rounded" as CandleShape

            return {
                value: openVal,
                isUp,
                x1: aggregatedx1,
                x2: aggregatedx2,
                color,
                lineStyle,
                lineWidth
            };
        }
    }

     applyOptions(options: Partial<SequenceOptions> ) {
            this._options = {
                ...this._options,
                ...options,
            };
            this.processSequence()
        }



}





