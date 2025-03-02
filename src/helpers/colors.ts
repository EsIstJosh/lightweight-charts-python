// Converts a hex color to RGBA with specified opacity
export function hexToRGBA(hex: string, opacity: number): string {
    hex = hex.replace(/^#/, '');
    if (!/^([0-9A-F]{3}){1,2}$/i.test(hex)) {
        throw new Error("Invalid hex color format.");
    }

    const getRGB = (h: string) => {
        return h.length === 3
            ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
            : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };

    const [r, g, b] = getRGB(hex);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Adjusts the opacity of a color (hex, rgb, or rgba)
export function setOpacity(color: string, newOpacity: number): string {
    if (color.startsWith('#')) {
        return hexToRGBA(color, newOpacity);
    } else {
        // Match rgb or rgba
        const rgbRegex = /^rgb(a)?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:,\s*([\d.]+))?\)/i;
        const match = color.match(rgbRegex);

        if (match) {
            const r = match[2];
            const g = match[3];
            const b = match[4];
            // If alpha not specified, assume 1.0
            const a = match[1] ? (match[5] ?? '1') : '1';
            return `rgba(${r}, ${g}, ${b}, ${newOpacity??a})`;
    } else {
        throw new Error("Unsupported color format. Use hex, rgb, or rgba.");
    }
}
}

// Scales the alpha of an RGBA color by a fraction. 
// If the color isn't in rgba format, convert it to rgba with 'setOpacity', then re-apply scaleAlpha.
export function scaleAlpha(color: string, fraction: number): string {
    // This regex matches rgba(r, g, b, a) with optional spaces
    const rgbaRegex = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i;
    const rgbaMatch = color.match(rgbaRegex);

    if (!rgbaMatch) {
        // Convert to an rgba with fraction as newOpacity first
        const convertedColor = setOpacity(color, fraction);
        // Now convertedColor is rgba(...), apply scaleAlpha again to scale alpha proportionally
        return scaleAlpha(convertedColor, fraction);
    }

    const r = parseFloat(rgbaMatch[1]);
    const g = parseFloat(rgbaMatch[2]);
    const b = parseFloat(rgbaMatch[3]);
    const baseA = parseFloat(rgbaMatch[4]);

    const newA = baseA * fraction;
    return `rgba(${r},${g},${b},${newA})`;
}


// Darkens a color (hex or rgba) by a specified amount
export function darkenColor(color: string, amount: number = 0.2): string {
    const hexToRgb = (hex: string) => {
        hex = hex.replace(/^#/, '');
        return hex.length === 3
            ? [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
            : [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    };

    const rgbaToArray = (rgba: string) => rgba.match(/\d+(\.\d+)?/g)!.map(Number);
    
    let [r, g, b, a = 1] = color.startsWith('#')
        ? [...hexToRgb(color), 1]
        : rgbaToArray(color);

    r = Math.max(0, Math.min(255, r * (1 - amount)));
    g = Math.max(0, Math.min(255, g * (1 - amount)));
    b = Math.max(0, Math.min(255, b * (1 - amount)));

    return color.startsWith('#')
        ? `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`
        : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

export function generateShades(count: number): string[] {
    // List of potential base colors.
    const colors = {
        "#ff0000": [
          "#ff0000",
          "#f20000",
          "#e60000",
          "#d90000",
          "#cc0000",
          "#bf0000",
          "#b30000",
          "#a60000",
          "#990000",
          "#8c0000"
        ],
        "#ff8700": [
          "#ff8700",
          "#f28000",
          "#e67a00",
          "#d97300",
          "#cc6c00",
          "#bf6500",
          "#b35f00",
          "#a65800",
          "#995100",
          "#8c4a00"
        ],
        "#ffd300": [
          "#ffd300",
          "#fcca00",
          "#e6c000",
          "#d9b600",
          "#ccb000",
          "#bfaa00",
          "#b3a000",
          "#a69a00",
          "#999000",
          "#8c8600"
        ],
        "#a1ff0a": [
          "#a1ff0a",
          "#97f207",
          "#8ded04",
          "#83e701",
          "#79db00",
          "#6fd200",
          "#65c900",
          "#5bc000",
          "#51b700",
          "#47ae00"
        ],
        "#117a03": [
          "#117a03",
          "#107203",
          "#0e6c03",
          "#0c6603",
          "#0a6003",
          "#085a03",
          "#065403",
          "#044e03",
          "#024803",
          "#004203"
        ],

        "#580aff": [
          "#580aff",
          "#5109f2",
          "#4a08e6",
          "#4307da",
          "#3c06ce",
          "#3505c2",
          "#2e04b6",
          "#2703aa",
          "#2002a0",
          "#190196"
        ],
        "#be0aff": [
          "#be0aff",
          "#b308f2",
          "#aa07e6",
          "#a005da",
          "#9704ce",
          "#8e03c2",
          "#8502b6",
          "#7c01aa",
          "#7300a0",
          "#6a0096"
        ]
      }




  // Tell TypeScript that the keys are exactly those of the colors object.
  const baseColors = Object.keys(colors) as (keyof typeof colors)[];
  // Pick a random base color.
  const randomKey = baseColors[Math.floor(Math.random() * baseColors.length)];
  const fullShades = colors[randomKey];

  // If the requested count equals the full set, return it directly.
  if (count === fullShades.length) {
    return fullShades;
  }

  // Otherwise, return an evenly spaced selection of shades.
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = count === 1 ? 0 : Math.round(i * (fullShades.length - 1) / (count - 1));
    result.push(fullShades[index]);
  }

  return result;
}

	/**
 * Safely extracts the alpha component from an RGBA or HSLA color string.
 * Returns 1.0 if parsing fails or if no alpha is found (e.g. "rgb(...)").
 */
 export  function getAlphaFromColor(color: string): number {
    // Attempt to parse 'rgba(...)' or 'hsla(...)' format.
    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/i);
    const hslaMatch = color.match(/hsla?\(([^)]+)\)/i);
    
    let alpha = 1.0; // Default if we fail to parse or if no alpha is present
    
    if (rgbaMatch) {
      // Extract the comma-separated values inside the parentheses
      const parts = rgbaMatch[1].split(',').map((p) => parseFloat(p.trim()));
      // If there are 4 parts (r, g, b, a), use the last as alpha
      if (parts.length === 4) {
      alpha = parts[3];
      }
    } else if (hslaMatch) {
      // Extract the comma-separated values inside the parentheses
      const parts = hslaMatch[1].split(',').map((p) => parseFloat(p.trim()));
      // If there are 4 parts (h, s, l, a), use the last as alpha
      if (parts.length === 4) {
      alpha = parts[3];
      }
    }
    
    return alpha;
    }


    /**
 * Recursively walk through an object, looking for any key that includes "color".
 * When found, invoke a callback with the key path and value.
 *
 * @param obj The object to inspect (e.g., a series's options object).
 * @param callback A function to call whenever a property name has "color".
 * @param parentKey Internal use: tracks the current path (e.g. "candles.border").
 */
export function findColorOptions(
  obj: Record<string, any>,
  callback: (fullPath: string, value: any) => void,
  parentKey: string = ""
): void {
  for (const key of Object.keys(obj)) {
    const fullPath = parentKey ? `${parentKey}.${key}` : key;
    const value = obj[key];

    // If the value is another object, recurse deeper
    if (typeof value === "object" && value !== null) {
      findColorOptions(value, callback, fullPath);
    } else {
      // If the key itself contains "color", report it
      if (key.toLowerCase().includes("color")) {
        callback(fullPath, value);
      }
    }
  }
};
