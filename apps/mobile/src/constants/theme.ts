/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Seviye 360 marka renkleri — web uygulamasıyla aynı (#0071ce / #e30613).
export const Colors = {
  light: {
    text: '#10151F',
    background: '#F7F8FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6F0FB',
    textSecondary: '#5A6472',
    border: '#E2E5EA',
    brand: '#0071CE',
    brandStrong: '#00558F',
    critical: '#E30613',
    success: '#1A9E5C',
    warning: '#B7791F',
  },
  dark: {
    text: '#F2F4F7',
    background: '#0B0E14',
    backgroundElement: '#161B24',
    backgroundSelected: '#1E2A3C',
    textSecondary: '#96A0AD',
    border: '#232A36',
    brand: '#3B9AE1',
    brandStrong: '#0071CE',
    critical: '#FF6B75',
    success: '#3ECF8E',
    warning: '#E0B04A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
