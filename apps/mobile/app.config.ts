import type { ConfigContext, ExpoConfig } from "expo/config";

const BACKGROUND = "#FAF9F5";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SoulBound",
  slug: "soulbound",
  scheme: "soulbound",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: BACKGROUND,
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? "com.soulbound.app",
    // buildNumber is managed remotely by EAS (eas.json: cli.appVersionSource = "remote",
    // build.production.autoIncrement = true). Do not set ios.buildNumber here.
    supportsTablet: false,
    infoPlist: {
      // HTTPS only (Supabase Auth + web /api/*), no custom crypto → exempt.
      ITSAppUsesNonExemptEncryption: false,
      // ATS on: no arbitrary HTTP loads in release. Local networking stays allowed for Metro in dev.
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
      },
      // No *UsageDescription keys: the app uses no camera, microphone, photos, location,
      // contacts, tracking, notifications or Face ID. Add one only together with the feature.
    },
    // PrivacyInfo.xcprivacy. Keep in sync with docs/store/APP_STORE_SUBMISSION.md (App Privacy)
    // and the web /privacy page.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          // username (sign-in id) + member number (soulbound-member-N)
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          // admission statement, board posts/comments, optional report detail text
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          // role/membership status, vote participation (not the choice), block list, report status
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherDataTypes",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
      ],
      // Required-reason APIs used by React Native core and autolinked Expo modules
      // (union of their bundled PrivacyInfo.xcprivacy files; Apple does not always merge
      // manifests from static CocoaPods, so they are restated at app level).
      NSPrivacyAccessedAPITypes: [
        {
          // react-native (C617.1), expo-file-system (0A2A.1, 3B52.1)
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
        },
        {
          // react-native, expo-constants
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          // react-native timing
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          // expo-file-system
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
        },
      ],
    },
  },
  plugins: [
    "expo-router",
    // Keychain only; no requireAuthentication → drop the default NSFaceIDUsageDescription.
    ["expo-secure-store", { faceIDPermission: false }],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 160,
        resizeMode: "contain",
        backgroundColor: BACKGROUND,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "",
    accountDeletionUrl: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL ?? "",
    reportUrl: process.env.EXPO_PUBLIC_REPORT_URL ?? "",
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
});
