import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Searchbar, useTheme, ActivityIndicator, Chip } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import DataTable from "../components/DataTable";
import SectionHeader from "../components/SectionHeader";
import KpiCard from "../components/KpiCard";
import { apiGet, AuthError } from "../api";
import { useAuth } from "../auth/AuthContext";

interface Device {
  device_id: number;
  hostname: string;
  ip_address: string;
  device_type: string;
  os_version: string;
  status: string;
  property_name?: string;
}

const COLUMNS = [
  { key: "hostname", label: "Hostname", flex: 1.5 },
  { key: "ip_address", label: "IP", flex: 1.2 },
  { key: "device_type", label: "Type", flex: 1 },
  { key: "status", label: "Status", flex: 0.8 },
  { key: "os_version", label: "OS", flex: 1 },
];

export default function DevicesScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiGet<{ rows: Device[] }>("/devices");
      setDevices(res.rows ?? []);
    } catch (e) {
      if (e instanceof AuthError) await logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const types = [...new Set(devices.map((d) => d.device_type).filter(Boolean))];

  const filtered = devices.filter((d) => {
    const matchQ =
      !query ||
      d.hostname?.toLowerCase().includes(query.toLowerCase()) ||
      d.ip_address?.includes(query);
    const matchType = !filterType || d.device_type === filterType;
    return matchQ && matchType;
  });

  const reachable = devices.filter((d) => d.status === "reachable").length;

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
            onRefresh={() => { setRefreshing(true); fetchDevices(); }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <SectionHeader title="Device inventory" subtitle={`${devices.length} total devices`} />

        <View style={styles.kpiRow}>
          <KpiCard label="Total" value={devices.length} />
          <KpiCard label="Reachable" value={reachable} delta={`${((reachable / (devices.length || 1)) * 100).toFixed(1)}%`} deltaPositive />
        </View>

        <Searchbar
          placeholder="Search hostname or IP"
          value={query}
          onChangeText={setQuery}
          style={[styles.search, { backgroundColor: theme.colors.surface }]}
          inputStyle={{ fontSize: 14 }}
        />

        {types.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            <Chip
              selected={!filterType}
              onPress={() => setFilterType(null)}
              style={styles.chip}
              compact
            >
              All
            </Chip>
            {types.map((t) => (
              <Chip
                key={t}
                selected={filterType === t}
                onPress={() => setFilterType(filterType === t ? null : t)}
                style={styles.chip}
                compact
              >
                {t}
              </Chip>
            ))}
          </ScrollView>
        )}

        <View style={styles.tableWrap}>
          <DataTable columns={COLUMNS} rows={filtered} emptyMessage="No devices match your search" />
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
  search: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10 },
  chips: { paddingHorizontal: 16, marginBottom: 12 },
  chip: { marginRight: 6 },
  tableWrap: { paddingHorizontal: 16 },
});
