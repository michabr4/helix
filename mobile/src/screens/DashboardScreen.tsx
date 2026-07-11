import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, useTheme, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import KpiCard from "../components/KpiCard";
import AiInsightCard from "../components/AiInsightCard";
import SectionHeader from "../components/SectionHeader";
import { apiGet, AuthError } from "../api";
import { useAuth } from "../auth/AuthContext";

interface DashboardData {
  properties?: number;
  devices?: number;
  incidents?: number;
  openCases?: number;
  criticalAdvisories?: number;
  slaCompliance?: string;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [props, devices, incidents] = await Promise.allSettled([
        apiGet<{ rows: unknown[] }>("/properties"),
        apiGet<{ rows: unknown[] }>("/devices"),
        apiGet<{ rows: unknown[] }>("/incidents"),
      ]);
      setData({
        properties: props.status === "fulfilled" ? props.value.rows?.length ?? 0 : 0,
        devices: devices.status === "fulfilled" ? devices.value.rows?.length ?? 0 : 0,
        incidents: incidents.status === "fulfilled" ? incidents.value.rows?.length ?? 0 : 0,
        openCases: 47,
        criticalAdvisories: 3,
        slaCompliance: "94.2%",
      });
    } catch (e) {
      if (e instanceof AuthError) await logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <SectionHeader title="Operations overview" subtitle="Pull to refresh live data" />

        <View style={styles.kpiRow}>
          <KpiCard label="Properties" value={data.properties ?? 0} delta="+2 this month" deltaPositive />
          <KpiCard label="Devices" value={data.devices ?? 0} delta="98.1% reachable" deltaPositive />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard label="Incidents" value={data.incidents ?? 0} delta="3 P1 open" />
          <KpiCard label="Open cases" value={data.openCases ?? 0} delta={data.slaCompliance + " SLA"} deltaPositive />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard label="Critical advisories" value={data.criticalAdvisories ?? 0} />
          <KpiCard label="SLA compliance" value={data.slaCompliance ?? "—"} />
        </View>

        <SectionHeader title="AI Copilot insights" />

        <View style={styles.insights}>
          <AiInsightCard
            title="Contract renewal risk"
            body="Two accounts with $1.2M combined ARR show declining CSAT and unresolved P1 incidents within 90 days of renewal. Recommend SDM outreach this week."
            urgent
          />
          <AiInsightCard
            title="Device automation readiness"
            body="78% of IOS-XE fleet qualifies for Digitized Delivery NaC wave. 12 devices need upgrade to 17.9+ before enrollment."
            dd
          />
          <AiInsightCard
            title="Salesforce pipeline alignment"
            body="Three open opportunities totaling $840K are linked to properties with active incident surges. Case-to-opportunity correlation suggests timing risk."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingBottom: 24 },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  insights: {
    paddingHorizontal: 16,
  },
});
