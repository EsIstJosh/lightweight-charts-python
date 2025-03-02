import {
  LineStyle,
  LineWidth,
  Logical,
  MouseEventParams,
} from "lightweight-charts";

import { Point } from "../drawing/data-source";
import { InteractionState } from "../drawing/drawing";
import { defaultOptions, DrawingOptions } from "../drawing/options";
import { ThreePointDrawing } from "../drawing/three-point-drawing";
import { PitchForkPaneView } from "./pane-view";
export interface PitchForkOptions extends DrawingOptions {
  variant?: "standard" | "schiff" | "modifiedSchiff" | "inside";
  forkLines?: ForkLine[];
  length: number;
}
export interface ForkLine {
  /**
   * A multiplier used to offset the fork line from the baseline.
   */
  value: number;
  /**
   * The width of the fork line.
   */
  width: LineWidth;
  /**
   * The style of the fork line (e.g., solid, dashed, dotted).
   */
  style: LineStyle;
  /**
   * The color of the fork line.
   */
  color: string;
  /**
   * Optional fill color for the area between this fork line and the one below it.
   * When provided, the area between this fork line and the next in sequence will be filled.
   */
  fillColor?: string;
}
export const defaultPitchForkOptions: PitchForkOptions = {
  lineColor: "#ffffff",
  lineStyle: LineStyle.LargeDashed,
  width: 1,
  variant: "standard",
  forkLines: [
    {
      value: 1.0,
      width: 2,
      style: LineStyle.Solid,
      color: "#ff0000",
      fillColor: undefined,
    },
    {
      value: 0.786,
      width: 1 as LineWidth,
      style: LineStyle.SparseDotted,
      color: "#000fff",
      fillColor: undefined,
    },
    {
      value: 0.618,
      width: 1,
      style: LineStyle.LargeDashed,
      color: "#ffffff",
      fillColor: undefined,
    },
    {
      value: 0.5,
      width: 2,
      style: LineStyle.Solid,
      color: "#ff0000",
      fillColor: undefined,
    },
    {
      value: 0.382,
      width: 1,
      style: LineStyle.LargeDashed,
      color: "#ffffff",
      fillColor: undefined,
    },
    {
      value: 0.236,
      width: 1 as LineWidth,
      style: LineStyle.SparseDotted,
      color: "#000fff",
      fillColor: undefined,
    },
    {
      value: 0,
      width: 2,
      style: LineStyle.Solid,
      color: "#ff0000",
      fillColor: undefined,
    },
  ],
  length: 1.0, // default logical length for extensions
};

export class PitchFork extends ThreePointDrawing {
  _type = "PitchFork";
  public variant: "standard" | "schiff" | "modifiedSchiff" | "inside";
  constructor(
    p1: Point,
    p2: Point,
    p3: Point,
    options?: Partial<PitchForkOptions>
  ) {
    super(p1, p2, p3, { ...defaultPitchForkOptions, ...options });
    this.variant = options?.variant || "standard";
    this._paneViews = [new PitchForkPaneView(this)];
  }

  _moveToState(state: InteractionState) {
    switch (state) {
      case InteractionState.NONE:
        document.body.style.cursor = "default";
        this._hovered = false;
        this.requestUpdate();
        this._unsubscribe("mousedown", this._handleMouseDownInteraction);
        break;

      case InteractionState.HOVERING:
        document.body.style.cursor = "pointer";
        this._hovered = true;
        this.requestUpdate();
        this._subscribe("mousedown", this._handleMouseDownInteraction);
        this._unsubscribe("mouseup", this._handleMouseDownInteraction);
        this.chart.applyOptions({ handleScroll: true });
        break;

      case InteractionState.DRAGGINGP1:
      case InteractionState.DRAGGINGP2:
      case InteractionState.DRAGGINGP3:

      case InteractionState.DRAGGING:
        document.body.style.cursor = "grabbing";
        this._subscribe("mouseup", this._handleMouseUpInteraction);
        this.chart.applyOptions({ handleScroll: false });
        break;
    }
    this._state = state;
  }

  _onDrag(diff: any) {
    if (
      this._state == InteractionState.DRAGGING ||
      this._state == InteractionState.DRAGGINGP1
    ) {
      this._addDiffToPoint(this.p1, diff.logical, diff.price);
    }
    if (
      this._state == InteractionState.DRAGGING ||
      this._state == InteractionState.DRAGGINGP2
    ) {
      this._addDiffToPoint(this.p2, diff.logical, diff.price);
    }
    if (
      this._state == InteractionState.DRAGGING ||
      this._state == InteractionState.DRAGGINGP3
    ) {
      this._addDiffToPoint(this.p3, diff.logical, diff.price);
    }
  }

  protected _onMouseDown() {
    this._startDragPoint = null;
    const hoverPoint = this._latestHoverPoint;
    if (!hoverPoint) return;
    const p1 = this._paneViews[0]._p1;
    const p2 = this._paneViews[0]._p2;
    const p3 = this._paneViews[0]._p3;

    if (!p1.x || !p2.x || !p3.x || !p1.y || !p2.y || !p3.y)
      return this._moveToState(InteractionState.DRAGGING);

    const tolerance = 10;
    if (
      Math.abs(hoverPoint.x - p1.x) < tolerance &&
      Math.abs(hoverPoint.y - p1.y) < tolerance
    ) {
      this._moveToState(InteractionState.DRAGGINGP1);
    } else if (
      Math.abs(hoverPoint.x - p2.x) < tolerance &&
      Math.abs(hoverPoint.y - p2.y) < tolerance
    ) {
      this._moveToState(InteractionState.DRAGGINGP2);
    } else if (
      Math.abs(hoverPoint.x - p3.x) < tolerance &&
      Math.abs(hoverPoint.y - p3.y) < tolerance
    ) {
      this._moveToState(InteractionState.DRAGGINGP3);
    } else {
      this._moveToState(InteractionState.DRAGGING);
    }
  }
  protected _mouseIsOverDrawing(
    param: MouseEventParams,
    tolerance = 4
  ): boolean {
    if (!param.point) return false;
    const x1 = this._paneViews[0]._p1.x;
    const y1 = this._paneViews[0]._p1.y;
    const x2 = this._paneViews[0]._p2.x;
    const y2 = this._paneViews[0]._p2.y;
    const x3 = this._paneViews[0]._p3.x;
    const y3 = this._paneViews[0]._p3.y;
    if (
      x1 == null ||
      y1 == null ||
      x2 == null ||
      y2 == null ||
      x3 == null ||
      y3 == null
    )
      return false;
    const mouseX = param.point.x;
    const mouseY = param.point.y;
    // Check bounding box of the three points
    if (
      mouseX < Math.min(x1, x2, x3) - tolerance ||
      mouseX > Math.max(x1, x2, x3) + tolerance
    ) {
      return false;
    }
    // Check distance to each segment: p1->p2, p2->p3, and p1->p3
    const d1 = this._distanceFromSegment(x1, y1, x2, y2, mouseX, mouseY);
    const d2 = this._distanceFromSegment(x2, y2, x3, y3, mouseX, mouseY);
    const d3 = this._distanceFromSegment(x1, y1, x3, y3, mouseX, mouseY);
    return d1 <= tolerance || d2 <= tolerance || d3 <= tolerance;
  }

  private _distanceFromSegment(
    xA: number,
    yA: number,
    xB: number,
    yB: number,
    x: number,
    y: number
  ): number {
    const A = x - xA,
      B = y - yA,
      C = xB - xA,
      D = yB - yA;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;
    let xx: number, yy: number;
    if (param < 0) {
      xx = xA;
      yy = yA;
    } else if (param > 1) {
      xx = xB;
      yy = yB;
    } else {
      xx = xA + param * C;
      yy = yA + param * D;
    }
    const dx = x - xx,
      dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  /**
   * Deserializes a JSON object to update the current Sequence instance.
   *
   * @param json - The JSON object containing optional Sequence data and options.
   */
  public fromJSON(json: { options?: PitchForkOptions }): void {
    if (json.options) {
      // Cast json.options as a generic record to satisfy the index signature.
      const options = json.options as Record<string, any>;
      for (const key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
          // Cast key to keyof SequenceOptions.
          const typedKey = key as keyof PitchForkOptions;
          this.applyOptions({ [typedKey]: options[typedKey] });
        }
      }
    }
  }

  public toJSON(): object {
    return {
      options: this._options,
    };
  }

 public title: string = "PitchFork"
}
