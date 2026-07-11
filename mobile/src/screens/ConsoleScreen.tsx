import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, useTheme, Card } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { palette } from "../theme/theme";

interface ConsoleRow {
  name: string;
  persona: string;
  gates: string;
  status: "ok" | "warn" | "info";
  icon: string;
}

const CONSOLES: ConsoleRow[] = [
  { name: "SDM Console", persona: "SDM · TAM", gates: "Gate 1–17", status: "ok", icon: "account-tie" },
  { name: "PM Console", persona: "PM · Ops Lead", gates: "Gate 1–17", status: "ok", icon: "chart-timeline-variant" },
  { name: "CXM Console", persona: "CXM · CSM", gates: "Gate 1–17", status: "ok", icon: "account-group" },
  { name: "Renewals Console", persona: "Renewals Mgr", gates: "Gate 1–17", status: "ok", icon: "autorenew" },
  { name: "Delivery Architect", persona: "DA · Architect", gates: "Gate 1–17", status: "ok", icon: "drawing" },
  { name: "Engineer Console", persona: "Engineer · NE", gates: "Gate 1–17", status: "ok", icon: "wrench" },
  { name: "Cisco API Console", persona: "DevNet", gates: "Gate 1–17", status: "ok", icon: "api" },
  { name: "Meraki Dashboard (DD-K)", persona: "SDM · Engineer", gates: "DD Wave K", status: "info", icon: "access-point" },
  { name: "AppDynamics APM (DD-L)", persona: "SDM · PM", gates: "DD Wave L", status: "info", icon: "chart-areaspline" },
  { name: "Salesforce CRM (W-17)", persona: "All SDC", gates: "Wave 17", status: "info", icon: "cloud-outline" },
];

export default function ConsoleScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionHeader
          title="Console ↔ Wave Map"
          subtitle="SDC persona consoles and their integration waves"
        />

        {CONSOLES.map((c, i) => (
          <Card
            key={i}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
            mode="outlined"
          >
            <Card.Content style={styles.row}>
              <MaterialCommunityIcons
                name={c.icon}
                size={26}
                color={c.status === "info" ? palette.ciscoBlue : palette.ok}
              />
              <View style={styles.text}>
                <Text variant="titleSmall">{c.name}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {c.persona}
                </Text>
              </View>
              <View style={styles.right}>
                <StatusBadge label={c.gates} severity={c.status} />
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 24 },
  card: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1 },
  right: { alignItems: "flex-end" },
});
