import { ISeriesApi,  WhitespaceData, SeriesType, DeepPartial, SeriesOptionsCommon, LineSeriesOptions, HistogramSeriesOptions, AreaSeriesOptions, BarSeriesOptions, LineStyle, LineWidth, Time, AreaData, BarData, CandlestickData, HistogramData, LineData } from "lightweight-charts";
import { CandleShape } from "../ohlc-series/data";
import { ISeriesApiExtended, OhlcSeriesOptions } from "./general";
import { isOHLCData, isSingleValueData, isWhitespaceData } from "./typeguards";
import { TradeData, tradeDefaultOptions, TradeSeries, TradeSeriesOptions } from "../tx-series/renderer";
import { ohlcSeries } from "../ohlc-series/ohlc-series";
import { Handler } from "../general";
export function determineAvailableFields(series: ISeriesApi<any>|TradeSeries<any>|ohlcSeries<any>): {
ohlc: boolean;
volume: boolean;
} {

const currentData = (series as ISeriesApiExtended).data();
if (!currentData || currentData.length === 0) {
  return { ohlc: false, volume: false };
}
const sample = currentData[0];

//const hasOhlc =
//  "open" in sample &&
//  "high" in sample &&
//  "low" in sample &&
//  "close" in sample;
const hasVolume = "volume" in sample;


const hasOhlc = isOHLCData(currentData)

return { ohlc: hasOhlc, volume: hasVolume };
}

export function getDefaultSeriesOptions(
    type: SupportedSeriesType //| "Ohlc" | "Trade"
    ): DeepPartial<
    SeriesOptionsCommon &
    (
        | LineSeriesOptions
        | HistogramSeriesOptions
        | AreaSeriesOptions
        | BarSeriesOptions
        | OhlcSeriesOptions
        | TradeSeriesOptions 
    )
    > {
    const common: DeepPartial<SeriesOptionsCommon> = {
    // Define any common default options that apply to all series types here
    };

    switch (type) {
    case "Line":
        return {
        ...common,
        title: type,
        color: "#195200",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        };
    case "Histogram":
        return {
        ...common,
        title: type,
        color: "#9ACF01",
        base: 0,
        };
    case "Area":
        return {
        ...common,
        title: type,
        lineColor: "#021698",
        topColor: "rgba(9, 32, 210, 0.4)",
        bottomColor: "rgba(0, 0, 0, 0.5)",
        };
    case "Bar":
        return {
        ...common,
        title: type,
        upColor: "#006721",
        downColor: "#6E0000",
        borderUpColor: "#006721",
        borderDownColor: "#6E0000",
        };
    case "Candlestick":
        return {
        ...common,
        title: type,
        upColor: "rgba(0, 103, 33, 0.33)",
        downColor: "rgba(110, 0, 0, 0.33)",
        borderUpColor: "#006721",
        borderDownColor: "#6E0000",
        wickUpColor: "#006721",
        wickDownColor: "#6E0000",
        }
    case "Ohlc":
        return {
        ...common,
        title: type,
        upColor: "rgba(0, 103, 33, 0.33)",
        downColor: "rgba(110, 0, 0, 0.33)",
        borderUpColor: "#006721",
        borderDownColor: "#6E0000",
        wickUpColor: "#006721",
        wickDownColor: "#6E0000",
        shape: "Rounded" as CandleShape,
        chandelierSize: 1,
        barSpacing: 0.777,
        lineStyle: 0 as LineStyle,
        lineWidth: 1 as LineWidth,
        };
    case "Trade": 
        return {
            ...common,
            ...tradeDefaultOptions,
            
        }
    default:
        throw new Error(`Unsupported series type: ${type}`);
    }
    }
    
    
    
    /**
     * Converts the last item of the input data to a different series type.
     *
     * @param series - The source series to convert data from.
     * @param targetType - The target series type for conversion.
     * @returns The converted data item for the target series type, or null if conversion is not possible.
     */
   /**
 * A union type for all possible data shapes we might return.
 */
type ConvertableData<T extends Time = Time> =
| LineData<T>
| HistogramData<T>
| AreaData<T>
| BarData<T>
| CandlestickData<T>
| { time: T }  // for e.g. "Trade" if you had that, or minimal shapes
| null;


/**
 * Converts one specific data item (by `index`) to the target series type.
 */
export function convertDataItem(
  series: ISeriesApi<SeriesType>,
  targetType: SupportedSeriesType,
  index: number
): ConvertableData<Time> {
  // 1) get the data array
  const data = series.data();
  if (!data || data.length === 0) {
    console.warn("No data available in the source series.");
    return null;
  }

  // 2) pick the individual item
  const item = data[index];

  // 3) switch on targetType, then use type guards on `item`
  switch (targetType) {
    // Single-value shapes: "Line", "Histogram", "Area"
    case "Line": {
      // line expects { time, value }
      if (isOHLCData(item)) {
        // Use item.close for value
        return {
          time: item.time,
          value: item.close,
        } as LineData<Time>;
      } else if (isSingleValueData(item)) {
        // Already has { time, value }
        return {
          time: item.time,
          value: item.value,
        } as LineData<Time>;
      } else if (isWhitespaceData(item)) {
        // It's valid whitespace data => return as-is
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      // else it's something else => can't convert
      break;
    }

    case "Histogram": {
      // histogram expects { time, value }, possibly color
      if (isOHLCData(item)) {
        return {
          time: item.time,
          value: item.close,
        } as HistogramData<Time>;
      } else if (isSingleValueData(item)) {
        return {
          time: item.time,
          value: item.value,
        } as HistogramData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    case "Area": {
      // area expects { time, value }
      if (isOHLCData(item)) {
        return {
          time: item.time,
          value: item.close,
        } as AreaData<Time>;
      } else if (isSingleValueData(item)) {
        return {
          time: item.time,
          value: item.value,
        } as AreaData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    // OHLC shapes: "Bar", "Candlestick", "Ohlc"
    case "Bar": {
      // { time, open, high, low, close }
      if (isOHLCData(item)) {
        return {
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        } as BarData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    case "Candlestick": {
      // shape = { time, open, high, low, close }
      if (isOHLCData(item)) {
        return {
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        } as CandlestickData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    case "Ohlc": {
      // your custom type or just treat it as BarData
      if (isOHLCData(item)) {
        return {
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        } as BarData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }
    
    case "Trade": {
      return {
        time: item.time,
        action: (item as any).action ?? undefined,
      } as TradeData;
    }
    default:
      console.error(`Unsupported target type: ${targetType}`);
      return null;
  }

  // If we reach here, no conversion was possible
  console.warn("Could not convert data to the target type.");
  return null;
}
export type SupportedSeriesType = keyof typeof SeriesTypeEnum;


/**
 * Clones an existing series into a new series of a specified type.
 *
 * @param series - The series to clone.
 * @param type - The target type for the cloned series.
 * @param options - Additional options to merge with default options.
 * @returns The cloned series, or null if cloning fails.
 */
export function cloneSeriesAsType(
  series: ISeriesApi<SeriesType>,
  handler: Handler,
  type: SupportedSeriesType,
  options: any
): ISeriesApi<SeriesType> | null {
  try {
      const defaultOptions = getDefaultSeriesOptions(type);
      const mergedOptions = { ...defaultOptions, ...options };

      let clonedSeries: { name: string; series: ISeriesApi<SeriesType> };
      console.log(`Cloning ${series.seriesType()} as ${type}...`);

      // Create the new series using a handler pattern you already have
      switch (type) {
          case 'Line':
              clonedSeries = handler.createLineSeries(type, mergedOptions);
              break;
          case 'Histogram':
              clonedSeries = handler.createHistogramSeries(type, mergedOptions);
              break;
          case 'Area':
              clonedSeries = handler.createAreaSeries(type, mergedOptions);
              break;
          case 'Bar':
              clonedSeries = handler.createBarSeries(type, mergedOptions);
              break;
          case 'Candlestick':
              clonedSeries = {
                  name: options.name,
                  series: handler.createCandlestickSeries(),
              };
              break;
          case 'Ohlc':
              clonedSeries = handler.createCustomOHLCSeries(type, mergedOptions);
              break;
          default:
              console.error(`Unsupported series type: ${type}`);
              return null;
      }

      // ---------------------------
      // Use convertDataItem() to transform the existing data
      // ---------------------------
      const originalData = series.data();

      // Convert each bar in the original series
      let transformedData = originalData
          .map((_, i) => convertDataItem(series, type, i))
          .filter((item) => item !== null) as any[];

      // Apply the transformed data to the newly created series
      clonedSeries.series.setData(transformedData);

      // Hide the original series
      series.applyOptions({ visible: false });

      // ---------------------------
      // Subscribe to data changes on the original to keep the clone updated
      // ---------------------------
      series.subscribeDataChanged(() => {
          const updatedData = series.data();

          const newTransformed = updatedData
              .map((_, i) => convertDataItem(series, type, i))
              .filter((item) => item !== null) as any[];

          clonedSeries.series.setData(newTransformed);
          console.log(`Updated synced series of type ${type}`);
      });

      return clonedSeries.series;

  } catch (error) {
      console.error('Error cloning series:', error);
      return null;
  }
}
// series-types.ts
export enum SeriesTypeEnum {
  Line = "Line",
  Histogram = "Histogram",
  Area = "Area",
  Bar = "Bar",
  Candlestick = "Candlestick",
  Ohlc = "Ohlc",
  Trade = "Trade"

}