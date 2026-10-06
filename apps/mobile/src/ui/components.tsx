import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, radius, spacing } from "./theme";

export function Screen({
  children,
  edges = ["top", "bottom", "left", "right"],
  refreshing,
  onRefresh,
}: {
  readonly children: ReactNode;
  readonly edges?: readonly Edge[];
  readonly refreshing?: boolean;
  readonly onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        refreshControl={onRefresh
          ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.accent} />
          : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Heading({ title, description }: { readonly title: string; readonly description?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {description ? <Text style={styles.body}>{description}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { readonly children: string }) {
  return <Text style={styles.sectionTitle} accessibilityRole="header">{children}</Text>;
}

export function Card({ children }: { readonly children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Body({ children, muted }: { readonly children: ReactNode; readonly muted?: boolean }) {
  return <Text style={muted ? styles.muted : styles.body}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
  accessibilityHint,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: "primary" | "secondary" | "danger" | "quiet";
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" && { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        tone === "secondary" && styles.buttonSecondary,
        tone === "danger" && styles.buttonDanger,
        tone === "quiet" && styles.buttonQuiet,
        pressed && tone !== "primary" && { opacity: 0.7 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === "secondary" && { color: colors.text },
          tone === "danger" && { color: colors.danger },
          tone === "quiet" && { color: colors.accent },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...input
}: TextInputProps & { readonly label: string; readonly hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, input.multiline && styles.textarea]}
        {...input}
      />
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { readonly label: string; readonly tone?: "neutral" | "success" | "accent" }) {
  return (
    <View
      style={[
        styles.badge,
        tone === "success" && { backgroundColor: colors.successBg },
        tone === "accent" && { backgroundColor: colors.accent },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === "success" && { color: colors.success },
          tone === "accent" && { color: colors.accentText },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ title, children }: { readonly title?: string; readonly children?: ReactNode }) {
  return (
    <View style={styles.empty} accessibilityLiveRegion="polite">
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      {children ? <Text style={styles.muted}>{children}</Text> : null}
    </View>
  );
}

export function Loading({ label }: { readonly label: string }) {
  return (
    <View style={styles.empty} accessibilityLabel={label} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Message({ text, tone = "error" }: { readonly text: string; readonly tone?: "error" | "success" }) {
  if (!text) {
    return null;
  }
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.message, tone === "success" && styles.messageSuccess]}
    >
      {text}
    </Text>
  );
}

export function Row({ children }: { readonly children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function ListRow({
  title,
  description,
  onPress,
  trailing,
  accessibilityHint,
}: {
  readonly title: string;
  readonly description?: string;
  readonly onPress?: () => void;
  readonly trailing?: ReactNode;
  readonly accessibilityHint?: string;
}) {
  const content = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      {trailing}
    </>
  );
  if (!onPress) {
    return <View style={styles.listRow}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {content}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  heading: { gap: spacing.sm },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  muted: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.dangerBg },
  buttonQuiet: { backgroundColor: "transparent", minHeight: 44 },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: "600" },
  field: { gap: spacing.xs },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  textarea: { minHeight: 120, paddingTop: spacing.md, textAlignVertical: "top" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  message: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 14,
  },
  messageSuccess: { color: colors.success, backgroundColor: colors.successBg },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  listTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
});
