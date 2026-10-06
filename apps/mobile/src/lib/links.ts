import { Alert, Linking } from "react-native";

export async function openExternal(url: string, unavailableMessage: string): Promise<void> {
  if (!url) {
    Alert.alert("안내", unavailableMessage);
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("안내", "링크를 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
