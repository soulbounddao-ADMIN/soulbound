import React from "react";
import { SettingsContent } from "../../src/screens/settings-content";
import { Screen } from "../../src/ui/components";

export default function MoreScreen() {
  return (
    <Screen edges={["left", "right"]}>
      <SettingsContent />
    </Screen>
  );
}
