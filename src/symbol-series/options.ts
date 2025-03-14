import {
	CustomSeriesOptions,
	LineStyle,
	LineWidth,
	customSeriesDefaultOptions,
} from 'lightweight-charts';

export interface SymbolSeriesOptions extends CustomSeriesOptions {
	color: string;               // Color for the connecting line (if join=true)
	lineWidth: LineWidth;               // Width for the connecting line
	lineStyle?: LineStyle // Basic line style
	shapeSize?: number;              // Radius if circle, font size if text, etc.
	shape?: 'circles' | 'cross' | 'triangleUp' | 'triangleDown' | 'arrowUp' | 'arrowDown' | string 
	join?: boolean;
	fontSize?: number;
}

export const defaultSymbolSeriesOptions: SymbolSeriesOptions = {
	...customSeriesDefaultOptions,
	color: '#049981',
	lineWidth: 1 as LineWidth,
	lineStyle: LineStyle.Solid,
	shapeSize: .3,
	shape: 'circles',
	join: false,          // Default to connecting points with a line
	fontSize: .8,

} as const;




export interface ShapeOptions {
	shape: 'circles' | 'cross' | 'triangleUp' | 'triangleDown' | 'arrowUp' | 'arrowDown' | string 
	shapeSize: number;
	fillColor: string;
	borderColor?: string;
	lineWidth?: number;
	textAlign?: CanvasTextAlign;
	textBaseline?: CanvasTextBaseline;
	fontSize?: number;
}
export const defaultShapeOptions: ShapeOptions = {
	shape: 'circles',
	shapeSize: .3,
	fillColor: '#2f0afc',
	borderColor: '#ffffff', // no outline by default
	lineWidth: 1,
	textAlign: 'center',
	textBaseline: 'middle',
	fontSize: .8,
};