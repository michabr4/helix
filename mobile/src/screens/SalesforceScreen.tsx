import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, useTheme, ActivityIndicator, Card, SegmentedButtons } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBadge from "../components/StatusBadge";
import SectionHeader from "../components/SectionHeader";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import { apiGet, AuthError } from "../api";
import { useAuth } from "../auth/AuthContext";

type Tab = "cases" | "contacts" | "opps";

interface SfCase {
  Id: string;
  CaseNumber: string;
  Subject: string;
  Status: string;
  Priority: string;
}

interface SfContact {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Title?: string;
}

interface SfOpp {
  Id: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CloseDate?: string;
}

const CASE_COLS = [
  { key: "CaseNumber", label: "#", flex: 0.8 },
  { key: "Subject", label: "Subject", flex: 2 },
  { key: "Priority", label: "Priority", flex: 0.8 },
  { key: "Status", label: "Status", flex: 0.8 },
];

const CONTACT_COLS = [
  { key: "name", label: "Name", flex: 1.5 },
  { key: "Email", label: "Email", flex: 1.5 },
  { key: "Title", label: "Title", flex: 1 },
];

const OPP_COLS = [
  { key: "Name", label: "Opportunity", flex: 2 },
  { key: "StageName", label: "Stage", flex: 1 },
  { key: "Amount", label: "Amount", flex: 0.8 },
];

export default function SalesforceScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>("cases");
  const [cases, setCases] = useState<SfCase[]>([]);
  const [contacts, setContacts] = useState<SfContact[]>([]);
  const [opps, setOpps] = useState<SfOpp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [c, ct, o] = await Promise.allSettled([
        apiGet<{ totalSize: number; records: SfCase[] }>("/salesforce/cases"),
        apiGet<{ totalSize: number; records: SfContact[] }>("/salesforce/contacts"),
        apiGet<{ totalSize: number; records: SfOpp[] }>("/salesforce/opportunities"),
      ]);
      if (c.status === "fulfilled") setCases(c.value.records ?? []);
      if (ct.status === "fulfilled") setContacts(ct.value.records ?? []);
      if (o.status === "fulfilled") setOpps(o.value.records ?? []);
    } catch (e) {
      if (e instanceof AuthError) await logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const contactRows = contacts.map((c) => ({
    ...c,
    name: [c.FirstName, c.LastName].filter(Boolean).join(" "),
  }));

  const oppRows = opps.map((o) => ({
    ...o,
    Amount: o.Amount != null ? `$${(o.Amount / 1000).toFixed(0)}K` : "—",
  }));

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(); }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <SectionHeader title="Salesforce CRM" />

        <View style={styles.kpiRow}>
          <KpiCard label="Open cases" value={cases.length} />
          <KpiCard label="Contacts" value={contacts.length} />
          <KpiCard label="Opps" value={opps.length} />
        </View>

        <View style={styles.segmentWrap}>
          <SegmentedButtons
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            buttons={[
              { value: "cases", label: "Cases" },
              { value: "contacts", label: "Contacts" },
              { value: "opps", label: "Opportunities" },
            ]}
          />
        </View>

        <View style={styles.tableWrap}>
          {tab === "cases" && <DataTable columns={CASE_COLS} rows={cases} emptyMessage="No cases" />}
          {tab === "contacts" && <DataTable columns={CONTACT_COLS} rows={contactRows} emptyMessage="No contacts" />}
          {tab === "opps" && <DataTable columns={OPP_COLS} rows={oppRows} emptyMessage="No opportunities" />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingBottom: 24 },
  kpiRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  segmentWrap: { paddingHorizontal: 16, marginBottom: 16 },
  tableWrap: { paddingHorizontal: 16 },
});
