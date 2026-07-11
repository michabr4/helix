import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { palette } from "../theme/theme";

type Severity = "ok" | "warn" | "critical" | "info";

const colorMap: Record<Severity, { bg: string; fg: string }> = {
  ok: { bg: "rgba(34,197,94,0.15)", fg: palette.ok },
  warn: { bg: "rgba(245,158,11,0.15)", fg: palette.warn },
  critical: { bg: "rgba(239,68,68,0.15)", fg: palette.critical },
  info: { bg: "rgba(4,159,217,0.15)", fg: palette.ciscoBlue },
};

interface Props {
  label: string;
  severity?: Severity;
}

export default function StatusBadge({ label, severity = "info" }: Props) {
  const { bg, fg } = colorMap[severity];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
