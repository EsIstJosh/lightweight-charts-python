import { ISeriesApi, SeriesType, LineStyle, IChartApi, Logical, MouseEventParams, Coordinate, LineSeries, Time } from "lightweight-charts";
import { ISeriesApiExtended} from "./series";
import { Point as LogicalPoint } from "../drawing/data-source";
import { Point as CanvasPoint } from "lightweight-charts";
import { PluginBase } from "../plugin-base";
import { TrendTrace } from "../trend-trace/trend-trace";


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



export function _measureLogicalRange(chart: IChartApi): { from: Logical; to: Logical } | null {
  if (!chart) return null;
  const timeScale = chart.timeScale();
  const visibleLogicalRange = timeScale.getVisibleLogicalRange();
  if (!visibleLogicalRange) return null;
  return {
      from: visibleLogicalRange.from,
      to: visibleLogicalRange.to,
  };
}
export function _measurePriceRange(chart: IChartApi, series?: ISeriesApi<SeriesType>): { max: number; min: number } | null {
  if (!chart ) return null;
  if (!series){
    const series= chart.addSeries(LineSeries,)
  }
  const paneSize = chart.paneSize();
  const max = series!.coordinateToPrice(0);
  const min = series!.coordinateToPrice(paneSize.height);
  if (max === null || min === null) return null;
  return {
      max,
      min,
  };
}
/**
 * Converts the mouse event parameters into a LogicalPoint.
 */
export function eventToLogicalPoint(
  param: MouseEventParams,
  chart: IChartApi,
  series?: ISeriesApi<any>
): LogicalPoint | null {
  if (!chart || !param.point || !param.logical) return null;
  if (!series){
    const series= chart.addSeries(LineSeries,)
  }
  const price = series!.coordinateToPrice(param.point.y);
  if (price === null) return null;
  return {
    time:chart.timeScale().coordinateToTime(param.point?.x),
    logical: param.logical,
    price,
  };
}

/**
 * Given a target LogicalPoint, a tolerance factor (for example, 0.05 means 5%),
 * the chart, the series, and the current MouseEventParams, this function checks
 * whether the current mouse event is “close” to the target. The idea is to compute
 * the visible logical and price spans and then use the tolerance factor to derive a
 * threshold for each.
 *
 * @param target The LogicalPoint (for example, an endpoint) to test.
 * @param toleranceFactor A fraction (e.g. 0.05 for 5%) of the visible span.
 * @param chart The chart API.
 * @param series The series API used for the price conversion.
 * @param param The MouseEventParams from the chart.
 * @returns True if the mouse event’s logical and price are within the tolerance thresholds.
 */
/**
 * Measures the visible pane size from the chart.
 */
export function _measurePaneSize(chart: IChartApi): { width: number; height: number } | null {
  if (!chart) return null;
  const paneSize = chart.paneSize();
  return {
      width: paneSize.width,
      height: paneSize.height,
  };
}

/**
* Converts MouseEventParams to canvas coordinates.
*/
export function eventToCanvasPoint(
  event: MouseEvent,
  chart: IChartApi
): CanvasPoint | null {
  if (!event) return null;
  return {
    x: event.x as Coordinate,
    y: event.y as Coordinate,
  };
}
// Helper: convert the input (which may be MouseEventParams or a native MouseEvent)
// to a CanvasPoint. If the input has a 'point' property already, we use that;
// otherwise, if it’s a MouseEvent, we convert it.
function getCanvasCoordinates(
  input: MouseEventParams | MouseEvent,
  chart: IChartApi
): CanvasPoint | null {
  // Check if input is a native MouseEvent by testing for the existence
  // of the "target" property from the DOM event
  if (input instanceof MouseEvent) {
    return eventToCanvasPoint(input, chart);
  }
  // Else, if it’s MouseEventParams and has a "point" property, assume that’s in canvas space.
  if ("point" in input && input.point) {
    return input.point;
  }
  return null;
}
/**
 * Determines if the target CanvasPoint is close to the mouse position within the tolerance factor.
 *
 * @param input - A MouseEvent or MouseEventParams object.
 * @param target - The CanvasPoint (or ViewPoint) to compare against.
 * @param toleranceFactor - Fraction of the visible spans (for example, 0.05 for 5%).
 * @param chart - The chart instance.
 * @returns True if within tolerance; otherwise, false.
 */
export function isPointCloseCanvas(
  input: MouseEvent | MouseEventParams,
  target: CanvasPoint,
  toleranceFactor: number,
  chart: IChartApi
): boolean {
  const paneSize = _measurePaneSize(chart);
  if (!paneSize) return false;

  // Compute visible spans from the pane
  const visibleWidth = paneSize.width;
  const visibleHeight = paneSize.height;

  // Set tolerance thresholds (in canvas coordinate units)
  const xTolerance = visibleWidth * toleranceFactor;
  const yTolerance = visibleHeight * toleranceFactor;

  // Get the canvas point from the input
  const mousePoint = getCanvasCoordinates(input, chart);
  if (!mousePoint || mousePoint.x == null || mousePoint.y == null ||
      target.x == null || target.y == null) {
    return false;
  }

  // Compute the differences in canvas space
  const dx = Math.abs(target.x - mousePoint.x);
  const dy = Math.abs(target.y - mousePoint.y);

  return dx <= xTolerance && dy <= yTolerance;
}


/**
 * Determines if the target LogicalPoint is close to the mouse position within the tolerance factor.
 *
 * @param param - MouseEventParams from the chart.
 * @param target - The LogicalPoint to compare against.
 * @param toleranceFactor - Fraction of the visible spans (e.g., 0.05 for 5%).
 * @param chart - The chart instance.
 * @param series - The series instance used for price conversions.1111
 * @returns True if within tolerance; otherwise, false.
 */
export function isPointCloseLogical(
  param: MouseEventParams,
  target: LogicalPoint,
  toleranceFactor: number,
  chart: IChartApi,
  series?: ISeriesApiExtended
): boolean {
  const visibleLogical = _measureLogicalRange(chart);
  const visiblePrice = _measurePriceRange(chart, series);
  if (!visibleLogical || !visiblePrice) {
      return false;
  }

  // Compute visible spans
  const visibleLogicalSpan = Math.abs(visibleLogical.to - visibleLogical.from);
  const visiblePriceSpan = Math.abs(visiblePrice.max - visiblePrice.min);

  // Set tolerance thresholds
  const logicalTolerance = visibleLogicalSpan * toleranceFactor;
  const priceTolerance = visiblePriceSpan * toleranceFactor;

  // Convert mouse event to logical point
  const mousePoint = eventToLogicalPoint(param, chart, series);
  if (!mousePoint) return false;

  // Compute absolute differences
  const logicalDiff = Math.abs(target.logical - mousePoint.logical);
  const priceDiff = Math.abs(target.price - mousePoint.price);

  return logicalDiff <= logicalTolerance && priceDiff <= priceTolerance;
}
// A helper that "normalizes" either a MouseEventParams or a LogicalPoint 
// into a LogicalPoint.
export function toLogicalPoint(
  input: MouseEventParams | LogicalPoint,
  series: ISeriesApi<any>
): LogicalPoint | null {
  // If input is MouseEventParams (we check for the presence of a "point" property)
  if ('point' in input) {
    const params = input as MouseEventParams;
    if (!params.point || !params.logical) return null;
    const price = series.coordinateToPrice(params.point.y);
    if (price === null) return null;
    return {
      time: params.time || null,
      logical: params.logical,
      price: price.valueOf(),
    };
  }
  // Otherwise assume it is already a LogicalPoint
  return input as LogicalPoint;
}


export class OffsetPoint implements LogicalPoint {
  /**
   * Constructs an OffsetPoint.
   *
   * @param basePoint - The original point.
   * @param xOffset - Optional horizontal offset to apply to the logical value (defaults to 0).
   * @param yOffset - Optional vertical offset to apply to the price (defaults to 0).
   */
  constructor(
    private basePoint: LogicalPoint,
    private xOffset: number = 0,
    private yOffset: number = 0
  ) {}

  /**
   * Returns the original time value.
   */
  get time(): Time | null {
    return this.basePoint.time;
  }

  /**
   * Returns the logical value with the xOffset applied.
   */
  get logical(): Logical {
    return (Math.round(this.basePoint.logical + this.xOffset)) as Logical;
  }

  /**
   * Returns the price with the yOffset applied.
   */
  get price(): number {
    return this.basePoint.price + this.yOffset;
  }
}
export const PluginRegistry: { [key: string]: new (...args: any[]) => PluginBase } = {
  "TrendTrace": TrendTrace,
  // Add other plugin types as needed...
};



/**
 * Returns the number of sequential NaN values at the beginning of an array.
 *
 * This function iterates over the array from the start until the first non-NaN value is encountered.
 *
 * @param data - An array of numbers that may contain NaN values.
 * @returns The count of consecutive NaN values from the start of the array.
 */
export function getLeadingNaNCount(data: any[]): number {
  let count = 0;
  for (const point of data) {
    // Check if the point exists and its 'value' field is NaN.
    if (point && Number.isNaN(point.value)) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
