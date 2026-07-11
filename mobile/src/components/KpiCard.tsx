import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { palette } from "../theme/theme";

interface Props {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
}

export default function KpiCard({ label, value, delta, deltaPositive }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
      <Text variant="labelSmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text variant="headlineMedium" style={[styles.value, { color: theme.colors.onSurface }]}>
        {value}
      </Text>
      {delta && (
        <Text
          variant="labelSmall"
          style={{ color: deltaPositive ? palette.ok : palette.critical, marginTop: 2 }}
        >
          {delta}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minWidth: 140,
    flex: 1,
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 10,
    marginBottom: 4,
  },
  value: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
