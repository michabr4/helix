import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, useTheme, ActivityIndicator, Chip, Card } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBadge from "../components/StatusBadge";
import SectionHeader from "../components/SectionHeader";
import KpiCard from "../components/KpiCard";
import { apiGet, AuthError } from "../api";
import { useAuth } from "../auth/AuthContext";

interface Incident {
  incident_id: number;
  title: string;
  severity: string;
  status: string;
  property_name?: string;
  created_at?: string;
}

type SeverityFilter = "all" | "P1" | "P2" | "P3" | "P4";

function severityToSeverity(s: string): "critical" | "warn" | "info" | "ok" {
  if (s === "P1") return "critical";
  if (s === "P2") return "warn";
  if (s === "P3") return "info";
  return "ok";
}

export default function IncidentsScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>("all");

  const fetch = useCallback(async () => {
    try {
      const res = await apiGet<{ rows: Incident[] }>("/incidents");
      setIncidents(res.rows ?? []);
    } catch (e) {
      if (e instanceof AuthError) await logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.severity === filter);
  const p1Count = incidents.filter((i) => i.severity === "P1").length;
  const openCount = incidents.filter((i) => i.status === "open").length;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetch(); }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <SectionHeader title="Incidents" subtitle={`${incidents.length} total`} />

        <View style={styles.kpiRow}>
          <KpiCard label="Open" value={openCount} />
          <KpiCard label="P1 critical" value={p1Count} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {(["all", "P1", "P2", "P3", "P4"] as SeverityFilter[]).map((s) => (
            <Chip key={s} selected={filter === s} onPress={() => setFilter(s)} style={styles.chip} compact>
              {s === "all" ? "All" : s}
            </Chip>
          ))}
        </ScrollView>

        <View style={styles.cards}>
          {filtered.length === 0 && (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 20 }}>
              No incidents found
            </Text>
          )}
          {filtered.map((inc) => (
            <Card
              key={inc.incident_id}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
              mode="outlined"
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <StatusBadge label={inc.severity} severity={severityToSeverity(inc.severity)} />
                  <StatusBadge label={inc.status} severity={inc.status === "open" ? "warn" : "ok"} />
                </View>
                <Text variant="titleSmall" style={{ marginTop: 6 }}>
                  {inc.title}
                </Text>
                {inc.property_name && (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                    {inc.property_name}
                  </Text>
                )}
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingBottom: 24 },
  kpiRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  chips: { paddingHorizontal: 16, marginBottom: 12 },
  chip: { marginRight: 6 },
  cards: { paddingHorizontal: 16 },
  card: { marginBottom: 10, borderRadius: 10 },
  cardHeader: { flexDirection: "row", gap: 8 },
});
