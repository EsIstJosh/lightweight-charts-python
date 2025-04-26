import { ViewPoint } from "../drawing/pane-view";
import { CanvasRenderingTarget2D } from "fancy-canvas";
import { TwoPointDrawingPaneRenderer } from "../drawing/pane-renderer";
import { MeasureOptions } from "./measure";
import { setLineStyle } from "../helpers/canvas-rendering";
import { IChartApi, ISeriesApi, SeriesOptionsMap } from "lightweight-charts";

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
            ctx.fillStyle = this._options.fillColor;

            const mainX = Math.min(scaled.x1, scaled.x2);
            const mainY = Math.min(scaled.y1, scaled.y2);
            const width = Math.abs(scaled.x1 - scaled.x2);
            const height = Math.abs(scaled.y1 - scaled.y2);

            // Draw the rectangle
            ctx.strokeRect(mainX, mainY, width, height);
            ctx.fillRect(mainX, mainY, width, height);

            // Only proceed if both points have valid data
            if (this._p1 && this._p2) {

                if (this._p1.y !== undefined && this._p2.y !== undefined && this._p1.x !== undefined && this._p2.x !== undefined) {
                    const price1 = this.series.coordinateToPrice(this._p1.y);
                    const price2 = this.series.coordinateToPrice(this._p2.y);
                    const time1 =this.chart.timeScale().coordinateToTime(this._p1.x);
                    const time2 =this.chart.timeScale().coordinateToTime(this._p2.x);
    

                    // Calculate Price Percentage Difference
                    const priceDiff = ((price2 - price1) / price1) * 100;
                    console.log(price1)
                    console.log(price2)
                    const priceDiffText = `Price: ${priceDiff.toFixed(2)}%`;

                    // Calculate Time Difference
                    const timeDiffMs = Math.abs(time2 - time1);
                    const timeDiffText = `Time: ${this._formatTimeDifference(timeDiffMs)}`;

                    // Set text styles
                    ctx.font = "12px Arial";
                    ctx.fillStyle = "white"; // You can customize the color
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    // Calculate positions
                    const centerX = mainX + width / 2;
                    const topY = mainY - 10; // 10 pixels above the top edge
                    const bottomY = mainY + height + 10; // 10 pixels below the bottom edge

                    // Draw Price Percentage Difference at the Top
                    ctx.fillText(priceDiffText, centerX, topY);

                    // Draw Time Difference at the Bottom
                    ctx.fillText(timeDiffText, centerX, bottomY);
                }
            }

            if (!this._hovered) return;
            this._drawEndCircle(scope, mainX, mainY);
            this._drawEndCircle(scope, mainX + width, mainY);
            this._drawEndCircle(scope, mainX + width, mainY + height);
            this._drawEndCircle(scope, mainX, mainY + height);



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