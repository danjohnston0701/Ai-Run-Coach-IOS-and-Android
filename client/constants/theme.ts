import { Platform } from "react-native";

// AI Run Coach brand colors - dark theme with energetic running aesthetic
const primaryColor = "#00D4FF"; // Bright cyan/teal - energetic, modern
const primaryDark = "#00B8E6";
const accentColor = "#FF6B35"; // Warm orange for CTAs and highlights
const successColor = "#00E676";
const warningColor = "#FFB300";
const errorColor = "#FF5252";

export const Colors = {
  light: {
    text: "#FFFFFF",
    textSecondary: "#A0AEC0",
    textMuted: "#718096",
    buttonText: "#0A0F1A",
    tabIconDefault: "#718096",
    tabIconSelected: primaryColor,
    link: primaryColor,
    primary: primaryColor,
    primaryDark: primaryDark,
    accent: accentColor,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    backgroundRoot: "#0A0F1A", // Deep dark blue-black
    backgroundDefault: "#111827", // Slightly lighter
    backgroundSecondary: "#1F2937", // Card backgrounds
    backgroundTertiary: "#374151", // Elevated elements
    border: "#2D3748",
    borderLight: "#4A5568",
    cardGradientStart: "#1A1F2E",
    cardGradientEnd: "#0D1117",
    overlay: "rgba(0, 0, 0, 0.7)",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#A0AEC0",
    textMuted: "#718096",
    buttonText: "#0A0F1A",
    tabIconDefault: "#718096",
    tabIconSelected: primaryColor,
    link: primaryColor,
    primary: primaryColor,
    primaryDark: primaryDark,
    accent: accentColor,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    backgroundRoot: "#0A0F1A",
    backgroundDefault: "#111827",
    backgroundSecondary: "#1F2937",
    backgroundTertiary: "#374151",
    border: "#2D3748",
    borderLight: "#4A5568",
    cardGradientStart: "#1A1F2E",
    cardGradientEnd: "#0D1117",
    overlay: "rgba(0, 0, 0, 0.7)",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
  inputHeight: 52,
  buttonHeight: 56,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
  pill: 9999,
};

export const Typography = {
  h1: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  stat: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
    letterSpacing: -1,
  },
  statLarge: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "700" as const,
    letterSpacing: -2,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: {
    shadowColor: primaryColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 0,
  },
};
