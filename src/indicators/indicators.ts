// =========================
//  Basic Data Interfaces
// =========================

import { SingleValueData, BarData, CandlestickData, OhlcData, HistogramData } from "lightweight-charts";
import { OVERLAYS} from "./overlay";
import { OSCILLATORS } from "./oscillators";
/**
 * One indicator can produce multiple figures (lines or histograms).
 */

export interface IndicatorFigure {
  key: string;      // e.g. "ema12", "hh14", etc.
  title: string;    // e.g. "EMA12", "HH14"
  type: "line" | "histogram";
  data: SingleValueData[];
  pane?: number 
}


/**
 * For each parameter we store a default value plus metadata.
 * The type now supports both single values and arrays:
 * "number", "select", "boolean", "string",
 * "numberArray", "selectArray", "booleanArray", "stringArray".
 */
export interface IndicatorParamSpec {
    defaultValue: any;
    type: "number" | "select" | "boolean" | "string" |
          "numberArray" | "selectArray" | "booleanArray" | "stringArray";
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  }
  
/** 
 * A single indicator definition.
 */
export interface IndicatorDefinition {
  name: string;
  shortName: string;
  /** Whether it needs OHLC data or can rely on single-value. */
  shouldOhlc: boolean;
  paramMap: Record<string, IndicatorParamSpec>;
  calc(
    dataList: (BarData | CandlestickData | OhlcData)[],
    overrideParams?: Record<string, any>,
    volumeData?: SingleValueData[] | HistogramData[]
  ): IndicatorFigure[];
}



/** 
 * A single indicator definition.
 * paramMap: { [paramName]: IndicatorParamSpec } 
 */
export interface IndicatorDefinition {
  name: string;
  shortName: string;
  /** Whether it needs open/high/low/close or can rely on single-value. */
  shouldOhlc: boolean;  
  /** The default numeric parameters, each described by a small spec. */
  paramMap: Record<string, IndicatorParamSpec>;

  /**
   * The main calculation. Accept an optional overrides object 
   * with numeric values for each param key. 
   */
  calc(
    dataList: (BarData | CandlestickData | OhlcData)[],
    overrideParams?: Record<string, any>,
    volumeData?: SingleValueData[]|HistogramData[]
  ): IndicatorFigure[];
}

export const INDICATORS: IndicatorDefinition[] = [ ...OVERLAYS, ...OSCILLATORS]
