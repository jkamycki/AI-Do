export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 1 / 6) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 2 / 6) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 3 / 6) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 4 / 6) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 5 / 6) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hslToHex(hsl: HSL): string {
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function validateHexColor(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function normalizeHexColor(hex: string): string {
  if (!hex.startsWith("#")) {
    hex = "#" + hex;
  }
  return hex.toUpperCase();
}

export function generateColorPaletteFromPrimary(
  primaryHex: string
): ColorPalette {
  // Normalize and validate
  let hex = normalizeHexColor(primaryHex);

  if (!validateHexColor(hex)) {
    throw new Error(
      "Invalid hex color format. Must be in format #RRGGBB or RRGGBB"
    );
  }

  // Convert to HSL
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Generate secondary (analogous color, 30° shift)
  const secondaryHsl: HSL = {
    ...hsl,
    h: (hsl.h + 30) % 360,
  };
  const secondaryHex = hslToHex(secondaryHsl);

  // Generate accent (complementary color, 180° shift with increased saturation)
  const accentHsl: HSL = {
    ...hsl,
    h: (hsl.h + 180) % 360,
    s: Math.min(hsl.s + 15, 100),
  };
  const accentHex = hslToHex(accentHsl);

  // Generate neutral (desaturated primary by 70%)
  const neutralHsl: HSL = {
    ...hsl,
    s: Math.max(hsl.s - 70, 0),
  };
  const neutralHex = hslToHex(neutralHsl);

  return {
    primary: hex,
    secondary: secondaryHex,
    accent: accentHex,
    neutral: neutralHex,
  };
}

export const PRESET_PALETTES: Record<string, ColorPalette> = {
  romantic: {
    primary: "#E8A4C4",
    secondary: "#F5D5E3",
    accent: "#D4A017",
    neutral: "#8B7B8F",
  },
  modern: {
    primary: "#333333",
    secondary: "#CCCCCC",
    accent: "#C0C0C0",
    neutral: "#808080",
  },
  luxury: {
    primary: "#1A472A",
    secondary: "#2E8B57",
    accent: "#FFD700",
    neutral: "#696969",
  },
  minimalist: {
    primary: "#000000",
    secondary: "#FFFFFF",
    accent: "#D3D3D3",
    neutral: "#A9A9A9",
  },
  seasonal: {
    primary: "#800020",
    secondary: "#CD853F",
    accent: "#8B4513",
    neutral: "#D2B48C",
  },
};

export const AVAILABLE_FONTS = [
  // Script & Calligraphy
  "Great Vibes",
  "Dancing Script",
  "Sacramento",
  "Tangerine",
  "Parisienne",
  // Elegant Serif
  "Playfair Display",
  "Cormorant Garamond",
  "Cinzel",
  "EB Garamond",
  "Lora",
  "Merriweather",
  "Libre Baskerville",
  "Crimson Text",
  // Modern Sans-Serif
  "Montserrat",
  "Raleway",
  "Poppins",
  "Inter",
  "Open Sans",
  "Josefin Sans",
  "Quicksand",
  // Classic
  "Georgia",
  "Garamond",
  "Times New Roman",
  "Arial",
];

export const AVAILABLE_LAYOUTS = [
  "classic",
  "modern",
  "romantic",
  "minimalist",
  "elegant",
  "playful",
  "luxury",
  "simple",
];
