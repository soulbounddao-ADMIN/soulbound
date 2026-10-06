import { useRouter } from "expo-router";
import React, { useState } from "react";
import { getMyApplication, getMyMembership } from "../src/api/endpoints";
import { useAuth } from "../src/auth/auth-provider";
import { resolveHomeRoute } from "../src/domain/admission";
import { rememberApplicationId } from "../src/lib/application-memory";
import { Button, Field, Heading, Message, Screen } from "../src/ui/components";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, api } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const role = await signIn(username.trim(), password);
      const [application, membership] = await Promise.all([
        getMyApplication(api),
        getMyMembership(api),
      ]);
      if (!application.ok || !membership.ok) {
        throw new Error("Unable to resolve account state");
      }
      if (application.data) {
        rememberApplicationId(application.data.id);
      }
      router.replace(resolveHomeRoute(role, membership.data));
    } catch {
      setErrorMessage("아이디 또는 비밀번호를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={["bottom", "left", "right"]}>
      <Heading title="로그인" description="아이디와 비밀번호를 입력해 주세요. 복구는 제공하지 않습니다." />
      <Field
        label="아이디"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        maxLength={24}
      />
      <Field
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void handleSubmit()}
      />
      <Message text={errorMessage} />
      <Button
        label={submitting ? "확인 중" : "로그인"}
        onPress={() => void handleSubmit()}
        disabled={submitting || !username.trim() || !password}
      />
      <Button label="가입하기" tone="quiet" onPress={() => router.replace("/signup")} />
    </Screen>
  );
}
