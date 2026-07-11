import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Column {
  key: string;
  label: string;
  flex?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { [key: string]: any };

interface Props {
  columns: Column[];
  rows: Row[];
  emptyMessage?: string;
}

export default function DataTable({ columns, rows, emptyMessage = "No data" }: Props) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.table}>
        <View style={[styles.headerRow, { borderBottomColor: theme.colors.outline }]}>
          {columns.map((col) => (
            <View key={col.key} style={[styles.cell, { flex: col.flex ?? 1 }]}>
              <Text variant="labelSmall" style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>
        {rows.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {emptyMessage}
            </Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <View
              key={i}
              style={[
                styles.row,
                {
                  borderBottomColor: theme.colors.outlineVariant,
                  backgroundColor: i % 2 === 0 ? "transparent" : theme.colors.elevation.level1,
                },
              ]}
            >
              {columns.map((col) => (
                <View key={col.key} style={[styles.cell, { flex: col.flex ?? 1 }]}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurface }} numberOfLines={2}>
                    {String(row[col.key] ?? "—")}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: {
    minWidth: 500,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerText: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontSize: 10,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cell: {
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  emptyRow: {
    padding: 20,
    alignItems: "center",
  },
});
