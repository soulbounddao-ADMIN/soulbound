import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { getMyMembership } from "../src/api/endpoints";
import { useAuth } from "../src/auth/auth-provider";
import { resolveHomeRoute } from "../src/domain/admission";
import { useSessionGuard } from "../src/lib/use-session-guard";
import {
  Body,
  Button,
  Card,
  EmptyState,
  Loading,
  Message,
  Screen,
  styles,
} from "../src/ui/components";

function SessionRestore() {
  const router = useRouter();
  const { api, role } = useAuth();
  const guard = useSessionGuard();
  const [error, setError] = useState("");

  const resolve = useCallback(async () => {
    setError("");
    try {
      const membership = await getMyMembership(api);
      if (await guard(membership.status)) {
        return;
      }
      if (!membership.ok) {
        throw new Error("membership");
      }
      router.replace(resolveHomeRoute(role, membership.data));
    } catch (caught) {
      if (!(await guard(caught))) {
        setError("입장 상태를 불러오지 못했습니다.");
      }
    }
  }, [api, guard, role, router]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  return (
    <Screen>
      {error ? (
        <>
          <Message text={error} />
          <Button label="다시 시도" tone="secondary" onPress={() => void resolve()} />
          <Button label="입장 절차 보기" tone="quiet" onPress={() => router.replace("/gate")} />
        </>
      ) : (
        <Loading label="현재 상태를 확인하는 중입니다." />
      )}
    </Screen>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const { configured, loading, signedIn } = useAuth();

  if (loading) {
    return (
      <Screen>
        <Loading label="잠시만 기다려 주세요." />
      </Screen>
    );
  }
  if (signedIn) {
    return <SessionRestore />;
  }

  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 32 }}>
        <Text style={styles.title} accessibilityRole="header">SoulBound</Text>
        <Body>
          신뢰가 확인된 사람만 들어오는 비공개 멤버 공간.
          가입하고, 입장을 신청하고, 멤버들과 게시판에서 이야기합니다.
        </Body>
      </View>
      {!configured ? (
        <EmptyState title="앱 설정이 필요합니다">
          EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / EXPO_PUBLIC_API_BASE_URL 값을 설정해 주세요.
        </EmptyState>
      ) : null}
      <Button label="가입하기" onPress={() => router.push("/signup")} disabled={!configured} />
      <Button label="로그인" tone="secondary" onPress={() => router.push("/login")} disabled={!configured} />
      <Card>
        <Body>1. 아이디와 비밀번호로 계정을 만듭니다.</Body>
        <Body>2. 짧은 입장 신청을 보냅니다.</Body>
        <Body>3. 승인 후 멤버 명부, 입장 투표, 게시판을 사용합니다.</Body>
      </Card>
    </Screen>
  );
}
