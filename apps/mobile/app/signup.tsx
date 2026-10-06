import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { UsernameAlreadyExistsError, useAuth } from "../src/auth/auth-provider";
import { isValidUsername, MIN_PASSWORD_LENGTH } from "../src/auth/username";
import { appConfig, termsUrl } from "../src/config";
import { openExternal } from "../src/lib/links";
import { Button, Field, Heading, Message, Row, Screen, styles } from "../src/ui/components";
import { colors } from "../src/ui/theme";

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    setMessage("");
    if (!isValidUsername(username) || password.length < MIN_PASSWORD_LENGTH) {
      setMessage("아이디 또는 비밀번호를 확인해 주세요.");
      return;
    }
    if (!agreed) {
      setMessage("이용약관에 동의해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(username, password);
      router.replace("/gate");
    } catch (error) {
      setMessage(
        error instanceof UsernameAlreadyExistsError
          ? "이미 사용 중인 아이디입니다."
          : "아이디 또는 비밀번호를 확인해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={["bottom", "left", "right"]}>
      <Heading
        title="가입하기"
        description="아이디와 비밀번호를 저장해 주세요. 복구는 제공하지 않으며, 분실하면 멤버십을 잃게 됩니다."
      />
      <Field
        label="아이디"
        hint="소문자·숫자·-·_ 3~24자"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={24}
      />
      <Field
        label="비밀번호"
        hint="6자 이상"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed((value) => !value)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: agreed ? colors.accent : colors.border,
            backgroundColor: agreed ? colors.accent : colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {agreed ? <Text style={{ color: colors.accentText, fontWeight: "700" }}>✓</Text> : null}
        </View>
        <Text style={styles.body}>이용약관에 동의합니다</Text>
      </Pressable>
      <Row>
        <Button
          label="약관 보기"
          tone="quiet"
          onPress={() => void openExternal(termsUrl(), "약관 주소가 설정되지 않았습니다.")}
        />
        <Button
          label="개인정보 처리방침"
          tone="quiet"
          onPress={() => void openExternal(appConfig.privacyPolicyUrl, "개인정보 처리방침 주소가 아직 준비되지 않았습니다.")}
        />
      </Row>
      <Message text={message} />
      <Button
        label={submitting ? "가입 중" : "가입하기"}
        onPress={() => void handleSubmit()}
        disabled={submitting}
      />
      <Button label="이미 계정이 있습니다" tone="quiet" onPress={() => router.replace("/login")} />
    </Screen>
  );
}
