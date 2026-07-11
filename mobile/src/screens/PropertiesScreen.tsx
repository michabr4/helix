import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, useTheme, ActivityIndicator, Card } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import SectionHeader from "../components/SectionHeader";
import { apiGet, AuthError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../theme/theme";

interface Property {
  property_id: number;
  name: string;
  site_code: string;
  locale: string;
  device_count?: number;
}

export default function PropertiesScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProps = useCallback(async () => {
    try {
      const res = await apiGet<{ rows: Property[] }>("/properties");
      setProperties(res.rows ?? []);
    } catch (e) {
      if (e instanceof AuthError) await logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchProps();
  }, [fetchProps]);

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
            onRefresh={() => { setRefreshing(true); fetchProps(); }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <SectionHeader title="Properties" subtitle={`${properties.length} managed sites`} />

        {properties.length === 0 && (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 20, paddingHorizontal: 16 }}>
            No properties loaded. Pull to refresh.
          </Text>
        )}

        {properties.map((p) => (
          <Card
            key={p.property_id}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
            mode="outlined"
          >
            <Card.Content style={styles.cardContent}>
              <MaterialCommunityIcons name="office-building" size={28} color={palette.ciscoBlue} />
              <View style={styles.cardText}>
                <Text variant="titleSmall">{p.name}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {p.site_code} · {p.locale}
                </Text>
                {p.device_count != null && (
                  <Text variant="labelSmall" style={{ color: theme.colors.primary, marginTop: 2 }}>
                    {p.device_count} devices
                  </Text>
                )}
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingBottom: 24 },
  card: { marginHorizontal: 16, marginBottom: 10, borderRadius: 10 },
  cardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardText: { flex: 1 },
});
