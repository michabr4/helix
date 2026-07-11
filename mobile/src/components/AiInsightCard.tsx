import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { palette } from "../theme/theme";

interface Props {
  title: string;
  body: string;
  urgent?: boolean;
  dd?: boolean;
}

export default function AiInsightCard({ title, body, urgent, dd }: Props) {
  const theme = useTheme();
  const borderColor = urgent
    ? palette.ciscoPink
    : dd
    ? palette.ddMagenta
    : theme.colors.outline;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor,
          borderLeftWidth: 3,
        },
      ]}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons
          name={urgent ? "alert" : "lightbulb-on-outline"}
          size={16}
          color={urgent ? palette.ciscoPink : palette.ciscoBlue}
        />
        <Text variant="labelMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        {dd && (
          <View style={styles.ddTag}>
            <Text style={styles.ddText}>DD</Text>
          </View>
        )}
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  title: {
    fontWeight: "700",
    flex: 1,
  },
  ddTag: {
    backgroundColor: "rgba(255,27,141,0.15)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ddText: {
    fontSize: 9,
    fontWeight: "800",
    color: palette.ddMagenta,
    letterSpacing: 0.5,
  },
});
