import React, { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import {
  Text,
  useTheme,
  Switch,
  Divider,
  Button,
  SegmentedButtons,
  List,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../theme/theme";
import SectionHeader from "../components/SectionHeader";

export default function SettingsScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const [themeMode, setThemeMode] = useState<string>("system");
  const [blueLight, setBlueLight] = useState<string>("off");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [textSize, setTextSize] = useState<string>("normal");

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionHeader title="Appearance" />

        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.label}>Theme</Text>
          <SegmentedButtons
            value={themeMode}
            onValueChange={setThemeMode}
            buttons={[
              { value: "system", label: "Auto" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.label}>Text size</Text>
          <SegmentedButtons
            value={textSize}
            onValueChange={setTextSize}
            buttons={[
              { value: "small", label: "A−" },
              { value: "normal", label: "A" },
              { value: "large", label: "A+" },
              { value: "xlarge", label: "A++" },
            ]}
          />
        </View>

        <Divider style={styles.divider} />

        <SectionHeader title="Accessibility" />

        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.label}>Blue light filter</Text>
          <SegmentedButtons
            value={blueLight}
            onValueChange={setBlueLight}
            buttons={[
              { value: "off", label: "Off" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Med" },
              { value: "high", label: "High" },
            ]}
          />
        </View>

        <List.Item
          title="Reduce motion"
          description="Minimize animations throughout the app"
          right={() => <Switch value={reducedMotion} onValueChange={setReducedMotion} />}
          style={styles.listItem}
        />

        <List.Item
          title="Haptic feedback"
          description="Vibration feedback on interactions"
          right={() => <Switch value={haptics} onValueChange={setHaptics} />}
          style={styles.listItem}
        />

        <Divider style={styles.divider} />

        <SectionHeader title="Account" />

        <List.Item
          title="App version"
          description="0.1.0 (Expo SDK 52)"
          left={(props) => <List.Icon {...props} icon="information-outline" />}
          style={styles.listItem}
        />

        <List.Item
          title="API endpoint"
          description="Configured via environment"
          left={(props) => <List.Icon {...props} icon="api" />}
          style={styles.listItem}
        />

        <View style={styles.logoutWrap}>
          <Button
            mode="outlined"
            onPress={logout}
            icon="logout"
            textColor={palette.critical}
            style={styles.logoutBtn}
          >
            Sign out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  label: { marginBottom: 8 },
  divider: { marginVertical: 8 },
  listItem: { paddingHorizontal: 16 },
  logoutWrap: { paddingHorizontal: 16, marginTop: 20 },
  logoutBtn: { borderColor: palette.critical, borderRadius: 10 },
});
