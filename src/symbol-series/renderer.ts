import {
	BitmapCoordinatesRenderingScope,
	CanvasRenderingTarget2D,
} from 'fancy-canvas';
import {
	ICustomSeriesPaneRenderer,
	LineStyle,
	PaneRendererCustomData,
	PriceToCoordinateConverter,
	Time,
} from 'lightweight-charts';
import { SymbolSeriesData } from './data';
import { ShapeOptions, SymbolSeriesOptions } from './options';
import { setLineStyle } from '../helpers/canvas-rendering';
import { setOpacity } from '../helpers/colors';

interface SimpleValuePoint {
	x: number;
	y: number;
	shape?: string;
}

export class SymbolSeriesRenderer<TData extends SymbolSeriesData>
	implements ICustomSeriesPaneRenderer
{
	_data: PaneRendererCustomData<Time, TData> | null = null;
	_options: SymbolSeriesOptions | null = null;
/** Called by Lightweight Charts when it needs to draw your custom series */
public draw(
	target: CanvasRenderingTarget2D,
	priceConverter: PriceToCoordinateConverter
): void {
	// Use the "bitmap coordinate space" for crisp lines and correct scaling
	target.useBitmapCoordinateSpace((scope) => {
		this._drawImpl(scope, priceConverter);
	});
}

/** Called by Lightweight Charts when the data or options update */
public update(
	data: PaneRendererCustomData<Time, TData>,
	options: SymbolSeriesOptions
): void {
	this._data = data;
	this._options = options;
}



private _drawImpl(
		renderingScope: BitmapCoordinatesRenderingScope,
		priceToCoordinate: PriceToCoordinateConverter
	): void {


		const barSpace = this._data?.barSpacing?? 0.8
		// If we have no data or the visible range is empty, do nothing
		if (
			this._data === null ||
			this._data.bars.length === 0 ||
			this._data.visibleRange === null ||
			this._options === null
		) {
			return;
		}

    const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;
    const { visibleRange } = this._data;
    const { color,  lineWidth, lineStyle, join, shape, shapeSize, fontSize} = this._options;

		// ---------------------------
		// 1) DRAW CONNECTING LIN
		// ---------------------------
		// Convert bars -> points
		const points: SimpleValuePoint[] = this._data.bars.map((bar) => {
			const x = bar.x * horizontalPixelRatio;
			const y = priceToCoordinate(bar.originalData.value)! * verticalPixelRatio;
			return { x, y };
		});
		ctx.save();
		ctx.lineJoin = 'round';
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth * verticalPixelRatio;


		setLineStyle(ctx, lineStyle as LineStyle);
		ctx.beginPath();
		const firstIndex = visibleRange.from;
		const lastIndex = visibleRange.to - 1;

    // Move to first visible point
    ctx.moveTo(points[firstIndex].x, points[firstIndex].y);

    // Draw lines to the rest
    for (let i = firstIndex + 1; i <= lastIndex; i++) {
        if (join) {
            ctx.lineTo(points[i].x, points[i].y);
        }
    }

    ctx.stroke();
    ctx.restore();
	// When drawing a shape, scale its size by the ratio of the current barSpace to DEFAULT_BAR_SPACE.
	const originalShapeSize = shapeSize ?? .8;
	const scaledShapeSize = originalShapeSize * barSpace;
    // ---------------------------
    // 2) DRAW SHAPES (if enabled)
    // ---------------------------
        const globalShapeDefault: ShapeOptions = {
            shape: shape as string,
            shapeSize: scaledShapeSize??1,
            fillColor: setOpacity(color,0.5) ,
            borderColor: color,
            lineWidth: lineWidth,
            textAlign: 'center',
            textBaseline: 'middle',
			fontSize: (fontSize??1)* barSpace,
        };

        const bars = this._data.bars;
        for (let i = firstIndex; i <= lastIndex; i++) {
            const bar = bars[i];
            const x = bar.x * horizontalPixelRatio;
            const y = priceToCoordinate(bar.originalData.value)! * verticalPixelRatio;

            const barShapeOpts = (bar.originalData as any).shapeOptions ?? {};
			const originalShapeSize = barShapeOpts.shapeSize ?? null;
			const barShapeSize = (originalShapeSize!== null) ? originalShapeSize * barSpace : scaledShapeSize;

            const mergedOptions: ShapeOptions = {
                ...globalShapeDefault,
                ...barShapeOpts,
				shapeSize: barShapeSize,
            };

            this._drawShape(ctx, x, y, mergedOptions);
        }
    
}

	/**
	 * Draw a shape at (x, y) using the specified options.
	 */
	private _drawShape(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		opts: ShapeOptions
	): void {
		ctx.save();

		const {
			shape,
			shapeSize ,
			fillColor,
			borderColor,
			lineWidth = 1,
			textAlign = 'center',
			textBaseline = 'middle',
			fontSize = 1
		} = opts;

		ctx.fillStyle = fillColor?? this._options?.color;
		ctx.strokeStyle = borderColor ?? fillColor?? this._options?.color;
		ctx.lineWidth = lineWidth;
		ctx.textAlign = textAlign;
		ctx.textBaseline = textBaseline;
		ctx.font = `${fontSize}px sans-serif`;

		switch (shape) {
			case 'circles': {
				ctx.beginPath();
				ctx.arc(x, y, shapeSize / 2, 0, 2 * Math.PI);
				ctx.fill();
				if (borderColor) {
					ctx.stroke();
				}
				break;
			}
			case 'cross': {
				// Overall size and arm thickness.
				const half = shapeSize / 2;
				const t = shapeSize / 3; // thickness of the arms
			  
				// Define vertices for the outer border of a plus shape.
				// The polygon starts at the top middle and goes clockwise.
				ctx.beginPath();
				ctx.moveTo(x - t / 2, y - half);        // Vertex 1: left of top edge
				ctx.lineTo(x + t / 2, y - half);        // Vertex 2: right of top edge
				ctx.lineTo(x + t / 2, y - t / 2);         // Vertex 3: top-right inner corner
				ctx.lineTo(x + half, y - t / 2);        // Vertex 4: right of upper arm
				ctx.lineTo(x + half, y + t / 2);        // Vertex 5: right of lower arm
				ctx.lineTo(x + t / 2, y + t / 2);         // Vertex 6: bottom-right inner corner
				ctx.lineTo(x + t / 2, y + half);        // Vertex 7: right of bottom edge
				ctx.lineTo(x - t / 2, y + half);        // Vertex 8: left of bottom edge
				ctx.lineTo(x - t / 2, y + t / 2);         // Vertex 9: bottom-left inner corner
				ctx.lineTo(x - half, y + t / 2);        // Vertex 10: left of lower arm
				ctx.lineTo(x - half, y - t / 2);        // Vertex 11: left of upper arm
				ctx.lineTo(x - t / 2, y - t / 2);         // Vertex 12: top-left inner corner
				ctx.closePath();
			  
				// Fill the plus shape.
				ctx.fill();
			  
				// Stroke only the outer border if a border color is provided.
				if (borderColor) {
				  ctx.stroke();
				}
				break;
			  }
			  
			  
			  
			case 'triangleUp': {
				const half = shapeSize / 2;
				ctx.beginPath();
				ctx.moveTo(x, y - half);        // top
				ctx.lineTo(x - half, y + half); // bottom left
				ctx.lineTo(x + half, y + half); // bottom right
				ctx.closePath();
				ctx.fill();
				if (borderColor) {
					ctx.stroke();
				}
				break;
			}
			case 'triangleDown': {
				const half = shapeSize / 2;
				ctx.beginPath();
				ctx.moveTo(x, y + half);          // bottom
				ctx.lineTo(x - half, y - half);   // top left
				ctx.lineTo(x + half, y - half);   // top right
				ctx.closePath();
				ctx.fill();
				if (borderColor) {
					ctx.stroke();
				}
				break;
			}
			case 'arrowUp': {
				const arrowHeight = shapeSize; // Overall arrow height.
				const headHeight = arrowHeight * 0.4; // Arrow head is 40% of overall height.
				const shaftWidth = shapeSize / 3;    // Shaft width is 1/3 of shapeSize.
				const halfShaft = shaftWidth / 2;
			  
				// Define vertical positions:
				const tipY = y - arrowHeight / 2;        // Top tip of the arrow.
				const headBaseY = tipY + headHeight;       // Bottom of the arrow head.
				const baseY = y + arrowHeight / 2;         // Bottom of the arrow (end of shaft).
			  
				ctx.beginPath();
				ctx.moveTo(x, tipY);
				ctx.lineTo(x + headHeight, headBaseY);
				ctx.lineTo(x + halfShaft, headBaseY);
				ctx.lineTo(x + halfShaft, baseY);
				ctx.lineTo(x - halfShaft, baseY);
				ctx.lineTo(x - halfShaft, headBaseY);
				ctx.lineTo(x - headHeight, headBaseY);
				ctx.closePath();
				ctx.fill();
				if (borderColor) {
				  ctx.stroke();
				}
				break;
			  }
			  case 'arrowDown': {
				const arrowHeight = shapeSize;
				const headHeight = arrowHeight * 0.4;
				const shaftWidth = shapeSize / 3;
				const halfShaft = shaftWidth / 2;
			  
				// For arrowDown, tip is at the bottom.
				const tipY = y + arrowHeight / 2;
				const headBaseY = tipY - headHeight;
				const baseY = y - arrowHeight / 2;
			  
				ctx.beginPath();
				ctx.moveTo(x, tipY);
				ctx.lineTo(x + headHeight, headBaseY);
				ctx.lineTo(x + halfShaft, headBaseY);
				ctx.lineTo(x + halfShaft, baseY);
				ctx.lineTo(x - halfShaft, baseY);
				ctx.lineTo(x - halfShaft, headBaseY);
				ctx.lineTo(x - headHeight, headBaseY);
				ctx.closePath();
				ctx.fill();
				if (borderColor) {
				  ctx.stroke();
				}
				break;
			  }
			  
			default: {
				// Fallback: treat shape as text
				ctx.fillText(shape, x, y, this._data?.barSpacing?? 0.8);	
				break;
			}
		}

		ctx.restore();
	}
}