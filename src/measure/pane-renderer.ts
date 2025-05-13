import { ViewPoint } from "../drawing/pane-view";
import { CanvasRenderingTarget2D } from "fancy-canvas";
import { TwoPointDrawingPaneRenderer } from "../drawing/pane-renderer";
import { MeasureOptions } from "./measure";
import { setLineStyle } from "../helpers/canvas-rendering";
import { IChartApi, ISeriesApi, SeriesOptionsMap } from "lightweight-charts";
import { BoxOptions } from "../box/box";

export class MeasurePaneRenderer extends TwoPointDrawingPaneRenderer {
    declare _options: MeasureOptions;
    private series: ISeriesApi<keyof SeriesOptionsMap>; // Declare the property for the box
    private chart: IChartApi; // Declare the property for the box

    constructor(series: ISeriesApi<keyof SeriesOptionsMap>, chart: IChartApi, p1: ViewPoint, p2: ViewPoint, options: BoxOptions, showCircles: boolean) {
        super(p1, p2, options, showCircles);
        this.series = series;
        this.chart = chart;
    }

    draw(target: CanvasRenderingTarget2D) {
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const scaled = this._getScaledCoordinates(scope);
            
            if (!scaled) return;
            
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            setLineStyle(ctx, this._options.lineStyle);
            
            // Declare variables at this scope level
            let mainX = 0, mainY = 0, width = 0, height = 0;
            let hasValidCoordinates = false;

            // Only proceed if both points have valid data
            if (this._p1 && this._p2) {
                if (this._p1.y !== undefined && this._p1.y !== null && 
                    this._p2.y !== undefined && this._p2.y !== null && 
                    this._p1.x !== undefined && this._p1.x !== null && 
                    this._p2.x !== undefined && this._p2.x !== null) {
                    const price1 = this.series.coordinateToPrice(this._p1.y);
                    const price2 = this.series.coordinateToPrice(this._p2.y);
                    const time1 = this.chart.timeScale().coordinateToTime(this._p1.x);
                    const time2 = this.chart.timeScale().coordinateToTime(this._p2.x);
                    
                    // Ensure prices and times are not null
                    if (price1 === null || price2 === null || time1 === null || time2 === null) {
                        return;
                    }
                    
                    // Calculate Price Percentage Difference
                    const priceDiff_abs = price2 - price1;
                    const priceDiff_pct = (priceDiff_abs / price1) * 100;

                    if (priceDiff_abs > 0) {
                        ctx.fillStyle = 'rgba(5,180,5,0.1)'; // You can customize the color
                    } else {
                        ctx.fillStyle = 'rgba(255,5,5,0.1)'; // You can customize the color
                    }

                    mainX = Math.min(scaled.x1, scaled.x2);
                    mainY = Math.min(scaled.y1, scaled.y2);
                    width = Math.abs(scaled.x1 - scaled.x2);
                    height = Math.abs(scaled.y1 - scaled.y2);
                    hasValidCoordinates = true;

                    // Draw the rectangle
                    ctx.strokeRect(mainX, mainY, width, height);
                    ctx.fillRect(mainX, mainY, width, height);

                    console.log(price1)
                    console.log(price2)
                    const priceDiffText = `${priceDiff_pct.toFixed(2)}%`;
                    const priceDiffText_abs = `${priceDiff_abs.toFixed(2)}`;

                    // Calculate Time Difference
                    const timeDiffMs = Math.abs(
                        (typeof time2 === 'number' ? time2 : 0) - (typeof time1 === 'number' ? time1 : 0)
                    );
                    const timeDiffText = `Time: ${this._formatTimeDifference(timeDiffMs)}`;

                    // Set text styles
                    ctx.font = "14px Arial";
                    ctx.fillStyle = "rgba(5,5,5,1)"; // You can customize the color

                    
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    // Calculate positions
                    const centerX = mainX + width / 2;
                    const topY = mainY - 10; // 10 pixels above the top edge
                    const bottomY = mainY + height - 20; // 10 pixels below the bottom edge

                    // Draw Price Percentage Difference at the Top
                    ctx.fillText(priceDiffText, centerX, topY);

                    // Draw Price Absolute Difference at the Middle
                    ctx.fillText(priceDiffText_abs, centerX, topY + 20); // 20 pixels below the top edge

                    // Draw Time Difference at the Bottom
                    ctx.fillText(timeDiffText, centerX, bottomY);
                }
            }

            // Only draw circles if we have valid coordinates and we're being hovered
            if (this._hovered && hasValidCoordinates) {
                this._drawEndCircle(scope, mainX, mainY);
                this._drawEndCircle(scope, mainX + width, mainY);
                this._drawEndCircle(scope, mainX + width, mainY + height);
                this._drawEndCircle(scope, mainX, mainY + height);
            }
        });
    }

    /**
     * Formats the time difference from milliseconds to a human-readable string.
     * You can adjust this function based on your application's requirements.
     * @param ms Time difference in milliseconds
     * @returns Formatted time difference string
     */
    private _formatTimeDifference(ms: number): string {
        const seconds = Math.floor(ms);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}