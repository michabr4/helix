import React, { useMemo } from "react";
import { useColorScheme, StatusBar, StyleSheet, View } from "react-native";
import { PaperProvider, ActivityIndicator } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { darkTheme, lightTheme } from "./src/theme/theme";
import { AuthProvider } from "./src/auth/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  const colorScheme = useColorScheme();
  const theme = useMemo(
    () => (colorScheme === "dark" ? darkTheme : lightTheme),
    [colorScheme]
  );

  const navTheme = useMemo(
    () => ({
      dark: colorScheme === "dark",
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.outline,
        notification: theme.colors.error,
      },
      fonts: {
        regular: { fontFamily: "System", fontWeight: "400" as const },
        medium: { fontFamily: "System", fontWeight: "500" as const },
        bold: { fontFamily: "System", fontWeight: "700" as const },
        heavy: { fontFamily: "System", fontWeight: "800" as const },
      },
    }),
    [colorScheme, theme]
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={theme.colors.background}
        />
        <NavigationContainer theme={navTheme}>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
