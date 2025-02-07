import { CanvasRenderingTarget2D } from "fancy-canvas";
import { ThreePointDrawingPaneRenderer } from "../drawing/pane-renderer";
import { setLineStyle } from "../helpers/canvas-rendering";
import { DrawingOptions } from "../drawing/options";
import { ViewPoint } from "./pane-view";
import { PitchForkOptions } from "./pitchfork";
import { Coordinate, LineStyle } from "lightweight-charts";

/**
 * Renderer class for drawing Pitch Forks.
 * 
 * Responsibilities:
 * - Compute geometric positions based on input view points.
 * - Render all parts of the pitchfork including the baseline, median, and fork-lines.
 *
 * SOLID Considerations:
 * - Single Responsibility: Each helper (e.g. computing anchor point, intersection) has one task.
 * - Open/Closed: New drawing variants can be added by extending without modifying existing logic.
 * - Liskov Substitution: Derived classes can be substituted without altering behavior.
 * - Interface Segregation: The public API remains minimal.
 * - Dependency Inversion: Drawing relies on abstract canvas operations.
 */
export class PitchForkPaneRenderer extends ThreePointDrawingPaneRenderer {
  private options: PitchForkOptions;
  private variant: "standard" | "schiff" | "modifiedSchiff" | "inside";

  /**
   * Constructs a new PitchForkPaneRenderer instance.
   *
   * @param p1 - The first view point.
   * @param p2 - The second view point.
   * @param p3 - The third view point.
   * @param options - Options for drawing the pitchfork.
   * @param hovered - Indicates whether the pitchfork is hovered.
   */
  constructor(
    p1: ViewPoint,
    p2: ViewPoint,
    p3: ViewPoint,
    options: PitchForkOptions,
    hovered: boolean,
  ) {
    super(p1, p2, p3, options, hovered);
    this.options = options;
    this.variant = options.variant ?? "standard";
  }

  /**
   * Draws the pitchfork on the provided canvas rendering target.
   *
   * The method computes key geometric points and draws the baseline, median, fork-lines,
   * and optionally fills the area and draws hover circles.
   *
   * @param target - The canvas rendering target.
   */
  public draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (
        this._p1.x === null || this._p1.y === null ||
        this._p2.x === null || this._p2.y === null ||
        this._p3.x === null || this._p3.y === null
      ) {
        return;
      }
      const ctx = scope.context;
      const scaled = this._getScaledCoordinates(scope);
      if (!scaled) return;
      const { x1, y1, x2, y2, x3, y3 } = scaled;

      // 1) Compute the midpoint of p2→p3.
      const midP2P3X: number = (x2 + x3) / 2;
      const midP2P3Y: number = (y2 + y3) / 2;

      let medianStartX: number, medianStartY: number;
      let medianEndX: number, medianEndY: number;
      let vx: number, vy: number; // median vector

      // The horizontal extension is 2× the difference between p2.x and p1.x.
      const dxExtension: number = ((this._options as PitchForkOptions).length??1) * (x2 - x1);

      if (this.variant === "inside") {
        // For the "inside" variant:
        // - The median starts at the midpoint of p2 and p3.
        // - Its direction is defined by the vector from p3 to the midpoint of p1 and p2.
        medianStartX = midP2P3X;
        medianStartY = midP2P3Y;
        const midP1P2X: number = (x1 + x2) / 2;
        const midP1P2Y: number = (y1 + y2) / 2;

        // Compute the direction from p3 to the midpoint of p1 and p2.
        const deltaX: number = midP1P2X - x3;
        const deltaY: number = midP1P2Y - y3;
        let angle: number = Math.atan2(deltaY, deltaX);
        // Ensure the extension goes rightwards: if the horizontal component is negative, flip the angle.
        if (Math.cos(angle) < 0) {
          angle += Math.PI;
        }
        medianEndX = medianStartX + dxExtension * Math.cos(angle);
        medianEndY = medianStartY + dxExtension * Math.sin(angle);
      } else {
        // For other variants:
        // 2) Compute the variant-based anchor point from p1 and p2.
        const { anchorX, anchorY } = this._computeAnchorPoint(this.variant, x1, y1, x2, y2);

        // 3) Compute the intersection of L1 (p1→p2) and L2 (from midpoint of p2→p3 towards the anchor).
        const intersect = this._lineIntersection(x1, y1, x2, y2, midP2P3X, midP2P3Y, anchorX, anchorY);
        if (intersect) {
          [medianStartX, medianStartY] = intersect;
        } else {
          // Fallback: if no intersection, use p1.
          medianStartX = x1;
          medianStartY = y1;
        }
  
        // 4) Compute the slope from the median start to the midpoint of p2 and p3.
        const dxForSlope: number = midP2P3X - medianStartX;
        const slope: number = Math.abs(dxForSlope) > 1e-9 ? (midP2P3Y - medianStartY) / dxForSlope : 0;
        medianEndX = medianStartX + dxExtension;
        medianEndY = medianStartY + slope * dxExtension;
      }

      // Compute the median vector.
      vx = medianEndX - medianStartX;
      vy = medianEndY - medianStartY;

      // 5) Optional fill: draw a quadrilateral from the baseline (p2→p3) offset by the median vector.
      //if (this.options.fillColor) {
      //  ctx.save();
      //  ctx.fillStyle = this.options.fillColor;
      //  ctx.beginPath();
      //  ctx.moveTo(x2, y2);
      //  ctx.lineTo(x3, y3);
      //  ctx.lineTo(x3 + vx, y3 + vy);
      //  ctx.lineTo(x2 + vx, y2 + vy);
      //  ctx.closePath();
      //  ctx.fill();
      //  ctx.restore();
      //}

      // 6) Set line style and draw the primary lines.
      ctx.lineWidth = this.options.width;
      ctx.strokeStyle = this.options.lineColor;
      setLineStyle(ctx, this.options.lineStyle);

      // 7) Draw the primary lines.
      // (a) Baseline: p2→p3.
      setLineStyle(ctx, LineStyle.Solid);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();
      setLineStyle(ctx, this.options.lineStyle);

      // (b) p1→p2 (always drawn).
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // (c) Median line.
      ctx.beginPath();
      ctx.moveTo(medianStartX, medianStartY);
      ctx.lineTo(medianEndX, medianEndY);
      ctx.stroke();

      // (d) Parallels: lines through p2 and p3 using the median vector.
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 + vx, y2 + vy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x3 + vx, y3 + vy);
      ctx.stroke();
    // 8) Draw additional fork-lines parallel to the median and fill between them if fillColor is set.
    if (this.options.forkLines && this.options.forkLines.length > 0) {
        const forkLines = this.options.forkLines;
        for (let i = 0; i < forkLines.length; i++) {
        const fork = forkLines[i];
        // Compute the current fork's starting point: p3 offset by fork.value * (p2 - p3)
        const forkStartX: number = x3 + fork.value * (x2 - x3);
        const forkStartY: number = y3 + fork.value * (y2 - y3);
        // Extend the fork-line using the same median vector.
        const forkEndX: number = forkStartX + vx;
        const forkEndY: number = forkStartY + vy;
    
        // Draw the current fork line.
        ctx.lineWidth = fork.width;
        ctx.strokeStyle = fork.color;
        setLineStyle(ctx, fork.style);
        ctx.beginPath();
        ctx.moveTo(forkStartX, forkStartY);
        ctx.lineTo(forkEndX, forkEndY);
        ctx.stroke();
    
        // If the current fork line has a fillColor and there's a fork line below it, fill the area.
        if (fork.fillColor && i < forkLines.length - 1) {
            const nextFork = forkLines[i + 1];
            const nextForkStartX: number = x3 + nextFork.value * (x2 - x3);
            const nextForkStartY: number = y3 + nextFork.value * (y2 - y3);
            const nextForkEndX: number = nextForkStartX + vx;
            const nextForkEndY: number = nextForkStartY + vy;
    
            ctx.save();
            ctx.fillStyle = fork.fillColor;
            ctx.beginPath();
            ctx.moveTo(forkStartX, forkStartY);
            ctx.lineTo(forkEndX, forkEndY);
            ctx.lineTo(nextForkEndX, nextForkEndY);
            ctx.lineTo(nextForkStartX, nextForkStartY);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        }
    }
    

      // 9) If hovered, draw circles at the pivot points.
      if (this._hovered) {
        ctx.lineWidth = this.options.width + 1;
        ctx.strokeStyle = this.options.lineColor;
        setLineStyle(ctx, LineStyle.Solid);
  
        this._drawEndCircle(scope, x1, y1);
        this._drawEndCircle(scope, x2, y2);
        this._drawEndCircle(scope, x3, y3);
      }
    });
  }

  /**
   * Computes the anchor point based on the pitchfork variant.
   *
   * @param variant - The pitchfork variant.
   * @param x1 - x-coordinate of p1.
   * @param y1 - y-coordinate of p1.
   * @param x2 - x-coordinate of p2.
   * @param y2 - y-coordinate of p2.
   * @returns The computed anchor point.
   */
  private _computeAnchorPoint(
    variant: "standard" | "schiff" | "modifiedSchiff" | "inside",
    x1: number, y1: number,
    x2: number, y2: number
  ): { anchorX: number; anchorY: number } {
    switch (variant) {
      case "standard":
        return { anchorX: x1, anchorY: y1 };
      case "schiff":
        return { anchorX: x1, anchorY: (y1 + y2) / 2 };
      case "modifiedSchiff":
        return { anchorX: (x1 + x2) / 2, anchorY: (y1 + y2) / 2 };
      case "inside":
        // Although the "inside" variant computes its median differently,
        // we still provide an anchor for consistency.
        return { anchorX: x1 + 0.5 * (x2 - x1), anchorY: y1 + 0.5 * (y2 - y1) };
    }
  }

  /**
   * Calculates the intersection point of two infinite lines:
   * - Line 1: from (x1, y1) to (x2, y2)
   * - Line 2: from (x3, y3) to (x4, y4)
   *
   * @returns A tuple [xi, yi] representing the intersection point, or null if the lines are parallel.
   */
  private _lineIntersection(
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number
  ): [number, number] | null {
    const denom: number = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-9) return null;
    const ua: number = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ix: number = x1 + ua * (x2 - x1);
    const iy: number = y1 + ua * (y2 - y1);
    return [ix, iy];
  }
}
