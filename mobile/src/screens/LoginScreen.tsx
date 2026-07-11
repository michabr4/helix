import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  Button,
  Text,
  TextInput,
  useTheme,
  Divider,
  HelperText,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../theme/theme";

export default function LoginScreen() {
  const theme = useTheme();
  const { loginWithCredentials, loginWithSso, ssoConfig } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState("");
  const [secureEntry, setSecureEntry] = useState(true);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await loginWithCredentials(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async () => {
    setError("");
    setSsoLoading(true);
    try {
      await loginWithSso();
    } catch (e) {
      setError(e instanceof Error ? e.message : "SSO failed");
    } finally {
      setSsoLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoArea}>
            <Text
              variant="headlineLarge"
              style={[styles.brand, { color: theme.colors.primary }]}
            >
              Helix
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Helix
            </Text>
          </View>

          {ssoConfig && (
            <>
              <Button
                mode="contained"
                onPress={handleSso}
                loading={ssoLoading}
                disabled={ssoLoading || loading}
                icon="shield-lock-outline"
                style={styles.ssoBtn}
                contentStyle={styles.btnContent}
                labelStyle={styles.btnLabel}
              >
                Sign in with SSO
              </Button>

              <View style={styles.dividerRow}>
                <Divider style={[styles.divLine, { backgroundColor: theme.colors.outline }]} />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginHorizontal: 12 }}>
                  or use credentials
                </Text>
                <Divider style={[styles.divLine, { backgroundColor: theme.colors.outline }]} />
              </View>
            </>
          )}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            style={styles.input}
            left={<TextInput.Icon icon="email-outline" />}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            autoComplete="password"
            textContentType="password"
            style={styles.input}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={secureEntry ? "eye-off" : "eye"}
                onPress={() => setSecureEntry(!secureEntry)}
              />
            }
          />

          {!!error && (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || ssoLoading || !email.trim() || !password}
            style={styles.loginBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            Sign in
          </Button>

          <Text
            variant="bodySmall"
            style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}
          >
            Internal tool — authorized Cisco personnel only
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 36,
  },
  brand: {
    fontWeight: "800",
    letterSpacing: -1,
    fontSize: 42,
  },
  ssoBtn: {
    marginBottom: 12,
    borderRadius: 10,
  },
  btnContent: {
    paddingVertical: 6,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  divLine: {
    flex: 1,
    height: 1,
  },
  input: {
    marginBottom: 12,
  },
  error: {
    marginBottom: 4,
  },
  loginBtn: {
    marginTop: 4,
    borderRadius: 10,
  },
  footer: {
    textAlign: "center",
    marginTop: 28,
    fontSize: 11,
  },
});
