import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { List, useTheme, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MoreStackParams } from "../navigation/AppNavigator";

type Props = {
  navigation: NativeStackNavigationProp<MoreStackParams, "MoreMenu">;
};

export default function MoreMenuScreen({ navigation }: Props) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView>
        <List.Section>
          <List.Subheader>Integrations</List.Subheader>
          <List.Item
            title="Salesforce CRM"
            description="Cases, contacts, opportunities"
            left={(props) => <List.Icon {...props} icon="cloud-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("Salesforce")}
          />
          <Divider />
          <List.Item
            title="Console Wave Map"
            description="SDC persona consoles and integration waves"
            left={(props) => <List.Icon {...props} icon="view-grid-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("Console")}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>App</List.Subheader>
          <List.Item
            title="Settings"
            description="Theme, accessibility, account"
            left={(props) => <List.Icon {...props} icon="cog-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("Settings")}
          />
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
