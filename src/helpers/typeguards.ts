import { SeriesType, ISeriesApi, AreaData, Background, BarData, CandlestickData, ColorType, HistogramData, LineData, OhlcData, SolidColor, Time, VerticalGradientColor, BaselineData, CustomData, ISeriesPrimitive, WhitespaceData } from "lightweight-charts";
import { ISeriesApiExtended, decorateSeries } from "./general";
import { Legend } from "../general/legend";
import { LegendSeries, LegendPrimitive, LegendGroup, LegendItem } from "../general";
import { FillArea } from "../fill-area/fill-area";
import { CandleShape } from "../ohlc-series/data";
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
): data is BarData<Time> | CandlestickData<Time> | OhlcData<Time> {
  return "close" in data && "open" in data && "high" in data && "low" in data;
}


export function isWhitespaceData(
  data: any
): data is WhitespaceData<Time> {
  if (!data || typeof data !== "object") {
    return false;
  }

  // Must have time
  if (!("time" in data)) {
    return false;
  }

  // Must NOT have single-value or OHLC fields
  if (
    "value" in data ||
    "open" in data ||
    "close" in data ||
    "high" in data ||
    "low" in data
  ) {
    return false;
  }

  return true;
}
export function hasColorOption(series: ISeriesApi<SeriesType>): boolean {
    const seriesOptions = series.options() as any;
    return 'lineColor' in seriesOptions || 'color' in seriesOptions;
}
export function ensureExtendedSeries(
    series: ISeriesApi<SeriesType> | ISeriesApiExtended,
    legend: Legend // Assuming `Legend` is the type of the legend instance
  ): ISeriesApiExtended {
    // Type guard to check if the series is already extended
    const isExtendedSeries = (
      series: ISeriesApi<SeriesType> | ISeriesApiExtended
    ): series is ISeriesApiExtended => {
      return (series as ISeriesApiExtended).primitives !== undefined;
    };
  
    // If the series is already extended, return it
    if (isExtendedSeries(series)) {
      return series;
    }
  
    // Otherwise, decorate the series dynamically
    console.log("Decorating the series dynamically.");
    return decorateSeries(series, legend);
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
    (primitive as FillArea).options !== undefined && 
    (primitive as FillArea).options.originColor !== null &&
    (primitive as FillArea).options.destinationColor !== null &&
    (primitive as FillArea).options.lineWidth !== null
  );
}

export function isCandleShape(value: unknown): value is CandleShape {
  return Object.values(CandleShape).includes(value as CandleShape);
}