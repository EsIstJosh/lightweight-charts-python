import { ISeriesApi, WhitespaceData, SeriesType, DeepPartial, SeriesOptionsCommon, LineStyle, LineWidth, Time, AreaData, BarData, CandlestickData, HistogramData, LineData, MouseEventParams, AreaStyleOptions, BarStyleOptions, HistogramStyleOptions, ISeriesPrimitive, LineStyleOptions, Coordinate, PriceToCoordinateConverter, OhlcData, SingleValueData, SeriesOptions, SeriesOptionsMap } from "lightweight-charts";
import { CandleShape } from "../ohlc-series/data";
import { isOHLCData, isSingleValueData, isWhitespaceData } from "./typeguards";
import { ohlcSeries, ohlcSeriesOptions } from "../ohlc-series/ohlc-series";
import { Handler, Legend } from "../general";
import { IndicatorDefinition, IndicatorFigure } from "../indicators/indicators";
import { findColorOptions } from "./colors";
import { PineTS } from "pinets";
import { convertTime } from "./time";
import { defaultSymbolSeriesOptions, SymbolSeriesOptions } from "../symbol-series/options";
import { SymbolSeries } from "../symbol-series/symbol-series";
import { SymbolSeriesData } from "../symbol-series/data";
import { defaultFillAreaOptions, FillArea } from "../fill-area/fill-area";
export interface ISeriesApiExtended extends ISeriesApi<SeriesType> {
  primitives: {
    [key: string]: any; // Dictionary for attached primitives
    [index: number]: any; // Indexed access for primitives
    length: number; // Array-like length
  };
  primitive: any; // Reference to the most recently attached primitive
  applyOptions(options: any): void;
  sync(series: ISeriesApi<any>): void;
  attachPrimitive(primitive: ISeriesPrimitive, name?: string, replace?: boolean, addToLegend?: boolean): void; // Method to attach a primitive
  detachPrimitive(primitive: ISeriesPrimitive): void; // Detach a primitive by type
  detachPrimitives(): void;
  decorated: boolean; // Flag indicating if the series has been decorated
  toJSON(): { options: SeriesOptions<any>; data: [] };
  fromJSON(json: { options?: SeriesOptions<any>; data?: [] }): void;
  _type: string;
  title: string;
  dataType(other?: ISeriesApi<any>): SingleValueData | OhlcData | boolean | null;
  dataTransform(): Array<ConvertableData<Time>>;
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
  const originalSetData = (original as ISeriesApi<any>).setData.bind(original);

  // Array to store attached primitives
  const primitives: ISeriesPrimitive[] = [];

  // Reference to the most recently attached primitive
  let lastAttachedPrimitive: ISeriesPrimitive | null = null;

  // Hook into the original `detachPrimitive` if it exists
  const originalDetachPrimitive = (original as any).detachPrimitive?.bind(original);
  const originalAttachPrimitive = (original as any).attachPrimitive?.bind(original);
  const originalData = (original as any).data?.bind(original);
  const originalApplyOptions = (original as any).applyOptions?.bind(original);

  /**
   * Helper function to convert data items.
   * 
   * @param sourceItem - The raw source item (must contain a `time` property).
   * @param keys - Optional list of property names to copy. Defaults to ['time'].
   * @param copy - If true, copies all properties from sourceItem, overriding `keys`.
   * @returns A partial data item or null if `time` is missing.
   */
  const _type: string = original.seriesType();
  const title = original.options().title;
  // Overloads for dataType:
  // - When no argument is provided, returns a SingleValueData or OhlcData (or null).
  // - When provided with another series, returns a boolean indicating whether both share the same data type.
  function dataTransform(): Array<ConvertableData<Time>> {
    const dataArray = original.data();
    if (!dataArray || dataArray.length === 0) {
      return [];
    }
    const firstData = dataArray[0];

    // Determine target type: if original is OHLC, convert to single-value ("Line"),
    // otherwise if it's single-value, convert to OHLC ("Candlestick").
    let targetType: SupportedSeriesType;
    if (isOHLCData(firstData) || ("open" in firstData && "high" in firstData && "low" in firstData && "close" in firstData)) {
      targetType = "Line";
    } else if (isSingleValueData(firstData)) {
      targetType = "Candlestick";
    } else {
      // If we cannot determine the type, return the original data.
      return [...dataArray];
    }
    return dataArray.map((_, index) => convertDataItem(original, targetType, index));
  }

  function dataType(other?: ISeriesApi<any>): SingleValueData | OhlcData | boolean | null {
    // Retrieve the first data item from the decorated series.
    const firstData = original.data()[0];
    if (isWhitespaceData(firstData)) return null;

    // Determine our classification using type guards.
    let ourIsSingle = isSingleValueData(firstData);
    let ourIsOhlc = isOHLCData(firstData);

    // For custom series, if it doesn't pass the standard guards,
    // check for the presence of OHLC properties directly.
    if (!ourIsSingle && !ourIsOhlc &&
      "open" in firstData && "high" in firstData && "low" in firstData && "close" in firstData) {
      ourIsOhlc = true;
    }

    // If another series is provided, compare its classification to ours.
    if (other) {
      const otherFirst = other.data()[0];
      if (isWhitespaceData(otherFirst)) return false;
      let otherIsSingle = isSingleValueData(otherFirst);
      let otherIsOhlc = isOHLCData(otherFirst);
      if (!otherIsSingle && !otherIsOhlc &&
        "open" in otherFirst && "high" in otherFirst && "low" in otherFirst && "close" in otherFirst) {
        otherIsOhlc = true;
      }
      return (ourIsSingle && otherIsSingle) || (ourIsOhlc && otherIsOhlc);
    }

    // No argument: return the actual data item if it qualifies.
    return (ourIsSingle || ourIsOhlc) ? firstData : null;
  }


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

  // ─────────────────────────────────────────────────────────────────────────
  // DECORATED applyOptions
  // ─────────────────────────────────────────────────────────────────────────
  const applyOptions = (options: any): void => {
    // 1) Call the original applyOptions (to actually change the chart’s appearance)
    if (originalApplyOptions) {
      originalApplyOptions(options);
    }

    // 2) If we have a Legend instance, update the legend colors accordingly
    if (legend && typeof legend._lines !== 'undefined') {
      const seriesType = (original as any).seriesType();
      // Find the corresponding legend item for this series
      const legendItem = legend._lines.find((item: any) => item.series === original);

      if (legendItem) {
        // If this is a candlestick/bar-type series
        if (seriesType === 'Candlestick' || seriesType === 'Bar' || seriesType === 'Custom' && ('upColor' in options || 'downColor' in options)) {
          // Typical color properties: upColor, downColor, borderUpColor, borderDownColor, wickUpColor, wickDownColor
          if (options.upColor !== undefined) {
            // For example, store upColor in legendItem.colors[0]
            legendItem.colors[0] = options.upColor;
          }
          if (options.downColor !== undefined) {
            // Possibly store downColor in legendItem.colors[1]
            legendItem.colors[1] = options.downColor;
          }
          // Extend this logic to borderUpColor, borderDownColor, wickUpColor, etc. if you display them in the legend
        }
        // If this is a line series
        else if (seriesType === 'Line' || seriesType === 'Histogram' || seriesType === 'Custom' && 'color' in options) {
          if (options.color !== undefined) {
            // Possibly store color in legendItem.colors[0]
            legendItem.colors[0] = options.color;
          }
        }
        // If this is an area, or other type you want to handle
        else if (seriesType === 'Area') {
          // e.g. lineColor => legendItem.colors[0], etc.
          if (options.lineColor !== undefined) {
            legendItem.colors[0] = options.lineColor;
          }
        }
        // ...

        // Check if 'shape' is present in options and update legendSymbol accordingly.
        if ('shape' in options) {
          const symbol = (() => {
            switch (options.shape) {
              // Unicode circle
              case 'circle':
              case 'circles':
                return '●'; // or '○'
              // A cross-like symbol
              case 'cross':
                return '✚';
              // Filled upward triangle
              case 'triangleUp':
                return '▲';
              // Filled downward triangle
              case 'triangleDown':
                return '▼';
              // Up arrow
              case 'arrowUp':
                return '↑';
              // Down arrow
              case 'arrowDown':
                return '↓';
              default:
                return options.shape;
            }
          })();
          legendItem.legendSymbol = symbol;
        }
      }
    }
  };
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
  function setData(data: any[]): void {
    // If no data is passed or data is not an array, fall back to the original data array.
    if (!data || !Array.isArray(data)) {
      data = [...original.data()];
    }

    if (!data || data.length === 0) {
      originalSetData(data);
      return;
    }

    // Get the target type of the series (e.g. "Line", "Histogram", "Area", "Bar", "Candlestick", "Ohlc", etc.)
    const targetType = original.seriesType() as SupportedSeriesType;

    // For single-value series: if the target type is one of these and the first data item has a "value" property...
    if ((targetType === "Line" || targetType === "Histogram" || targetType === "Area" || targetType == "Symbol" || targetType == "Custom") && "value" in data[0]) {
      // ...and if every data item is already SingleValueData, then no conversion is needed.
      if (data.every(item => isSingleValueData(item))) {
        originalSetData(data);
        return;
      }
    }
    // For OHLC series: if the target type is one of these and the first data item has an "open" property...
    else if ((targetType === "Bar" || targetType === "Candlestick" || targetType === "Custom" || targetType === "Ohlc") && "open" in data[0]) {
      // ...and if every data item is already OhlcData, then no conversion is needed.
      if (data.every(item => isOHLCData(item))) {
        originalSetData(data);
        return;
      }
    }

    // Otherwise, we need to convert the data.
    let convertedData: SingleValueData[] | OhlcData[];
    if ((targetType === "Line" || targetType === "Histogram" || targetType === "Area" || targetType === "Symbol") && "open" in data[0]) {
      // Data appears to be OHLC but target is single-value;
      // conversion will use the close value.
      convertedData = data.map((_, index) => convertDataItem(data, targetType, index)) as SingleValueData[];
    } else if ((targetType === "Bar" || targetType === "Candlestick" || targetType === "Ohlc") && "value" in data[0]) {
      // Data appears to be single-value but target is OHLC;
      convertedData = data.map((_, index) => convertDataItem(data, targetType, index)) as OhlcData[];
    } else {
      // Fallback: assume single-value conversion.
      convertedData = data.map((_, index) => convertDataItem(data, targetType, index)) as SingleValueData[];
    }

    originalSetData(convertedData);
  }

  return Object.assign(original, {
    applyOptions,
    setData,
    dataType,
    dataTransform,
    primitives,
    sync,
    attachPrimitive,
    detachPrimitive,
    detachPrimitives,
    decorated,
    _type,
    title,
    get primitive() {
      return lastAttachedPrimitive;
    },

    toJSON(): { options: SeriesOptions<any>; data: [] } {
      return {
        options: original.options(),
        data: originalData(),
      };
    },
    fromJSON(json: { options?: SeriesOptions<any>; data?: [] }): void {
      // If data is provided, update the series' data.
      if (json.data) {
        originalSetData(json.data);
      }
      // If options are provided, iterate over each property and apply it.
      if (json.options) {
        // Cast json.options to a plain record.
        const opts = json.options as Record<string, any>;
        for (const key in opts) {
          if (Object.prototype.hasOwnProperty.call(opts, key)) {
            // Cast key to string (since TS sometimes infers symbol too).
            const typedKey = key as keyof SeriesOptions<any> & string;
            original.applyOptions({ [typedKey]: opts[typedKey] });
          }
        }
      }
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
  SeriesOptionsExtended { }

export interface HistogramSeriesOptions
  extends DeepPartial<HistogramStyleOptions & SeriesOptionsCommon>,
  SeriesOptionsExtended { }

export interface AreaSeriesOptions
  extends DeepPartial<AreaStyleOptions & SeriesOptionsCommon>,
  SeriesOptionsExtended { }

export interface BarSeriesOptions
  extends DeepPartial<BarStyleOptions & SeriesOptionsCommon>,
  SeriesOptionsExtended { }

export interface OhlcSeriesOptions
  extends ohlcSeriesOptions,
  DeepPartial<SeriesOptionsExtended & SeriesOptionsExtended> { }


export function determineAvailableFields(series: ISeriesApi<any> | SymbolSeries<any> | ohlcSeries<any>): {
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
    | SymbolSeriesOptions
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
    case "Symbol":
      return {
        ...common,
        ...defaultSymbolSeriesOptions,
        title: type,

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
  | SymbolSeriesData<T>
  | WhitespaceData<T>
  | null;


/**
 * Converts one specific data item (by `index`) to the target series type.
 */
export function convertDataItem(
  source: ISeriesApi<SeriesType> | any[],
  targetType: SupportedSeriesType,
  index: number
): ConvertableData<Time> {
  // Determine if 'source' is already an array or a series object.
  let data: any[];
  if (Array.isArray(source)) {
    data = source;
  } else if (source && typeof source.data === "function") {
    data = [...source.data()];
  } else {
    console.warn("Invalid source provided to convertDataItem; expected an array or series object.");
    return null;
  }

  if (!data || data.length === 0) {
    console.warn("No data available in the source series.");
    return null;
  }

  // Pick the individual item.
  const item = data[index];
  // 3) switch on targetType, then use type guards on `item`
  switch (targetType) {
    // Single-value shapes: "Line", "Histogram", "Area"
    case "Line": {
      // Line expects { time, value }
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
      // Bar expects { time, open, high, low, close }
      if (isOHLCData(item)) {
        return {
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        } as BarData<Time>;
      } else if (isSingleValueData(item)) {
        // If single-value data, copy value to all OHLC fields.
        return {
          time: item.time,
          open: item.value,
          high: item.value,
          low: item.value,
          close: item.value,
        } as BarData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    case "Candlestick": {
      // Candlestick expects { time, open, high, low, close }
      if (isOHLCData(item)) {
        return {
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        } as CandlestickData<Time>;
      } else if (isSingleValueData(item)) {
        return {
          time: item.time,
          open: item.value,
          high: item.value,
          low: item.value,
          close: item.value,
        } as CandlestickData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    case "Ohlc": {
      // Ohlc can be treated similarly to Bar.
      if (isOHLCData(item)) {
        return {
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        } as BarData<Time>;
      } else if (isSingleValueData(item)) {
        return {
          time: item.time,
          open: item.value,
          high: item.value,
          low: item.value,
          close: item.value,
        } as BarData<Time>;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    case "Symbol": {
      if (isOHLCData(item)) {
        return {
          time: item.time,
          value: item.close
        } as SymbolSeriesData
      } else if (isSingleValueData(item)) {
        return {
          time: item.time,
          value: item.value

        } as SymbolSeriesData;
      } else if (isWhitespaceData(item)) {
        return {
          time: item.time,
        } as WhitespaceData<Time>;
      }
      break;
    }

    default:
      console.error(`Unsupported target type: ${targetType}`);
      return {
        time: item.time,
      } as WhitespaceData<Time>;
  }


  // If we reach here, no conversion was possible
  console.warn("Could not convert data to the target type.");
  return null;
}
export type SupportedSeriesType = keyof typeof SeriesTypeEnum;

/**
 * Returns true if the given dot-separated key path exists in the defaults.
 * Special case: if the key is "color" or "LineColor", and either exists in defaults,
 * the function returns true.
 *
 * @param path The dot-separated key path.
 * @param defaults The defaults object.
 */
function isOptionInDefaults(path: string, defaults: Record<string, any>): boolean {
  const keys = path.split(".");
  let obj = defaults;
  for (const key of keys) {
    if (!(key in obj)) {
      // Check the interchangeable case for color vs LineColor.
      if ((key === "color" || key === "LineColor") && ("color" in obj || "LineColor" in obj)) {
        return true;
      }
      return false;
    }
    obj = obj[key];
  }
  return true;
}

/**
 * Clones an existing series into a new series of a specified type.
 *
 * @param series - The series to clone.
 * @param handler - The chart handler.
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
    // Get current series options.
    const seriesOptions = series.options();
    // Get default options for the specified type.
    const defaultOptions = getDefaultSeriesOptions(type);
    // Merge with any extra provided options.
    const mergedOptions = { ...defaultOptions, ...options };
    const name = series.options().title ?? type;
    let clonedSeries: { name: string; series: ISeriesApiExtended };
    console.log(`Cloning ${series.seriesType()} as ${type}...`);

    // Create the new series using the handler.
    switch (type) {
      case 'Line':
        clonedSeries = handler.createLineSeries(`${name}<${type}>`, undefined, series.getPane().paneIndex());
        break;
      case 'Histogram':
        clonedSeries = handler.createHistogramSeries(`${name}<${type}>`, undefined, series.getPane().paneIndex());
        break;
      case 'Area':
        clonedSeries = handler.createAreaSeries(`${name}<${type}>`, undefined, series.getPane().paneIndex());
        break;
      case 'Bar':
        clonedSeries = handler.createBarSeries(`${name}<${type}>`, undefined, series.getPane().paneIndex());
        break;
      case 'Candlestick':
        clonedSeries = {
          name: `${name}<${type}>`,
          series: handler.createCandlestickSeries(),
        };
        break;
      case 'Ohlc':
        clonedSeries = handler.createCustomOHLCSeries(`${name}<${type}>`, undefined, series.getPane().paneIndex());
        break;
      default:
        console.error(`Unsupported series type: ${type}`);
        return null;
    }

    // Convert and set data on the cloned series.
    const originalData = series.data();
    let transformedData = originalData
      .map((_, i) => convertDataItem(series, type, i))
      .filter((item) => item !== null) as any[];
    clonedSeries.series.setData(transformedData);

    // Transfer color options iteratively.
    findColorOptions(seriesOptions, (fullPath, value) => {
      // Only update the cloned series if the default options contain this key.
      if (isOptionInDefaults(fullPath, defaultOptions)) {
        if (fullPath === "LineColor" || fullPath === "color") {
          // Handle the interchangeable case.
          const hasLineColor = "LineColor" in defaultOptions || "LineColor" in mergedOptions;
          const hasColor = "color" in defaultOptions || "color" in mergedOptions;
          if (hasLineColor && hasColor) {
            setOptionByPath(clonedSeries.series, "LineColor", value);
            setOptionByPath(clonedSeries.series, "color", value);
          } else if (hasLineColor) {
            setOptionByPath(clonedSeries.series, "LineColor", value);
          } else if (hasColor) {
            setOptionByPath(clonedSeries.series, "color", value);
          }
        } else {
          // For any other color option, simply update the cloned series.
          setOptionByPath(clonedSeries.series, fullPath, value);
        }
      }
    });
    // Iterate over all keys of mergedOptions
    (Object.keys(mergedOptions) as (keyof typeof mergedOptions)[]).forEach((key) => {
      // Only process keys that include "color"
      if (key.toString().toLowerCase().includes("color")) {
        // Create a small object containing only this key/value pair
        const optionObj = { [key]: mergedOptions[key] };
        // Use findColorOptions to process this object
        findColorOptions(optionObj, (fullPath, value) => {
          console.log(`Found color option: ${fullPath} = ${value}`);
          // Here you could call setOptionByPath or any other function as needed.
        });
      }
    });



    // Subscribe to data changes on the original series to keep the clone updated.
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
    console.error("Error cloning series:", error);
    return null;
  }
}
function setOptionByPath(target: ISeriesApi<SeriesType>, path: string, value: any): void {
  const currentOptions = target.options();
  const keys = path.split(".");
  let obj: any = currentOptions; // cast to any so we can index by string
  for (let i = 0; i < keys.length - 1; i++) {
    if (keys[i] === "__proto__" || keys[i] === "constructor") {
      continue;
    }
    if (!(keys[i] in obj)) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  target.applyOptions(currentOptions);
}

// series-types.ts
export enum SeriesTypeEnum {
  Line = "Line",
  Histogram = "Histogram",
  Area = "Area",
  Bar = "Bar",
  Candlestick = "Candlestick",
  Ohlc = "Ohlc",
  Symbol = "Symbol",
  Custom = "Custom",

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
  series: ISeriesApi<keyof SeriesOptionsMap> | ISeriesApiExtended,
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
  return decorateSeries(series as ISeriesApi<SeriesType>, legend);
}
export interface ISeriesIndicator extends ISeriesApi<"Line" | "Histogram" | "Area"> {
  sourceSeries: ISeriesApi<any>;
  indicator: IndicatorDefinition;
  figures: Map<string, ISeriesApi<"Line" | "Histogram" | "Area">>;
  paramMap: Record<string, any>; // Stores the current parameters used for calculation
  figureCount: number;            // NEW: stores the global figure count
  recalculate: (overrides?: Record<string, any>) => void;
}

export function decorateSeriesAsIndicator(
  series: ISeriesApi<"Line" | "Histogram" | "Area">,
  sourceSeries: ISeriesApi<any>,
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
      if (sourceSeries.data()[sourceSeries.data().length - 1].time > series.data()[series.data().length - 1].time) {
        recalculateIndicator(indicatorSeries);
      }
    });
  }

  return indicatorSeries;
}

export function recalculateIndicator(indicatorSeries: ISeriesIndicator, overrides?: Record<string, any>) {

  // Merge new overrides into the stored parameters to get the current parameters.
  const updatedParams = { ...indicatorSeries.paramMap, ...overrides };

  // Retrieve the source series data.
  const rawData = [...indicatorSeries.sourceSeries.data()];
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    return;
  }

  // If the raw data is already in OHLC format, use it;
  // otherwise, convert each data point using singleToOhlcData.
  let data: OhlcData[];
  if (rawData.every(isOHLCData)) {
    data = rawData as OhlcData[];
  } else {
    data = rawData.map(singleToOhlcData);
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

/**
 * Recalculates an indicator using PineTS code.
 *
 * This function assumes that the indicator definition contains a property "userCode"
 * (a string with the PineTS code) that, when executed, returns an object containing
 * plots, bars, and candles.
 *
 * @param indicatorSeries The ISeriesIndicator to recalculate.
 * @param overrides Optional object to override stored indicator parameters.
 */
export async function recalcIndicatorPineTS(
  indicatorSeries: ISeriesIndicator,
  overrides?: Record<string, any>
): Promise<void> {
  // Merge new overrides with the stored parameter map.
  const updatedParams = { ...indicatorSeries.paramMap, ...overrides };

  // Retrieve the source series data.
  const rawData = [...indicatorSeries.sourceSeries.data()];
  if (!rawData || rawData.length === 0) {
    console.warn("No source data available for indicator recalculation.");
    return;
  }

  // Convert data: if the raw data is not already in OHLC format, convert it.
  let data: OhlcData[];
  if (rawData.every(isOHLCData)) {
    data = rawData as OhlcData[];
  } else {
    data = rawData.map(singleToOhlcData);
  }

  // Optionally, if you have volume data available (e.g., via a volume series), you might extract it here.
  // For simplicity, we'll assume no volume data (or you can extend this as needed).

  // Create a PineTS instance using the transformed data.
  const pineTS = new PineTS(
    [...transformDataToArray(data)],

  );

  // Retrieve the user code from the indicator definition.
  // (Assume that the indicator definition has been augmented with a "userCode" property.)
  const userCode: string = (indicatorSeries.indicator as any).userCode;
  if (!userCode) {
    console.error("No PineTS code provided for indicator:", indicatorSeries.indicator.name);
    return;
  }

  // Build a dynamic function that will execute the user code.
  // The prefix sets up the common environment and the suffix returns the plots.
  const prefix = `(context) => {
    console.log("PineTS context received:", context);
    const { close, open, high, low, hlc3, volume, hl2, ohlc4 } = context.data;
    const { plot, plotchar, na } = context.core;
    const ta = context.ta;
    const math = context.math;
    const input = context.input;
  `;
  const suffix = "\nreturn { plots: context.plots, bars: context.bars, candles: context.candles };\n}";
  const fullCode = prefix + "\n" + userCode + "\n" + suffix;
  const indicatorFunction = new Function("context", fullCode);

  // Execute the PineTS code.
  const { result, plots } = await pineTS.run(indicatorFunction, undefined, true);
  console.log("PineTS execution completed successfully", "Result:", result, "Plots:", plots);

  // Collect all calculated figures from the three categories.
  const newFigures: IndicatorFigure[] = [];
  const processCategory = (category: any) => {
    if (category) {
      for (const key in category) {
        if (Object.prototype.hasOwnProperty.call(category, key)) {
          // Assume each figure includes a key, title, and data.
          newFigures.push(category[key]);
        }
      }
    }
  };
  processCategory(plots);


  // Update each existing indicator figure series.
  newFigures.forEach((newFigure) => {
    const existingSeries = indicatorSeries.figures.get(newFigure.key);
    if (existingSeries) {
      existingSeries.setData(newFigure.data);
      existingSeries.applyOptions({ title: newFigure.title });
      // If pane adjustment is needed:
      if (newFigure.pane) {
        const currentPane = existingSeries.getPane();
        const paneIndex = currentPane.paneIndex();
        existingSeries.moveToPane(paneIndex + newFigure.pane);
      }
    } else {
      // Optionally add new figure if it doesn't exist.
      // For example: indicatorSeries.figures.set(newFigure.key, createNewSeries(newFigure));
      console.warn(`No existing figure for key "${newFigure.key}".`);
    }
  });

  // Store the updated parameters for future recalculations.
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
    startIndex = startIndex ?? 0
    endIndex = endIndex ?? 0
    // Use the first bar's x-coordinate (alternatively, you might use an average).
    const x = bucket[0].x;
    const time = bucket[0].time
    // Optionally, you can convert prices to canvas coordinates.
    const open = (priceToCoordinate(openPrice) ?? 0) as Coordinate;
    const close = (priceToCoordinate(closePrice) ?? 0) as Coordinate;
    const high = (priceToCoordinate(highPrice) ?? 0) as Coordinate;
    const low = (priceToCoordinate(lowPrice) ?? 0) as Coordinate;

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
/**
 * Transforms an array of data objects (each containing at least a "time" field and OHLCV values)
 * into an array of objects with added "openTime" and "closeTime" fields.
 * If volume is missing on an item, it attempts to use a corresponding value from volumeData.
 *
 * @param data Array of data objects.
 * @param volumeData Array of volume data objects (optional).
 * @returns An array of transformed data objects.
 */
export function transformDataToArray(data: any[], volumeData: any[] = []): any[] {
  return data.map((item, idx) => {
    // Parse the "time" field into a timestamp.
    let parsedTime: number;
    if (typeof item.time === "number") {
      parsedTime = item.time;
    } else {
      parsedTime = new Date(item.time).getTime();
    }
    if (isNaN(parsedTime)) {
      console.warn(`Invalid time format: ${item.time}`);
      return null; // Skip this item if time is invalid.
    }

    return {
      ...item,
      openTime: parsedTime,
      closeTime: parsedTime + 86399, // 1 second (1000ms) before openTime.
      // Parse volume; if missing, try to use volumeData.
      volume: item.volume !== undefined
        ? Number(item.volume)
        : (volumeData[idx] !== undefined ? Number(volumeData[idx].value) : 0)
    };
  }).filter(item => item !== null);
}



export function isOHLCType(type: ISeriesApi<SeriesType>): boolean {
  return type.seriesType() === "Bar" || type.seriesType() === "Candlestick" || type.seriesType() === "Custom" && 'open' in type.data()[0]
}

/**
 * Prepares OHLC data from the plot object.
 *
 * @param baseData - Base market data (for time values).
 * @param data - Raw plot data.
 * @param type - The series type (with "Ohlc" treated as "Candlestick").
 * @returns Transformed data ready for an OHLC series.
 */
export function prepareOHLCData(
  baseData: Array<{ time: string | number }>,
  data: any[],
  type: "Line" | "Bar" | "Candlestick"
): any[] {
  const seriesData = data.map((pt, idx) => {
    if (
      pt.open !== undefined &&
      pt.high !== undefined &&
      pt.low !== undefined &&
      pt.close !== undefined
    ) {
      return {
        time: baseData[idx]?.time,
        open: pt.open,
        high: pt.high,
        low: pt.low,
        close: pt.close,
      };
    }
    return {
      time: baseData[idx]?.time,
      open: pt.value,
      high: pt.value,
      low: pt.value,
      close: pt.value,
    };
  });
  return type === "Line"
    ? seriesData.map((d) => ({ time: d.time, value: d.close }))
    : seriesData;
}

/**
 * Prepares single-value data for non-OHLC series.
 *
 * @param baseData - Base market data (for time values).
 * @param data - Raw plot data.
 * @param defaultColor - Default color if none provided.
 * @returns Transformed data for a single-value series.
 */
export function prepareSingleValueData(
  baseData: Array<{ time: string | number }>,
  data: any[],
  defaultColor?: string
): any[] {
  return data.map((pt, idx) => ({
    time: baseData[idx]?.time,
    value: pt.value,
    color: pt.color ?? defaultColor,
  }));
}
/**
 * Updates an existing plot (or adds it if missing) on the chart.
 *
 * This version drops the type argument. If the plot already exists,
 * it simply sets its data using the provided `plotObj.data`.
 *
 * @param handler     Your existing Handler instance.
 * @param mainSeries  The main (decorated) series used for obtaining time values.
 * @param plotName    The name of the plot (e.g. "Momentum", "Cross", etc.).
 * @param plotObj     The object returned by PineTS for this plot.
 */
export function updatePlotOnHandler(
  handler: Handler,
  plotName: string,
  plotObj: any
): void {
  if (handler.seriesMap.has(plotName)) {
    const existingSeries = handler.seriesMap.get(plotName);
    if (existingSeries) {
      // Simply update the series with the raw data provided.
      existingSeries.setData(plotObj.data);
    }
  } else {
    // If the series doesn't exist, delegate to addPlotToHandler.
    // Note: addPlotToHandler still defaults its type (e.g. "Line").
    addPlotToHandler(handler, plotName, plotObj);
  }
}

export function addPlotToHandler(
  handler: Handler,
  plotName: string,
  plotObj: any,
  type: SeriesType | "Ohlc" = "Line",
  mode: "overwrite" | "update" | "append" = "overwrite"
): void {
  const { data, group, options, pane } = plotObj;
  const extractedOptions = { ...extractPlotOptions(options) };

  if (group) {
    extractedOptions.group = group;
  }
  if (plotName) {
    extractedOptions.title = plotName;
  }
  const plotType = (extractedOptions.style === "circles" || extractedOptions.style === "cross")
    ? "Symbol"
    : type;

  const defaultOptions = getDefaultSeriesOptions(plotType as SeriesTypeEnum) || {};
  const fileDefaults = handler.defaultsManager.get(plotType) || {};

  let baseOptions = { ...defaultOptions, ...fileDefaults, ...extractedOptions };

  // If there is a style defined and it isn't 'line', rename it to 'shape'
  if (baseOptions.style && baseOptions.style !== "line") {
    baseOptions.shape = baseOptions.style;
    delete baseOptions.style;
  }
  const formattedData = data.map((item: any) => ({
    ...item,
    time: typeof item.time === "number" ? convertTime(item.time) : item.time,
  }));
  const existingSeries = handler.seriesMap.get(plotName);

  if (existingSeries && (mode === "overwrite" || mode === "update")) {

    if (mode === "update") {
      existingSeries.update(formattedData[formattedData.length - 1]);
      baseOptions = { ...baseOptions, ...existingSeries.options() }
    } else {
      existingSeries.detachPrimitives()
      existingSeries.setData(formattedData);
    }
    existingSeries.applyOptions(baseOptions);
    return;
  }

  // No existing series or different mode => create a new one
  let createdSeries: { name: string; series: ISeriesApiExtended } | null = null;

  // Choose the correct series factory based on the provided type.
  if (type === "Line") {
    // If the style is anything other than 'line', use the symbol series factory.
    if (extractedOptions.style !== "line") {
      createdSeries = handler.createSymbolSeries(
        plotName,
        { ...baseOptions, shape: extractedOptions.style },
        pane
      );
    } else {
      createdSeries = handler.createLineSeries(plotName, baseOptions, pane);
    }
  } else if (type === "Bar") {
    createdSeries = handler.createBarSeries(plotName, baseOptions, pane);
  } else if (
    type === "Candlestick" ||
    type === "Ohlc" ||
    (type === "Custom" && data[0]?.open !== undefined)
  ) {
    // If you have a custom createCustomOHLCSeries method:
    createdSeries = handler.createCustomOHLCSeries
      ? handler.createCustomOHLCSeries(plotName, baseOptions)
      : handler.createBarSeries(plotName, baseOptions, pane);
  } else if (type === "Histogram") {
    createdSeries = handler.createHistogramSeries(plotName, baseOptions, pane);
  } else if (type === "Area") {
    createdSeries = handler.createAreaSeries(plotName, baseOptions, pane);
  } else {
    console.warn(`Unsupported series type: ${type}. Defaulting to Line.`);
    createdSeries = handler.createLineSeries(plotName, baseOptions, pane);
  }

  // 1) Set the data on the newly created series
  createdSeries!.series.setData(formattedData);

  // 2) DECORATE the newly created series so that it has your extended applyOptions logic
  if (handler.legend && !createdSeries.series.decorated) {
    createdSeries!.series = decorateSeries(
      createdSeries!.series as ISeriesApi<SeriesType>,
      handler.legend
    );
  }

  // 3) Add the newly created (and decorated) series to the seriesMap.
  handler.seriesMap.set(plotName, createdSeries!.series);
}

// Example of extracting / normalizing user-supplied options
export function extractPlotOptions(options: any): any {
  const _options: any = {};
  for (const key in options) {
    // If it's an array, take the first element
    const value = Array.isArray(options[key]) ? options[key][0] : options[key];
    // If the key is "linewidth" (case-insensitive), rename to "lineWidth"
    if (key.toLowerCase() === "linewidth") {
      _options.lineWidth = value;
    } else {
      _options[key] = value;
    }
  }
  return _options;
}
export interface FillOptions {
  // Define fill options here.
  // For example:
  opacity?: number;
  color?: string;
  // etc.
}

/**
 * Creates or updates a fill area primitive between two series in the handler.
 *
 * @param handler - The chart handler managing the seriesMap.
 * @param originPlot - The title (or key) of the origin series (plot1).
 * @param destinationPlot - The title (or key) of the destination series (plot2).
 * @param options - Fill options that customize the fill area.
 * @param mode - Determines whether to "overwrite", "update", or "append" to an existing fill.
 */
export function addFillAreaToHandler(
  handler: Handler,
  fillObj: any,
): void {


  const { plot1, plot2, options } = fillObj;
  
  const fillOptions = defaultFillAreaOptions
  // Retrieve the origin and destination series from the handler's seriesMap.
  const originSeries = handler.seriesMap.get(plot1);
  const destinationSeries = handler.seriesMap.get(plot2);

  if (!originSeries) {
    console.warn(`Origin series with title "${plot1}" not found.`);
    return;
  }
  if (!destinationSeries) {
    console.warn(`Destination series with title "${plot2}" not found.`);
    return;
  }
  const fillKey = destinationSeries.options().title;
  let fillPrimitive: ISeriesPrimitive | null = null;
  // If a fill primitive already exists for this key, reuse it.
  if (originSeries.primitives[fillKey]) {
    fillPrimitive = originSeries.primitives[fillKey];
  } else {
    // Otherwise, create a new FillArea primitive.
    fillPrimitive = new FillArea(originSeries, destinationSeries, fillOptions);
    // Store the fill primitive using the composite key.
    originSeries.primitives[fillKey] = fillPrimitive;

    // Attach the fill area to the origin series.
    // The attached label includes an arrow and the destination series title.
    originSeries.attachPrimitive(
      fillPrimitive as ISeriesPrimitive,
      `Fill ➣ ${destinationSeries.options().title}`,
      false,
      true
    );
  }
}