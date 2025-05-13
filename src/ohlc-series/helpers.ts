// Converts a hex color to RGBA with specified opacity
export function hexToRGBA(hex: string, opacity: number): string {
    hex = hex.replace(/^#/, '');
    if (!/^([0-9A-F]{3}){1,2}$/i.test(hex)) {
        throw new Error("Invalid hex color format.");
    }

    const getRGB = (hex: string) => {
        return hex.length === 3
            ? [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
            : [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    };

    const [r, g, b] = getRGB(hex);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Adjusts the opacity of a color (hex, rgb, or rgba)
export function setOpacity(color: string, newOpacity: number): string {
    if (color.startsWith('#')) {
        return hexToRGBA(color, newOpacity);
    } else if (color.startsWith('rgba') || color.startsWith('rgb')) {
        return color.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/, 
                             `rgba($1, $2, $3, ${newOpacity})`);
    } else {
        throw new Error("Unsupported color format. Use hex, rgb, or rgba.");
    }
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
