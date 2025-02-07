import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { darkenColor } from '../helpers/colors';
/**
 * Draws a rectangle-shaped candle.
 * @param ctx - The canvas rendering context.
 * @param leftSide - The X-coordinate of the left edge of the candle.
 * @param rightSide - The X-coordinate of the right edge of the candle.
 * @param yCenter - The Y-coordinate of the center of the candle.
 * @param candleHeight - The height of the candle in pixels.
 */
export function ohlcRectangle(
  ctx: CanvasRenderingContext2D,
  leftSide: number,
  rightSide: number,
  yCenter: number,
  candleHeight: number
): void {
  const topEdge = yCenter - candleHeight / 2;
  const bottomEdge = yCenter + candleHeight / 2;

  // Begin drawing the candle rectangle.
  ctx.beginPath();
  ctx.moveTo(leftSide, topEdge);
  ctx.lineTo(leftSide, bottomEdge);
  ctx.lineTo(rightSide, bottomEdge);
  ctx.lineTo(rightSide, topEdge);
  ctx.closePath();

  // Fill and stroke the rectangle.
  ctx.fill();
  ctx.stroke();
}

/**
 * Draws a rounded rectangle-shaped candle with clamped corner radius.
 * @param ctx - The canvas rendering context.
 * @param leftSide - The X-coordinate of the left edge of the candle.
 * @param rightSide - The X-coordinate of the right edge of the candle.
 * @param yCenter - The Y-coordinate of the center of the candle.
 * @param candleHeight - The height of the candle in pixels.
 * @param radius - A float from 0..1 that we clamp to an appropriate max.
 */
export function ohlcRounded(
  ctx: CanvasRenderingContext2D,
  leftSide: number,
  rightSide: number,
  yCenter: number,
  candleHeight: number,
  radius: number
): void {
  const width = rightSide - leftSide;

  // Optionally clamp radius if it's supposed to be 0..1
  const rawRadius = radius * Math.min(Math.abs(width), Math.abs(candleHeight));
  const effectiveRadius = Math.abs(Math.min(rawRadius, width / 2, candleHeight / 2));

  const topEdge = yCenter - candleHeight / 2;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(leftSide, topEdge, width, candleHeight, effectiveRadius);
  } else {
    // Fallback: manually draw arcs or just do rect
    ctx.moveTo(leftSide + effectiveRadius, topEdge);
    ctx.lineTo(rightSide - effectiveRadius, topEdge);
    ctx.quadraticCurveTo(rightSide, topEdge, rightSide, topEdge + effectiveRadius);
    ctx.lineTo(rightSide, topEdge + candleHeight - effectiveRadius);
    ctx.quadraticCurveTo(rightSide, topEdge + candleHeight, rightSide - effectiveRadius, topEdge + candleHeight);
    ctx.lineTo(leftSide + effectiveRadius, topEdge + candleHeight);
    ctx.quadraticCurveTo(leftSide, topEdge + candleHeight, leftSide, topEdge + candleHeight - effectiveRadius);
    ctx.lineTo(leftSide, topEdge + effectiveRadius);
    ctx.quadraticCurveTo(leftSide, topEdge, leftSide + effectiveRadius, topEdge);
  }
  ctx.closePath();

  ctx.fill();
  ctx.stroke();
}

/**
 * Draws an ellipse-shaped candle.
 * @param ctx - The canvas rendering context.
 * @param xCenter - The X-coordinate of the center of the ellipse.
 * @param yCenter - The Y-coordinate of the center of the ellipse.
 * @param candleWidth - The width of the ellipse in pixels.
 * @param candleHeight - The height of the ellipse in pixels.
 */
export function ohlcEllipse(
  ctx: CanvasRenderingContext2D,
  leftSide: number,
  rightSide: number,
  middle: number,
  yCenter: number,
  candleHeight: number,
): void {
  const xCenter: number = leftSide + (rightSide - leftSide) / 2;    
  const candleWidth: number = rightSide - leftSide;
  ctx.beginPath();
  ctx.ellipse(
    xCenter, // X-coordinate of the center.
    yCenter, // Y-coordinate of the center.
    Math.abs(candleWidth / 2), // Horizontal radius.
    Math.abs(candleHeight / 2), // Vertical radius.
    0, // Rotation angle.
    0, // Start angle.
    Math.PI * 2 // End angle.
  );
  ctx.fill();
  ctx.stroke();
}

/**
 * Draws a 3D-shaped candle, providing a depth effect.
 * @param ctx - The canvas rendering context.
 * @param xCenter - The X-coordinate of the candle's center.
 * @param yHigh - The Y-coordinate of the highest point of the candle.
 * @param yLow - The Y-coordinate of the lowest point of the candle.
 * @param yOpen - The Y-coordinate of the opening price.
 * @param yClose - The Y-coordinate of the closing price.
 * @param candleWidth - The width of the candle.
 * @param combinedWidth - The combined width for depth effect.
 * @param fillColor - The fill color of the candle.
 * @param borderColor - The border color of the candle.
 * @param isUp - Indicates if the candle is upward-moving.
 * @param barSpacing - The spacing factor between bars.
 */
export function ohlc3d(
  ctx: CanvasRenderingContext2D,
  xCenter: number,
  yHigh: number,
  yLow: number,
  yOpen: number,
  yClose: number,
  candleWidth: number,
  combinedWidth: number,
  fillColor: string,
  borderColor: string,
  isUp: boolean,
  barSpacing: number
): void {
  const xOffset = -Math.max(combinedWidth, 1) * (1 - barSpacing);
  const insideColor = darkenColor(fillColor, 0.666); // Darker side color
  const sideColor = darkenColor(fillColor, 0.333);
  const topColor = darkenColor(fillColor, 0.2); // Slightly lighter top face

  // Calculate front face X coordinates using candleWidth
  const frontLeftX = xCenter - candleWidth / 2;
  const frontRightX = frontLeftX + combinedWidth + xOffset;

  // Calculate back face X coordinates with combined width for depth effect
  const backLeftX = frontLeftX - xOffset;
  const backRightX = frontRightX - xOffset;

  // Set Y coordinates for front and back faces based on candle direction
  let frontTop: number, frontBottom: number, backTop: number, backBottom: number;

  if (!isUp) {
    // Up candle: front face uses open/high, back face uses low/close
    frontTop = yOpen;
    frontBottom = yHigh;
    backTop = yLow;
    backBottom = yClose;
  } else {
    // Down candle: front face uses open/low, back face uses high/close
    frontTop = yOpen;
    frontBottom = yLow;
    backTop = yHigh;
    backBottom = yClose;
  }

  // Draw back (shadow) rectangle
  ctx.fillStyle = sideColor;
  ctx.strokeStyle = borderColor;
  ctx.beginPath();
  ctx.rect(backLeftX, backTop, combinedWidth + xOffset - candleWidth / 2, backBottom - backTop);
  ctx.fill();
  ctx.stroke();

  // Draw top face between front and back
  ctx.fillStyle = topColor;

  if (isUp) {
    // Draw bottom face first for up candles
    ctx.fillStyle = insideColor;
    ctx.beginPath();
    ctx.moveTo(frontLeftX, frontBottom); // Bottom-left corner at the front
    ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
    ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
    ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw left side face for up candles
    ctx.fillStyle = insideColor;
    ctx.beginPath();
    ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
    ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
    ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
    ctx.lineTo(frontLeftX, frontBottom); // Bottom-left corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw right side face for up candles
    ctx.fillStyle = insideColor;
    ctx.beginPath();
    ctx.moveTo(frontRightX, frontTop); // Top-right corner at the front
    ctx.lineTo(backRightX, backTop); // Top-right corner at the back
    ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
    ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw top face last for up candles
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
    ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
    ctx.lineTo(backRightX, backTop); // Top-right corner at the back
    ctx.lineTo(frontRightX, frontTop); // Top-right corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Draw top face first for down candles
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
    ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
    ctx.lineTo(backRightX, backTop); // Top-right corner at the back
    ctx.lineTo(frontRightX, frontTop); // Top-right corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw right side face for down candles
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(frontRightX, frontTop); // Top-right corner at the front
    ctx.lineTo(backRightX, backTop); // Top-right corner at the back
    ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
    ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw left side face for down candles
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
    ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
    ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
    ctx.lineTo(frontLeftX, frontBottom); // Bottom-left corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw bottom face last for down candles
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(frontLeftX, frontBottom); // Bottom-left corner at the front
    ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
    ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
    ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Draws a polygon-shaped candle.
 * @param ctx - The canvas rendering context.
 * @param leftSide - The X-coordinate of the left edge of the polygon.
 * @param rightSide - The X-coordinate of the right edge of the polygon.
 * @param yCenter - The Y-coordinate of the center of the polygon.
 * @param candleHeight - The height of the polygon in pixels.
 * @param highY - The Y-coordinate of the highest point of the polygon.
 * @param lowY - The Y-coordinate of the lowest point of the polygon.
 * @param isUp - Indicates if the polygon points upwards.
 */
export function ohlcPolygon(
  ctx: CanvasRenderingContext2D,
  leftSide: number,
  rightSide: number,
  yCenter: number,
  candleHeight: number,
  highY: number,
  lowY: number,
  isUp: boolean
): void {
  const openCloseTop = yCenter + candleHeight / 2;
  const openCloseBottom = yCenter - candleHeight / 2;

  // Save the current canvas state before drawing.
  ctx.save();
  ctx.beginPath();

  if (isUp) {
    // Define the path for an upward-pointing polygon.
    ctx.moveTo(leftSide, openCloseTop);
    ctx.lineTo(rightSide, highY);
    ctx.lineTo(rightSide, openCloseBottom);
    ctx.lineTo(leftSide, lowY);
  } else {
    // Define the path for a downward-pointing polygon.
    ctx.moveTo(leftSide, highY);
    ctx.lineTo(rightSide, openCloseTop);
    ctx.lineTo(rightSide, lowY);
    ctx.lineTo(leftSide, openCloseBottom);
  }

  // Complete the path and apply styles.
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  // Restore the canvas state after drawing.
  ctx.restore();
}

/**
 * Draws an arrow-shaped candle.
 * @param ctx - The canvas rendering context.
 * @param leftSide - The X-coordinate of the left edge of the arrow.
 * @param rightSide - The X-coordinate of the right edge of the arrow.
 * @param middle - The X-coordinate of the tip of the arrow.
 * @param yCenter - The Y-coordinate of the center of the arrow.
 * @param candleHeight - The height of the arrow in pixels.
 * @param highY - The Y-coordinate of the highest point of the arrow.
 * @param lowY - The Y-coordinate of the lowest point of the arrow.
 * @param isUp - Indicates if the arrow points upwards.
 */
export function ohlcArrow(
  ctx: CanvasRenderingContext2D,
  leftSide: number,
  rightSide: number,
  middle: number,
  yCenter: number,
  candleHeight: number,
  highY: number,
  lowY: number,
  isUp: boolean
): void {
  // Save the current canvas state before drawing.
  ctx.save();
  ctx.beginPath();

  if (isUp) {
    // Define the path for an upward-pointing arrow.
    ctx.moveTo(leftSide, lowY);
    ctx.lineTo(leftSide, yCenter + candleHeight / 2);
    ctx.lineTo(middle, highY);
    ctx.lineTo(rightSide, yCenter + candleHeight / 2);
    ctx.lineTo(rightSide, lowY);
    ctx.lineTo(middle, yCenter - candleHeight / 2);
    ctx.lineTo(leftSide, lowY);
  } else {
    // Define the path for a downward-pointing arrow.
    ctx.moveTo(leftSide, highY);
    ctx.lineTo(leftSide, yCenter - candleHeight / 2);
    ctx.lineTo(middle, lowY);
    ctx.lineTo(rightSide, yCenter - candleHeight / 2);
    ctx.lineTo(rightSide, highY);
    ctx.lineTo(middle, yCenter + candleHeight / 2);
    ctx.lineTo(leftSide, highY);
  }

  // Complete the path and apply styles.
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Restore the canvas state after drawing.
  ctx.restore();
}
/**
 * Draws a traditional OHLC bar using leftSide and rightSide coordinates.
 *
 * The vertical line is drawn at the midpoint between leftSide and rightSide,
 * spanning from the high to the low. An open tick is drawn from leftSide to the center
 * at the open price, and a close tick is drawn from the center to rightSide at the close price.
 *
 * @param ctx - The canvas rendering context.
 * @param leftSide - The X-coordinate for the left edge of the bar.
 * @param rightSide - The X-coordinate for the right edge of the bar.
 * @param high - The Y-coordinate for the high price.
 * @param low - The Y-coordinate for the low price.
 * @param open - The Y-coordinate for the open price.
 * @param close - The Y-coordinate for the close price.
 */
export function ohlcBar(
  ctx: CanvasRenderingContext2D,
  leftSide: number,
  rightSide: number,
  high: number,
  low: number,
  open: number,
  close: number
): void {
  // Compute the center X coordinate of the bar.
  const centerX = (leftSide + rightSide) / 2;

  // Draw the vertical line (from high to low) at the center.
  ctx.beginPath();
  ctx.moveTo(centerX, high);
  ctx.lineTo(centerX, low);
  ctx.stroke();

  // Draw the open tick from leftSide to center at the open price.
  ctx.beginPath();
  ctx.moveTo(leftSide, open);
  ctx.lineTo(centerX, open);
  ctx.stroke();

  // Draw the close tick from center to rightSide at the close price.
  ctx.beginPath();
  ctx.moveTo(centerX, close);
  ctx.lineTo(rightSide, close);
  ctx.stroke();
}
