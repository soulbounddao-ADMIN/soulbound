import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth/auth-provider";
import { BlockProvider } from "../src/lib/block-store";
import { colors } from "../src/ui/theme";

function RootNavigator() {
  const { signedIn, loading } = useAuth();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!signedIn || loading}>
        <Stack.Screen name="login" options={{ title: "로그인" }} />
        <Stack.Screen name="signup" options={{ title: "가입하기" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="gate" options={{ title: "입장 절차" }} />
        <Stack.Screen name="apply/index" options={{ title: "입장 신청" }} />
        <Stack.Screen name="apply/status" options={{ title: "내 신청 현황" }} />
        <Stack.Screen name="member" options={{ headerShown: false }} />
        <Stack.Screen name="vote/[voteId]" options={{ title: "투표 상세" }} />
        <Stack.Screen name="board/[postId]" options={{ title: "게시글" }} />
        <Stack.Screen name="reviewer" options={{ title: "검토" }} />
        <Stack.Screen name="settings" options={{ title: "설정" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BlockProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </BlockProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
