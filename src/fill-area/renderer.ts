import { CanvasRenderingTarget2D } from "fancy-canvas";
import { IPrimitivePaneRenderer } from "lightweight-charts";
import { BandRendererData, BandViewData, FillAreaOptions } from "./fill-area";

export class FillAreaPaneRenderer implements IPrimitivePaneRenderer {
    _viewData: BandViewData;
    _options: FillAreaOptions;

    constructor(data: BandViewData) {
        this._viewData = data;
        this._options = data.options;
    }

    draw() {}
    drawBackground(target: CanvasRenderingTarget2D) {
        const points: BandRendererData[] = this._viewData.data;
        const options = this._options;

        if (points.length < 2) return; // Ensure there are enough points to draw

        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);

            let currentPathStarted = false;
            let startIndex = 0;

            for (let i = 0; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];

                if (!currentPathStarted || current.isOriginAbove !== points[i - 1]?.isOriginAbove) {
                    if (currentPathStarted) {
                        for (let j = i - 1; j >= startIndex; j--) {
                            ctx.lineTo(points[j].x, points[j].destination);
                        }
                        ctx.closePath();
                        ctx.fill();
                    }

                    ctx.beginPath();
                    ctx.moveTo(current.x, current.origin);

                    ctx.fillStyle = current.isOriginAbove
                        ? options.originColor || 'rgba(0, 0, 0, 0)' // Default to transparent if null
                        : options.destinationColor || 'rgba(0, 0, 0, 0)'; // Default to transparent if null

                    startIndex = i;
                    currentPathStarted = true;
                }

                ctx.lineTo(next.x, next.origin);

                if (i === points.length - 2 || next.isOriginAbove !== current.isOriginAbove) {
                    for (let j = i + 1; j >= startIndex; j--) {
                        ctx.lineTo(points[j].x, points[j].destination);
                    }
                    ctx.closePath();
                    ctx.fill();
                    currentPathStarted = false;
                }
            }

            if (options.lineWidth) {
                ctx.lineWidth = options.lineWidth;
                ctx.strokeStyle = options.originColor || 'rgba(0, 0, 0, 0)';
                ctx.stroke();
            }
        });
    }
}
