import { MD3DarkTheme, MD3LightTheme, configureFonts } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";

const fontConfig = {
  fontFamily: "System",
};

const fonts = configureFonts({ config: fontConfig });

const ciscoPalette = {
  ciscoBlue: "#049FD9",
  ciscoDarkBlue: "#005C8C",
  ciscoNavy: "#003949",
  ciscoMagenta: "#E6007E",
  ciscoPink: "#FF4DB8",
  ciscoLightPink: "#FDA4D0",
  sfBlue: "#2563eb",
  ok: "#22c55e",
  warn: "#f59e0b",
  critical: "#ef4444",
  ddMagenta: "#FF1B8D",
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: ciscoPalette.ciscoBlue,
    primaryContainer: "rgba(4, 159, 217, 0.15)",
    secondary: ciscoPalette.ciscoMagenta,
    secondaryContainer: "rgba(230, 0, 126, 0.15)",
    tertiary: ciscoPalette.sfBlue,
    background: "#0a0f1a",
    surface: "#111827",
    surfaceVariant: "#1e293b",
    onBackground: "#e2e8f0",
    onSurface: "#e2e8f0",
    onSurfaceVariant: "#94a3b8",
    outline: "#334155",
    outlineVariant: "#1e293b",
    error: ciscoPalette.critical,
    elevation: {
      level0: "transparent",
      level1: "#111827",
      level2: "#1a2332",
      level3: "#1e293b",
      level4: "#253348",
      level5: "#2d3d55",
    },
  },
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: ciscoPalette.ciscoDarkBlue,
    primaryContainer: "rgba(4, 159, 217, 0.12)",
    secondary: ciscoPalette.ciscoMagenta,
    secondaryContainer: "rgba(230, 0, 126, 0.1)",
    tertiary: ciscoPalette.sfBlue,
    background: "#f1f5f9",
    surface: "#ffffff",
    surfaceVariant: "#e2e8f0",
    onBackground: "#0f172a",
    onSurface: "#0f172a",
    onSurfaceVariant: "#64748b",
    outline: "#cbd5e1",
    outlineVariant: "#e2e8f0",
    error: ciscoPalette.critical,
    elevation: {
      level0: "transparent",
      level1: "#ffffff",
      level2: "#f8fafc",
      level3: "#f1f5f9",
      level4: "#e2e8f0",
      level5: "#cbd5e1",
    },
  },
};

export const palette = ciscoPalette;

export type AppThemeMode = "system" | "light" | "dark";
