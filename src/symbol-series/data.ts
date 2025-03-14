import { CustomData } from 'lightweight-charts';
import { ShapeOptions } from './options';

/**
 * Generic symbol series data interface.
 * 
 * @template TValue - Type of the value property (default: number)
 * @template TShapeOptions - Type of the shapeOptions property (default: ShapeOptions)
 */
export interface SymbolSeriesData<TValue = number, TShapeOptions = ShapeOptions> extends CustomData {
	value: TValue;
	/** Optional shape configuration for this specific bar */
	shapeOptions?: TShapeOptions;
}
