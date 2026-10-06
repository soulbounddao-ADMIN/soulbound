import { Tabs } from "expo-router";
import React from "react";
import { Text, type ColorValue } from "react-native";
import { colors } from "../../src/ui/theme";

function TabGlyph({ glyph, color }: { readonly glyph: string; readonly color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }} accessible={false}>{glyph}</Text>;
}

export default function MemberTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "멤버", tabBarIcon: ({ color }) => <TabGlyph glyph="◎" color={color} /> }}
      />
      <Tabs.Screen
        name="votes"
        options={{ title: "투표", tabBarIcon: ({ color }) => <TabGlyph glyph="☑" color={color} /> }}
      />
      <Tabs.Screen
        name="board"
        options={{ title: "게시판", tabBarIcon: ({ color }) => <TabGlyph glyph="✎" color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "더보기", tabBarIcon: ({ color }) => <TabGlyph glyph="⋯" color={color} /> }}
      />
    </Tabs>
  );
}
