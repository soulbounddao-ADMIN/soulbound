import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { deleteAccount } from "../api/endpoints";
import { useAuth } from "../auth/auth-provider";
import { appConfig, termsUrl } from "../config";
import { useBlocks } from "../lib/block-store";
import { openExternal } from "../lib/links";
import { Badge, Body, Button, Card, ListRow, Message, SectionTitle, styles } from "../ui/components";

export function SettingsContent() {
  const { api, signOut, expireSession } = useAuth();
  const { blocked, syncError, setBlocked, refresh } = useBlocks();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
    } catch {
      setSignOutError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSigningOut(false);
    }
  }

  async function performDeletion() {
    setDeleting(true);
    setDeletionError("");
    try {
      const result = await deleteAccount(api);
      if (!result.ok) {
        setDeletionError(result.status === 401
          ? "로그인이 만료되었습니다. 다시 로그인한 뒤 삭제해 주세요."
          : "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      Alert.alert("계정 삭제 완료", "계정과 관련 데이터가 삭제되었습니다.");
      await signOut().catch(() => expireSession());
    } catch {
      setDeletionError("계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeletion() {
    Alert.alert(
      "계정 삭제",
      "계정, 멤버십, 입장 신청서, Persona Clip, 게시글·댓글, 차단 목록이 즉시 삭제되며 되돌릴 수 없습니다. 운영 기록은 누구인지 알 수 없도록 연결을 끊은 채 남습니다. 삭제할까요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "영구 삭제",
          style: "destructive",
          onPress: () => void performDeletion(),
        },
      ],
    );
  }

  return (
    <>
      <Card>
        <SectionTitle>내 계정</SectionTitle>
        <ListRow title="로그아웃" description="이 기기에서 나갑니다." />
        <Message text={signOutError} />
        <Button
          label={signingOut ? "로그아웃 중" : "로그아웃"}
          tone="secondary"
          onPress={() => void handleSignOut()}
          disabled={signingOut}
        />
      </Card>

      <Card>
        <SectionTitle>개인정보·약관</SectionTitle>
        <ListRow
          title="개인정보 처리방침"
          description="개인정보와 보관 기준 확인"
          onPress={() => void openExternal(appConfig.privacyPolicyUrl, "개인정보 처리방침 주소가 아직 준비되지 않았습니다.")}
        />
        <ListRow
          title="이용약관"
          description="SoulBound 이용약관"
          onPress={() => void openExternal(termsUrl(), "약관 주소가 설정되지 않았습니다.")}
        />
      </Card>

      <Card>
        <SectionTitle>차단한 멤버</SectionTitle>
        <Body muted>차단은 계정에 저장되며, 차단한 멤버의 글·댓글·멤버 목록 항목이 보이지 않습니다. 상대방은 차단 사실을 알 수 없습니다.</Body>
        <Message text={syncError} />
        {blocked.length === 0 ? <Body muted>차단한 멤버가 없습니다.</Body> : null}
        {blocked.map((memberNumber) => (
          <ListRow
            key={memberNumber}
            title={`soulbound-member-${memberNumber}`}
            trailing={<Button label="차단 해제" tone="quiet" onPress={() => void setBlocked(memberNumber, false)} />}
          />
        ))}
      </Card>

      <Card>
        <SectionTitle>계정 삭제</SectionTitle>
        <Body muted>계정과 내 데이터를 즉시 삭제합니다. 삭제 후에는 되돌릴 수 없습니다.</Body>
        <Message text={deletionError} />
        <Button
          label={deleting ? "삭제 중" : "계정 삭제"}
          tone="danger"
          onPress={confirmDeletion}
          disabled={deleting}
        />
      </Card>

      <Card>
        <ListRow
          title="앱 정보 / 버전"
          description={`SoulBound ${Constants.expoConfig?.version ?? ""}`}
          trailing={<Badge label="프리알파" />}
        />
        <Text style={styles.muted}>Persona Clip 녹화와 알림은 iPhone 앱에서 제공하지 않습니다.</Text>
      </Card>
    </>
  );
}
