import { SeriesType, ISeriesApi, AreaData, Background, BarData, CandlestickData, ColorType, HistogramData, LineData, OhlcData, SolidColor, Time, VerticalGradientColor } from "lightweight-charts";
import { ISeriesApiExtended, decorateSeries } from "./general";
import { Legend } from "../general/legend";
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
  