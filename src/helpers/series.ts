import { ISeriesApi,  WhitespaceData, SeriesType, DeepPartial, SeriesOptionsCommon, LineStyle, LineWidth, Time, AreaData, BarData, CandlestickData, HistogramData, LineData, MouseEventParams, AreaStyleOptions, BarStyleOptions, HistogramStyleOptions, ISeriesPrimitive, LineStyleOptions, Coordinate, PriceToCoordinateConverter, OhlcData, SingleValueData } from "lightweight-charts";
import {CandleShape } from "../ohlc-series/data";
import { isOHLCData, isSingleValueData, isWhitespaceData } from "./typeguards";
import { TradeData, tradeDefaultOptions, TradeSeries, TradeSeriesOptions } from "../tx-series/renderer";
import { ohlcSeries, ohlcSeriesOptions } from "../ohlc-series/ohlc-series";
import { Handler, Legend } from "../general";
import { IndicatorDefinition } from "../indicators/indicators";


export interface ISeriesApiExtended extends ISeriesApi<SeriesType> {
  primitives: {
      [key: string]: any; // Dictionary for attached primitives
      [index: number]: any; // Indexed access for primitives
      length: number; // Array-like length
    };
    primitive: any; // Reference to the most recently attached primitive
    addPeer(peer: ISeriesApi<any>): void; // Add a peer series
    removePeer(peer: ISeriesApi<any>): void; // Remove a peer series
    peers: ISeriesApi<any>[]; // List of peer series
    sync(series: ISeriesApi<any>): void;
    attachPrimitive(primitive:ISeriesPrimitive, name?: string, replace?:boolean, addToLegend?:boolean): void; // Method to attach a primitive
    detachPrimitive(primitive:ISeriesPrimitive): void; // Detach a primitive by type
    detachPrimitives():void;
  decorated: boolean; // Flag indicating if the series has been decorated
  }
  export function decorateSeries<T extends ISeriesApi<SeriesType>>(
    original: T,
    legend?: Legend // Optional Legend instance to handle primitives
  ): T & ISeriesApiExtended {
  // Check if the series is already decorated
  if ((original as any)._isDecorated) {
    console.warn("Series is already decorated. Skipping decoration.");
      return original as T & ISeriesApiExtended;
  }

  // Mark the series as decorated
  (original as any)._isDecorated = true;
    const decorated: boolean = true;
    const peers: ISeriesApi<any>[] = [];
    const originalSetData = (original as ISeriesApi<any>).setData.bind(original);

    // Array to store attached primitives
    const primitives: ISeriesPrimitive[] = [];
  
    // Reference to the most recently attached primitive
  let lastAttachedPrimitive: ISeriesPrimitive | null = null;

    // Hook into the original `detachPrimitive` if it exists
  const originalDetachPrimitive = (original as any).detachPrimitive?.bind(original);
  const originalAttachPrimitive = (original as any).attachPrimitive?.bind(original);
  const originalData = (original as any).data?.bind(original);

  /**
   * Helper function to convert data items.
   * 
   * @param sourceItem - The raw source item (must contain a `time` property).
   * @param keys - Optional list of property names to copy. Defaults to ['time'].
   * @param copy - If true, copies all properties from sourceItem, overriding `keys`.
   * @returns A partial data item or null if `time` is missing.
   */

  function sync(series: ISeriesApi<SeriesType>): void {
    // 1) Determine the type from the series’ own options
    //    (Ensure "seriesType" is indeed on the options, otherwise provide fallback)
    const options = series.options() as { seriesType?: SupportedSeriesType };
    const targetType = options.seriesType ?? "Line"; // fallback to "Line" if undefined
  
    // 2) Perform initial synchronization from "originalData"
    const sourceData = originalData();
    if (!sourceData) {
      console.warn("Source data is missing for synchronization.");
      return;
    }
  
    const targetData = [...series.data()];
    for (let i = targetData.length; i < sourceData.length; i++) {
      // Now call your convertDataItem with the discovered type:
      const newItem = convertDataItem(series, targetType, i);
      if (newItem) {
        if (newItem && 'time' in newItem && 'value' in newItem) {
            targetData.push(newItem);
        } else {
            console.warn('Invalid data item:', newItem);
        }
      }
    }
    series.setData(targetData);
    console.log(`Synchronized series of type ${series.seriesType}`);
  
    // 3) Subscribe for future changes
    series.subscribeDataChanged(() => {
      const updatedSourceData = [...originalData()];
      if (!updatedSourceData || updatedSourceData.length === 0) {
        console.warn("Source data is missing for synchronization.");
        return;
      }
  
      // Get the last bar from the target series
      const lastTargetBar = series.data().slice(-1)[0];
      // The last index from updatedSourceData
      const lastSourceIndex = updatedSourceData.length - 1;
  
      // If the new item has a time >= last target bar’s time, we update/append
      if (
        !lastTargetBar ||
        updatedSourceData[lastSourceIndex].time >= lastTargetBar.time
      ) {
        const newItem = convertDataItem(series, targetType, lastSourceIndex);
        if (newItem) {
          series.update(newItem);
          console.log(`Updated/added bar via "update()" for series type ${series.seriesType}`);
        }
      }
    });
  }
  

  function attachPrimitive(
    primitive: ISeriesPrimitive,
    name?: string,
    replace: boolean = true,
    addToLegend: boolean = false
  ): void {
    const primitiveType = (primitive.constructor as any).type || primitive.constructor.name;

      // Detach existing primitives if `replace` is true
      if (replace) {
        detachPrimitives();
      } else {
        // Check if a primitive of the same type is already attached
        const existingIndex = primitives.findIndex(
          (p) => (p.constructor as any).type === primitiveType
        );
        if (existingIndex !== -1) {
          detachPrimitive(primitives[existingIndex]);
        }
      }
  
      // Attach the primitive to the series
    if (originalAttachPrimitive) {
      originalAttachPrimitive(primitive);
    }

      // Add the new primitive to the list
      primitives.push(primitive);
    lastAttachedPrimitive = primitive;

    console.log(`Primitive of type "${primitiveType}" attached.`);

    // Add the primitive to the legend if required
    if (legend && addToLegend) {
      legend.addLegendPrimitive(original as ISeriesApi<any>, primitive, name);
    }
  }
  
  function detachPrimitive(primitive: ISeriesPrimitive): void {
      const index = primitives.indexOf(primitive);
      if (index === -1) {
        return;
      }
  
      // Remove the primitive from the array
      primitives.splice(index, 1);
  
    if (lastAttachedPrimitive === primitive) {
      lastAttachedPrimitive = null;
    }
  
      // Detach the primitive using the original method
      if (originalDetachPrimitive) {
        originalDetachPrimitive(primitive);
      }

    // Remove the primitive from the legend if it exists
    if (legend) {
      legend.removeLegendPrimitive(primitive);
          console.log(`Removed primitive of type "${primitive.constructor.name}" from legend.`);
        }
      }
    

  function detachPrimitives(): void {
    console.log("Detaching all primitives.");
      while (primitives.length > 0) {
        const primitive = primitives.pop()!;
        detachPrimitive(primitive);
      }
    console.log("All primitives detached.");
  }

    function setData(data: any[]) {
      originalSetData(data);
      peers.forEach((peer) => peer.setData?.(data));
      console.log("Data updated on series and peers.");
          }
  
    function addPeer(peer: ISeriesApi<any>) {
      peers.push(peer);
    }
  
    function removePeer(peer: ISeriesApi<any>) {
      const index = peers.indexOf(peer);
      if (index !== -1) peers.splice(index, 1);
    }
  
    return Object.assign(original, {
    setData,
      addPeer,
      removePeer,
      peers,
      primitives,
      sync,
      attachPrimitive,
      detachPrimitive,
      detachPrimitives,
      decorated,
    get primitive() {
      return lastAttachedPrimitive;
    },
    });
  }
  
export interface SeriesOptionsExtended {
    primitives?: {
      [key: string]: any; // Dictionary for attached primitives
    };
    seriesType?: string;
    group?: string; // Group name for the series
    legendSymbol?: string | string[]; // Legend symbol(s) for the series
    isIndicator?: boolean; // Indicator flag
  }
  // Define specific options interfaces with optional `group`, `legendSymbol`, and `primitives` properties
  export interface LineSeriesOptions
    extends DeepPartial<LineStyleOptions & SeriesOptionsCommon>,
      SeriesOptionsExtended {}
  
  export interface HistogramSeriesOptions
    extends DeepPartial<HistogramStyleOptions & SeriesOptionsCommon>,
      SeriesOptionsExtended {}
  
  export interface AreaSeriesOptions
    extends DeepPartial<AreaStyleOptions & SeriesOptionsCommon>,
      SeriesOptionsExtended {}
  
  export interface BarSeriesOptions
    extends DeepPartial<BarStyleOptions & SeriesOptionsCommon>,
      SeriesOptionsExtended {}
  
  export interface OhlcSeriesOptions
    extends ohlcSeriesOptions,
        DeepPartial<SeriesOptionsExtended> {}
    

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



/**
 * Attempts to locate a series near the current cursor (within a percentage threshold).
 * This version extracts `MouseEventParams` from `handler.ContextMenu.getMouseEventParams()`.
 *
 * @param handler - The chart/series handler that provides reference for coordinate->price conversion.
 * @param thresholdPct - The maximum percentage difference allowed to consider a series "close".
 * @returns The nearest ISeriesApi<SeriesType> if found, or null otherwise.
 */
export function getProximitySeries(
  handler: Handler,
  thresholdPct = 3.33
): ISeriesApi<SeriesType> | null {
  // 1) Obtain MouseEventParams
  const mouseEventParams: MouseEventParams | null = handler.ContextMenu.getMouseEventParams();

  // 2) Basic checks
  if (!mouseEventParams) {
      console.warn("No MouseEventParams available. Param is null/undefined.");
      return null;
  }

  if (!mouseEventParams.seriesData) {
      console.warn("No seriesData in MouseEventParams. Possibly not hovering over any series data.");
      return null;
  }

  if (!mouseEventParams.point) {
      console.warn("No 'point' (x,y) in MouseEventParams, cannot compute proximity.");
      return null;
  }

  // 3) Convert the cursor Y-coordinate to a price using some "source" series
  const sourceSeries = handler.series ?? handler._seriesList?.[0];
  if (!sourceSeries) {
      console.warn("No series reference available in handler.");
      return null;
  }

  const cursorY = mouseEventParams.point.y;
  const cursorPrice = sourceSeries.coordinateToPrice(cursorY);
  if (cursorPrice === null) {
      console.warn("cursorPrice is null. Unable to determine proximity.");
      return null;
  }

  // 4) Gather potential series within threshold
  const seriesByDistance: { distance: number; series: ISeriesApi<SeriesType> }[] = [];

  mouseEventParams.seriesData.forEach((data, series) => {
      let refPrice: number | undefined;

      // Single-value data: { value: number }
      if (isSingleValueData(data)) {
          refPrice = data.value;
      }
      // OHLC data: { open, high, low, close }
      else if (isOHLCData(data)) {
          refPrice = data.close;
      }

      if (refPrice !== undefined && !isNaN(refPrice)) {
          const distance = Math.abs(refPrice - cursorPrice);
          const percentageDifference = (distance / cursorPrice) * 100;

          if (percentageDifference <= thresholdPct) {
              seriesByDistance.push({ distance, series });
          }
      }
  });

  // 5) Sort by ascending distance
  seriesByDistance.sort((a, b) => a.distance - b.distance);

  // 6) Return the closest series if any
  if (seriesByDistance.length > 0) {
      console.log("Closest series found:", seriesByDistance[0].series);
      return seriesByDistance[0].series;
  }

  console.log("No series found within proximity threshold.");
  return null;
}



// A helper that, given a “default” object, picks only those keys 
// from an incoming options object that are present in the default.
export function pickCommonOptions<T extends object>(
  defaults: T,
  opts: Partial<any>
): Partial<T> {
  const result: Partial<T> = {};
  for (const key in defaults) {
    if (Object.prototype.hasOwnProperty.call(opts, key)) {
      result[key as keyof T] = opts[key];
    }
  }
  return result;
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
export interface ISeriesIndicator extends ISeriesApi<"Line" | "Histogram" | "Area"> {
  sourceSeries: ISeriesApi<"Candlestick" | "Bar">;
  indicator: IndicatorDefinition;
  figures: Map<string, ISeriesApi<"Line" | "Histogram" | "Area">>;
  paramMap: Record<string, any>; // Stores the current parameters used for calculation
  figureCount: number ;            // NEW: stores the global figure count
  recalculate: (overrides?: Record<string, any>) => void;
}

export function decorateSeriesAsIndicator(
  series: ISeriesApi<"Line" | "Histogram" | "Area">,
  sourceSeries: ISeriesApi<"Candlestick" | "Bar">,
  ind: IndicatorDefinition,
  figures: Map<string, ISeriesApi<"Line" | "Histogram" | "Area">>,
  figureCount: number,
  paramMap: Record<string, any>,
  recalculateIndicator: (indicator: ISeriesIndicator, overrides?: Record<string, any>) => void
): ISeriesIndicator {
  const indicatorSeries = Object.assign(series, {
    sourceSeries,
    indicator: ind,
    figures,
    paramMap,
    figureCount,            // NEW: stores the global figure count

    recalculate: function (overrides?: Record<string, any>) {
      recalculateIndicator(this as ISeriesIndicator, overrides);
    },
  }) as ISeriesIndicator;

  // Subscribe to data changes on the source series to trigger automatic recalculation.
  if (typeof sourceSeries.subscribeDataChanged === "function") {
    sourceSeries.subscribeDataChanged(() => {
      if (sourceSeries.data()[sourceSeries.data().length-1].time > series.data()[series.data().length -1].time){ 
      recalculateIndicator(indicatorSeries);
    }});
  }

  return indicatorSeries;
}

export function recalculateIndicator(indicatorSeries: ISeriesIndicator, overrides?: Record<string, any>) {
  // Merge new overrides into the stored parameters to get the current parameters.
  const updatedParams = { ...indicatorSeries.paramMap, ...overrides };

  // Retrieve the source series data.
  const data = [...indicatorSeries.sourceSeries.data()];
  if (!data || !Array.isArray(data) || !data.every(isOHLCData)) {
    return;
  }

  // Run the indicator's calculation with the updated parameters.
  const newFigures = indicatorSeries.indicator.calc(data, updatedParams);

  // For each calculated figure, update the corresponding series if it exists.
  newFigures.forEach((newFigure) => {
    const existingSeries = indicatorSeries.figures.get(newFigure.key);
    if (existingSeries) {
      existingSeries.setData(newFigure.data);
      existingSeries.applyOptions({ title: newFigure.title });
      if (newFigure.pane) {
        // Check if the current pane of the series is the same as the source series' pane.
        if (existingSeries.getPane() === indicatorSeries.sourceSeries.getPane()) {
          const currentPane = existingSeries.getPane();
          const paneIndex = currentPane.paneIndex(); // Call the function to get a number
          existingSeries.moveToPane(paneIndex + newFigure.pane);
        }
      }
    }
  });

  // Store the current (merged) parameters for future recalculations.
  indicatorSeries.paramMap = updatedParams;
}

// Assume these types are defined in your project:
export interface BarItem {
  time: Time,
  open: number;
  high: number;
  low: number;
  close: number;
  x: number;
  // Optional indices for reference:
  startIndex: number;
  endIndex: number;
}


// Simplified configuration options interface
export interface SimpleAggregatorOptions {
  chandelierSize?: number; // Number of bars to group (default: 1)
}

/**
 * Simplified BarDataAggregator: aggregates raw bar data into grouped BarItem objects.
 * Only the essential properties (open, high, low, close, volume, x) are computed.
 */
export class BarDataAggregator {
  private _options: SimpleAggregatorOptions | null;

  /**
   * Constructs a new BarDataAggregator instance.
   * @param options - Aggregation options. Can be null to use defaults.
   */
  constructor(options: SimpleAggregatorOptions | null) {
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
    // Determine the group size based on chandelierSize (default to 1 if not provided)
    const groupSize = this._options?.chandelierSize ?? 1;
    const aggregatedBars: BarItem[] = [];

    // Iterate over the data in increments of groupSize to form buckets.
    for (let i = 0; i < data.length; i += groupSize) {
      const bucket = data.slice(i, i + groupSize);
      if (bucket.length === 0) {
        console.warn("Empty bucket encountered during aggregation.");
        continue;
      }

      // Aggregate the current bucket into a single BarItem.
      const aggregatedBar = this._chandelier(
        bucket,
        i,
        i + bucket.length - 1,
        priceToCoordinate
      );
      aggregatedBars.push(aggregatedBar);
    }

    return aggregatedBars;
  }

  /**
   * Aggregates a single bucket of BarItem objects into one consolidated BarItem.
   * Uses the first bar's open, the last bar's close, the maximum high, the minimum low,
   * the sum of volumes, and the first bar's x-position.
   *
   * @param bucket - The group of BarItem objects to aggregate.
   * @param startIndex - The starting index of the bucket in the original data array.
   * @param endIndex - The ending index of the bucket in the original data array.
   * @param priceToCoordinate - Function to convert price values to canvas coordinates.
   * @returns A single aggregated BarItem.
   * @throws Will throw an error if the bucket is empty.
   */
  private _chandelier(
    bucket: BarItem[],
    startIndex: number,
    endIndex: number,
    priceToCoordinate: PriceToCoordinateConverter
  ): BarItem {
    if (bucket.length === 0) {
      throw new Error("Bucket cannot be empty in _chandelier method.");
    }

    // Use the first bar's open, the last bar's close.
    const openPrice = bucket[0].open;
    const closePrice = bucket[bucket.length - 1].close;

    // For high and low, aggregate from the entire bucket.
    const highPrice = Math.max(...bucket.map((bar) => bar.high));
    const lowPrice = Math.min(...bucket.map((bar) => bar.low));

    // Sum up the volume from the bucket.
    startIndex = startIndex??0
    endIndex = endIndex??0
    // Use the first bar's x-coordinate (alternatively, you might use an average).
    const x = bucket[0].x;
    const time = bucket[0].time
    // Optionally, you can convert prices to canvas coordinates.
    const open = (priceToCoordinate(openPrice)??0 )as Coordinate;
    const close = (priceToCoordinate(closePrice)??0 )as Coordinate;
    const high = (priceToCoordinate(highPrice)??0 )as Coordinate;
    const low = (priceToCoordinate(lowPrice)??0 )as Coordinate;

    // Return the aggregated BarItem with the essential properties.
    return {
      time,
      open,
      high,
      low,
      close,
      x,
      startIndex,
      endIndex,
    };
  }
}
/**
 * Converts a SingleValueData object to an OhlcData object by assigning
 * the `value` property to the open, high, low, and close prices.
 *
 * @param data - The single value data point.
 * @returns An OhlcData object with open, high, low, and close set to data.value.
 */
export function singleToOhlcData<HorzScaleItem = Time>(
  data: SingleValueData<HorzScaleItem>
): OhlcData<HorzScaleItem> {
  return {
    time: data.time,
    open: data.value,
    high: data.value,
    low: data.value,
    close: data.value,
  };
}