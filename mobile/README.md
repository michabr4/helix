# Helix — Mobile App

Cross-platform mobile client for iOS and Android built with **Expo** (React Native) and **React Native Paper** (Material Design 3).

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 52 / React Native 0.76 |
| UI library | React Native Paper (MD3) |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| Auth | `expo-auth-session` (OIDC + PKCE for SSO) / JWT local login |
| Token storage | `expo-secure-store` (iOS Keychain / Android Keystore) |
| API transport | `fetch` with Bearer token headers |
| Theming | Dark + Light (auto or manual), Cisco brand palette |

## Screens

| Screen | Description |
|--------|-------------|
| **Login** | SSO (OIDC + PKCE) button + email/password fallback |
| **Dashboard** | KPI cards, AI Copilot insights, pull-to-refresh |
| **Devices** | Device inventory with search, type filters, data table |
| **Incidents** | Incident cards with severity filter chips (P1–P4) |
| **Properties** | Managed site cards with device counts |
| **Salesforce CRM** | Segmented view: Cases / Contacts / Opportunities |
| **Console Wave Map** | SDC persona consoles and integration wave mapping |
| **Settings** | Theme, text size, blue light filter, reduced motion, haptics, sign out |

## SSO Flow

1. Mobile app hits `GET /api/v1/auth/sso/discovery` to check if SSO is enabled and retrieve issuer/clientId.
2. If enabled, user taps "Sign in with SSO" which opens the system browser via `expo-auth-session`.
3. OIDC Authorization Code + PKCE flow runs entirely through the browser.
4. On callback, tokens are exchanged and stored in `expo-secure-store` (backed by iOS Keychain / Android Keystore).
5. If SSO is not configured, users fall back to email + password local login against `/api/v1/auth/login`.

## Quick Start

```bash
cd helix-sdm/mobile
cp .env.example .env          # set API_BASE_URL
npm install
npx expo start                # opens Expo DevTools
```

Scan the QR code with **Expo Go** (iOS/Android) or press `i`/`a` for simulators.

## Building for Production

```bash
# iOS
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release

# EAS Build (recommended for CI)
npx eas build --platform ios
npx eas build --platform android
```

## Project Structure

```
mobile/
├── App.tsx                        # Entry point, providers, navigation
├── app.json                       # Expo config (bundle IDs, splash, plugins)
├── src/
│   ├── api.ts                     # API client (SecureStore tokens, fetch wrappers)
│   ├── auth/
│   │   └── AuthContext.tsx         # Auth state, SSO flow, local login
│   ├── components/
│   │   ├── AiInsightCard.tsx       # AI insight card with DD/urgent tags
│   │   ├── DataTable.tsx           # Horizontal-scrollable data table
│   │   ├── KpiCard.tsx             # KPI metric card
│   │   ├── SectionHeader.tsx       # Screen section header
│   │   └── StatusBadge.tsx         # Colored severity badge
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Auth stack + main tab + more stack
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── DevicesScreen.tsx
│   │   ├── IncidentsScreen.tsx
│   │   ├── PropertiesScreen.tsx
│   │   ├── SalesforceScreen.tsx
│   │   ├── ConsoleScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── MoreMenuScreen.tsx
│   ├── theme/
│   │   └── theme.ts               # Dark/light themes, Cisco palette
│   └── types/
│       └── vector-icons.d.ts       # Type declarations for icon library
└── .env.example
```

## Security

- **Token storage**: `expo-secure-store` uses iOS Keychain / Android Keystore — hardware-backed encryption.
- **SSO**: Full OIDC Authorization Code + PKCE — no secrets stored on device.
- **No hardcoded credentials**: All API config loaded from environment.
- **HTTPS**: All production API calls over TLS; dev may use local HTTP.
- **Biometrics**: FaceID/TouchID permission declared for future SecureStore biometric gating.
