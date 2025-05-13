import { ISeriesApi, SeriesType, ISeriesPrimitive, AreaStyleOptions, BarStyleOptions, DeepPartial, HistogramStyleOptions, LineStyleOptions, SeriesOptionsCommon, LineStyle } from "lightweight-charts";
import { Legend } from "../general/legend";
import { ohlcSeriesOptions } from "../ohlc-series/ohlc-series";
import { convertDataItem, SupportedSeriesType } from "./series";

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
        const legendEntry = legend.findLegendPrimitive(original as ISeriesApi<any>, primitive);
        if (legendEntry) {
      legend.removeLegendPrimitive(primitive);
          console.log(`Removed primitive of type "${primitive.constructor.name}" from legend.`);
        }
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
    

/**
 * Converts a string or numeric style to the numeric LineStyle enum from Lightweight Charts.
 */
export function parseLineStyle(style: string | number): LineStyle {
  // If it's already numeric and valid, just return it.
  if (typeof style === 'number' && style in LineStyle) {
    return style as LineStyle;
  }

  // Otherwise, map strings to numeric values
  switch (style) {
    case 'Solid':         return LineStyle.Solid;
    case 'Dotted':        return LineStyle.Dotted;
    case 'Dashed':        return LineStyle.Dashed;
    case 'Large Dashed':  return LineStyle.LargeDashed;
    case 'Sparse Dotted': return LineStyle.SparseDotted;
    default:
      console.warn(`Unknown line style "${style}", defaulting to Solid.`);
      return LineStyle.Solid;
  }
}