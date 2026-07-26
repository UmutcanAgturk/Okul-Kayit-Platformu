import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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

// Kartların ekrana sabit değil, hafif bir "belirme" hareketiyle girmesi —
// dashboard'ları statik bir tablo yerine canlı bir arayüz gibi hissettirir.
// Tek bir yerde (Card) uygulanır, ekstra paket gerekmez (React Native'in
// yerleşik Animated API'si), ve her ekrana otomatik yayılır.
function useEntrance() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [progress]);
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
}

export function Card({ children, style }: PropsWithChildren<ViewProps>) {
  const theme = useTheme();
  const entrance = useEntrance();
  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          shadowColor: '#000',
        },
        entrance,
        style,
      ]}>
      {children}
    </Animated.View>
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
  const scale = useRef(new Animated.Value(1)).current;
  const bg =
    variant === 'primary' ? theme.brand : variant === 'danger' ? theme.critical : theme.backgroundElement;
  const fg = variant === 'secondary' ? theme.text : '#FFFFFF';
  const borderColor = variant === 'secondary' ? theme.border : 'transparent';

  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled || loading}
        style={[
          styles.button,
          {
            backgroundColor: bg,
            borderColor,
            opacity: disabled ? 0.5 : 1,
            shadowColor: variant === 'primary' ? theme.brand : 'transparent',
          },
        ]}>
        {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
      </Pressable>
    </Animated.View>
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
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      {({ pressed }) => <View style={{ opacity: pressed ? 0.7 : 1 }}>{content}</View>}
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: `${theme.critical}1A`, borderColor: `${theme.critical}55` }]}>
      <Ionicons name="alert-circle" size={16} color={theme.critical} />
      <Text style={{ color: theme.critical, fontSize: 13, flex: 1 }}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message, icon = 'file-tray-outline' }: { message: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  return (
    <View style={{ padding: Spacing.four, alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.backgroundSelected,
        }}>
        <Ionicons name={icon} size={24} color={theme.brand} />
      </View>
      <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 13.5 }}>{message}</Text>
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

// Dashboard özet ekranlarındaki (Şube/Superadmin "Bugün") Label+MutedText
// yığınlarının yerini alır — bir bakışta okunan, ikon + renk kodlu, büyük
// rakamlı bir "KPI kartı". Sayılar font-variant tabular-nums ile hizalanır.
type StatTone = 'brand' | 'success' | 'warning' | 'critical';

export function StatTile({
  icon,
  label,
  value,
  tone = 'brand',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: StatTone;
}) {
  const theme = useTheme();
  const color =
    tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : tone === 'critical' ? theme.critical : theme.brand;
  return (
    <Card style={{ flex: 1, minWidth: 140, gap: 10 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}1A`,
        }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
      <Text
        style={{
          color: theme.text,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.3,
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
