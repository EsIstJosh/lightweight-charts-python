import { SeriesType, ISeriesApi, AreaData, Background, BarData, CandlestickData, ColorType, HistogramData, LineData, OhlcData, SolidColor, Time, VerticalGradientColor, BaselineData, CustomData, ISeriesPrimitive, WhitespaceData } from "lightweight-charts";
import { LegendSeries, LegendPrimitive, LegendGroup, LegendItem } from "../general";
import { FillArea } from "../fill-area/fill-area";
import { CandleShape, ohlcSeriesData } from "../ohlc-series/data";
import { ISeriesApiExtended, ISeriesIndicator } from "./series";
export function isSolidColor(background: Background): background is SolidColor {
  return background.type === ColorType.Solid;
}

export function isVerticalGradientColor(
  background: Background
): background is VerticalGradientColor {
  return background.type === ColorType.VerticalGradient;
}

// Type checks for data
export function isSingleValueData(
  data: any
): data is LineData<Time> | AreaData<Time> | HistogramData<Time> {
  return "value" in data;
}

export function isOHLCData(
  data: any
): data is BarData<Time> | CandlestickData<Time> | OhlcData<Time> | ohlcSeriesData{
  return "close" in data && "open" in data && "high" in data && "low" in data;
}

export function isWhitespaceData(data: any): data is WhitespaceData<Time> {
  if (!data || typeof data !== "object") {
    return false;
  }
  // Must have time
  if (!("time" in data)) {
    return false;
  }
 
  if ("value" in data || "open" in data || "close" in data || "high" in data || "low" in data) {
    return false;
  }
  return true;
}

export function hasColorOption(series: ISeriesApi<SeriesType>): boolean {
    const seriesOptions = series.options() as any;
    return 'lineColor' in seriesOptions || 'color' in seriesOptions;
}


  export function isLegendPrimitive(item: LegendSeries | LegendPrimitive): item is LegendPrimitive {
    return (item as LegendPrimitive).primitive !== undefined;
}

  export function isLegendSeries(item: LegendItem | LegendGroup | LegendSeries | LegendPrimitive): item is LegendSeries {
    return (item as LegendSeries).seriesType !== undefined;
}

export interface SeriesTypeToDataMap {
  'Bar': BarData<Time>;
  'Candlestick': CandlestickData<Time>;
  'Histogram': HistogramData<Time>;
  'Area': AreaData<Time>;
  'Baseline': BaselineData<Time>;
  'Line': LineData<Time>;
  'Custom': CustomData<Time>;
  //'CustomSeriesWhitespace': CustomSeriesWhitespaceData<Time>;
  // Map other series types to their data interfaces
}
// utils/typeGuards.ts


/**
 * Type guard to check if a primitive is FillArea.
 *
 * @param primitive - The primitive to check.
 * @returns True if primitive is FillArea, else false.
 */
export function isFillArea(primitive: ISeriesPrimitive | FillArea): primitive is FillArea {
  return (
    (primitive as FillArea).options.originColor !== null &&
    (primitive as FillArea).options.destinationColor !== null 
  );
}

export function isCandleShape(value: unknown): value is CandleShape {
  return Object.values(CandleShape).includes(value as CandleShape);
}


export function isISeriesApi(series: any): series is ISeriesApi<SeriesType>| ISeriesApiExtended {
  return (
    typeof series === "object" &&
    series !== null &&
    typeof series.data === "function" &&
    typeof series.options === "function" 
  );
}
// Type Guard: Check if the series is an ISeriesIndicator
export function isISeriesIndicator(series: any): series is ISeriesIndicator {
  return (series as ISeriesIndicator).figures !== undefined &&
         (series as ISeriesIndicator).sourceSeries !== undefined &&
         (series as ISeriesIndicator).indicator !== undefined;
}
