import { Logical, IChartApi, ISeriesApi, SeriesType, Point as CanvasPoint, Time, LineSeries } from "lightweight-charts";
import { Point as LogicalPoint } from "../drawing/data-source";
export function buildOptions(optionPath: string, value: any): any {
  const keys = optionPath.split(".");
  const options: any = {};
  let current = options;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      current[key] = {};
      current = current[key];
    }
  }

  return options;
}


/**
 * Utility function to convert camelCase to Title Case
 * @param inputString The camelCase string.
 * @returns The Title Case string.
 */
export function camelToTitle(inputString: string): string {
  return inputString
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}





/**
 * Converts points between DrawingPoint (logical/price coordinates)
 * and CanvasPoint (pixel coordinates).
 *
 * @param point - A DrawingPoint or a CanvasPoint.
 * @param chart - The chart API providing time scale conversions.
 * @param series - The series API for y-axis conversions (price ↔ canvas coordinates).
 * @returns The converted point or null if conversion fails.
 */
export function convertPoint(
  point: LogicalPoint | CanvasPoint,
  chart: IChartApi,
  series?: ISeriesApi<SeriesType>
): LogicalPoint | CanvasPoint | null {
  const timeScale = chart.timeScale();
  const targetSeries = series ?? chart.addSeries(LineSeries,); // Fallback to adding a new series if one wasn't provided

  if (!targetSeries) {
    console.warn('No series found. Cannot perform y-axis conversions.');
    return null;
  }

  // Determine if the input point is a DrawingPoint by checking for the "logical" property.
  const isDrawingPoint = 'logical' in point;

  if (isDrawingPoint) {
    // Convert DrawingPoint to CanvasPoint:
    const drawingPoint = point as LogicalPoint;
    const canvasX = timeScale.logicalToCoordinate(drawingPoint.logical);
    const canvasY = targetSeries.priceToCoordinate(drawingPoint.price);
    if (canvasX === null || canvasY === null) return null;
    return { x: canvasX, y: canvasY } as CanvasPoint;
  } else {
    // Convert CanvasPoint to DrawingPoint:
    const canvasPoint = point as CanvasPoint;
    const logical = timeScale.coordinateToLogical(canvasPoint.x);
    const time = timeScale.coordinateToTime(canvasPoint.x)
    const price = targetSeries.coordinateToPrice(canvasPoint.y);
    if (logical === null || price === null) return null;
    // Note: Since the original DrawingPoint interface optionally includes a time property,
    // we are returning an object with just logical and price.
    return { time, logical, price } as LogicalPoint;
  }
}/**
 * Converts an object to JSON while filtering out circular references.
 * This helper uses a WeakSet to track seen objects.
 *
 * @param obj The object to stringify.
 * @returns A JSON string.
 */
export function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          // If this value is already seen, return undefined to omit it.
          return;
        }
        seen.add(value);
      }
      return value;
    },
    2
  );
}
