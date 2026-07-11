import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import { useAuth } from "../auth/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import DevicesScreen from "../screens/DevicesScreen";
import IncidentsScreen from "../screens/IncidentsScreen";
import PropertiesScreen from "../screens/PropertiesScreen";
import SalesforceScreen from "../screens/SalesforceScreen";
import ConsoleScreen from "../screens/ConsoleScreen";
import SettingsScreen from "../screens/SettingsScreen";

export type AuthStackParams = {
  Login: undefined;
};

export type MainTabParams = {
  Dashboard: undefined;
  Devices: undefined;
  Incidents: undefined;
  Properties: undefined;
  More: undefined;
};

export type MoreStackParams = {
  MoreMenu: undefined;
  Salesforce: undefined;
  Console: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const MainTab = createBottomTabNavigator<MainTabParams>();
const MoreStack = createNativeStackNavigator<MoreStackParams>();

function MoreNavigator() {
  const theme = useTheme();
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      <MoreStack.Screen
        name="MoreMenu"
        component={MoreMenuScreen}
        options={{ title: "More" }}
      />
      <MoreStack.Screen
        name="Salesforce"
        component={SalesforceScreen}
        options={{ title: "Salesforce CRM" }}
      />
      <MoreStack.Screen
        name="Console"
        component={ConsoleScreen}
        options={{ title: "Console Wave Map" }}
      />
      <MoreStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
    </MoreStack.Navigator>
  );
}

import MoreMenuScreen from "../screens/MoreMenuScreen";

function MainNavigator() {
  const theme = useTheme();
  return (
    <MainTab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <MainTab.Screen
        name="Devices"
        component={DevicesScreen}
        options={{
          title: "Devices",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="router-wireless" size={size} color={color} />
          ),
        }}
      />
      <MainTab.Screen
        name="Incidents"
        component={IncidentsScreen}
        options={{
          title: "Incidents",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="alert-circle" size={size} color={color} />
          ),
        }}
      />
      <MainTab.Screen
        name="Properties"
        component={PropertiesScreen}
        options={{
          title: "Properties",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="office-building" size={size} color={color} />
          ),
        }}
      />
      <MainTab.Screen
        name="More"
        component={MoreNavigator}
        options={{
          headerShown: false,
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="dots-horizontal-circle" size={size} color={color} />
          ),
        }}
      />
    </MainTab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
      </AuthStack.Navigator>
    );
  }

  return <MainNavigator />;
}
