import { ISeriesApi, SeriesType, ISeriesPrimitive, AreaStyleOptions, BarStyleOptions, DeepPartial, HistogramStyleOptions, LineStyleOptions, SeriesOptionsCommon } from "lightweight-charts";
import { Legend } from "../general/legend";
import { ohlcSeriesOptions } from "../ohlc-series/ohlc-series";

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
    const originalSetData = original.setData.bind(original);
  
    // Array to store attached primitives
    const primitives: ISeriesPrimitive[] = [];
  
    // Reference to the most recently attached primitive
    let lastAttachedPrimitive: ISeriesPrimitive | null = null;
  
    // Hook into the original `detachPrimitive` if it exists
    const originalDetachPrimitive = (original as any).detachPrimitive?.bind(original);
    const originalAttachPrimitive = (original as any).attachPrimitive?.bind(original);
  
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
        legend.addLegendPrimitive(original, primitive, name);
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
        const legendEntry = legend.findLegendPrimitive(original, primitive);
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
      for (const peer of peers) {
        peer.setData(data);
      }
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
    