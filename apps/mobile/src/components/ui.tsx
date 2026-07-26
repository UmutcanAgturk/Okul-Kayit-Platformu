import { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({ children, style }: PropsWithChildren<ViewProps>) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.background, padding: Spacing.three }, style]}>
      {children}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<ViewProps>) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Title({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

export function Subtitle({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.label, { color: theme.text }]}>{children}</Text>;
}

export function MutedText({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const bg =
    variant === 'primary' ? theme.brand : variant === 'danger' ? theme.critical : theme.backgroundElement;
  const fg = variant === 'secondary' ? theme.text : '#FFFFFF';
  const borderColor = variant === 'secondary' ? theme.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <MutedText>{label}</MutedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
        ]}
        {...props}
      />
    </View>
  );
}

type ChipTone = 'neutral' | 'success' | 'warning' | 'critical' | 'brand';

export function Chip({
  label,
  tone = 'neutral',
  onPress,
  selected = false,
}: {
  label: string;
  tone?: ChipTone;
  onPress?: () => void;
  selected?: boolean;
}) {
  const theme = useTheme();
  const color =
    tone === 'success'
      ? theme.success
      : tone === 'warning'
        ? theme.warning
        : tone === 'critical'
          ? theme.critical
          : tone === 'brand'
            ? theme.brand
            : theme.textSecondary;
  const content = (
    <View
      style={[
        styles.chip,
        { backgroundColor: selected ? color : `${color}1F`, borderColor: `${color}55` },
      ]}>
      <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : color }]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function ErrorBanner({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: `${theme.critical}1A`, borderColor: `${theme.critical}55` }]}>
      <Text style={{ color: theme.critical, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={{ padding: Spacing.four, alignItems: 'center' }}>
      <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

export function CenterLoading() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
      <ActivityIndicator color={theme.brand} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 14, marginTop: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  button: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  banner: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
});
