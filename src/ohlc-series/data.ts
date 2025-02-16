import {
    CandlestickData,
    Time,
	LineStyle,
	LineWidth
} from 'lightweight-charts';

export interface ohlcSeriesData extends CandlestickData {
    time: Time;       // The time of the candle, typically required by the chart
    open: number;     // Opening price
    high: number;     // Highest price
    low: number;      // Lowest price
    close: number;    // Closing price
	volume: number;
	newBar?: boolean;
    // Optional customization properties
    color?: string;         // Optional fill color for the candle body
    borderColor?: string;   // Optional color for the candle border
    wickColor?: string;     // Optional color for the candle wicks
    shape?: string;         // Optional shape (e.g., 'Rectangle', 'Rounded', 'Ellipse', 'Arrow', '3d', 'Polygon')
    lineStyle?: number;     // Optional line style (e.g., solid, dashed)
    lineWidth?: number;     // Optional line width for the border or wick
}
/**
 * Enumeration for different candle shapes.
 */
export enum CandleShape {
	Rectangle = 'Rectangle',
	Rounded = 'Rounded',
	Ellipse = 'Ellipse',
	Arrow = 'Arrow',
	Cube =  '3d',
	Polygon = 'Polygon',
	Bar = 'Bar',
	Slanted = "Slanted"
  }
  
  /**
   * Enumeration for different line styles.
   */

  
  /**
   * Interface representing the original data of a bar.
   */
  export interface BarOriginalData {
	open: number;
	high: number;
	low: number;
	close: number;
	volume?:number;
	newBar?: boolean;
	lineStyle: LineStyle;
	lineWidth: number;
	shape: CandleShape;
	color: string;
	borderColor: string;
	wickColor: string;
  }
  
  /**
   * Interface representing a bar item used in rendering.
   */
  export interface BarItem {
	open: number;
	high: number;
	low: number;
	close: number;
	volume?:number;
	newBar?:boolean;
	x: number;
	isUp: boolean;
	startIndex: number;
	endIndex: number;
	isInProgress?: boolean;
	color: string;
	borderColor: string;
	wickColor: string;
	originalData?: BarOriginalData;
	lineStyle: LineStyle;
	lineWidth: number;
	shape: CandleShape;

  }
  

  
  export function parseCandleShape(input: string): CandleShape | undefined {
	switch (input.trim().toLowerCase()) {
		case 'rectangle':
			return CandleShape.Rectangle;
		case 'rounded':
			return CandleShape.Rounded;
		case 'ellipse':
			return CandleShape.Ellipse;
		case 'arrow':
			return CandleShape.Arrow;
		case '3d':
			return CandleShape.Cube;
		case 'polygon':
			return CandleShape.Polygon;
		case 'bar':
			return CandleShape.Bar;

		case 'slanted':
			return CandleShape.Slanted;
		default:
			console.warn(`Unknown CandleShape: ${input}`);
			return CandleShape.Rectangle;
	}
}