import { useRouter } from "expo-router";
import React from "react";
import { appConfig } from "../src/config";
import { openExternal } from "../src/lib/links";
import { Body, Button, Card, Heading, Screen } from "../src/ui/components";

export default function ReviewerScreen() {
  const router = useRouter();
  const adminUrl = appConfig.apiBaseUrl ? `${appConfig.apiBaseUrl}/admin/applications` : "";
  return (
    <Screen edges={["bottom", "left", "right"]}>
      <Heading
        title="검토자·관리자 계정"
        description="입장 신청 검토와 관리 기능은 iPhone 앱에서 아직 제공하지 않습니다. 웹에서 이용해 주세요."
      />
      <Card>
        <Body>신청 검토, 승인·거부, 투표 열기·종료와 게시판 관리는 웹 관리 화면에서 할 수 있습니다.</Body>
        <Button
          label="웹 관리 화면 열기"
          onPress={() => void openExternal(adminUrl, "웹 주소가 설정되지 않았습니다.")}
        />
      </Card>
      <Button label="설정" tone="secondary" onPress={() => router.push("/settings")} />
    </Screen>
  );
}
