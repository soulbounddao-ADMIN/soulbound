import React from "react";
import { SettingsContent } from "../src/screens/settings-content";
import { Screen } from "../src/ui/components";

export default function SettingsScreen() {
  return (
    <Screen edges={["bottom", "left", "right"]}>
      <SettingsContent />
    </Screen>
  );
}
