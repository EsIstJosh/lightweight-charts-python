import { DrawingPaneRenderer } from '../drawing/pane-renderer';
import { ViewPoint } from '../drawing/pane-view';
import { DrawingOptions } from '../drawing/options';
import { PointMarkerOptions } from './point-marker';
import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { InteractionState } from '../drawing/drawing';

export class PointMarkerPaneRenderer extends DrawingPaneRenderer {
    _point: ViewPoint;
    _hovered: boolean;

    constructor(point: ViewPoint, options: DrawingOptions, hovered: boolean) {
        super(options);
        this._point = point;
        this._hovered = hovered;
    }

    draw(target: CanvasRenderingTarget2D): void {
        if (this._point.x === null || this._point.y === null) return;

        const options = this._options as PointMarkerOptions;
        
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const x = Math.round((this._point.x ?? 0) * scope.horizontalPixelRatio);
            const y = Math.round((this._point.y ?? 0) * scope.verticalPixelRatio);
            
            // Draw the marker
            ctx.beginPath();
            
            const radius = options.radius * scope.horizontalPixelRatio;
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            
            // Fill
            ctx.fillStyle = options.fillColor;
            ctx.fill();
            
            // Border
            ctx.lineWidth = 1 * scope.horizontalPixelRatio;
            ctx.strokeStyle = options.lineColor;
            ctx.stroke();
            
            // If hovered, draw a highlight
            if (this._hovered) {
                ctx.beginPath();
                ctx.arc(x, y, radius + 2 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1 * scope.horizontalPixelRatio;
                ctx.stroke();
            }
        });
    }
}