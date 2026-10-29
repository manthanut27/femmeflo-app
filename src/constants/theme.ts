import { Platform } from 'react-native';

export const BrandColors = {
  // Brand Pink / Rose (Healthcare FMCG & Hygiene)
  pink: {
    primary: '#E61C5D',
    pressed: '#C01048',
    dark: '#9F2545',
    deep: '#881337',
    vibrant: '#F0006E',
    surface: '#FFF8FA',
    subtle: '#FFF5F7',
    tint: '#FCE7F3',
  },
  // Brand Green / Forest (Supply Chain & Positive Balance)
  green: {
    primary: '#156035',
    pressed: '#0D4224',
    dark: '#0F4626',
    surface: '#EBF6EF',
    light: '#D1FAE5',
    subtle: '#EBF6EF',
    tint: '#D1FAE5',
  },
  // Accents
  accent: {
    gold: '#FDE047',
    amber: '#D97706',
    amberSurface: '#FFFBEB',
    amberBorder: '#FDE68A',
  },
} as const;

export const Colors = {
  light: {
    text: '#0F172A',
    textPrimary: '#0F172A',
    heading: '#09090B',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textTertiary: '#94A3B8',
    textPlaceholder: '#A1A1AA',
    background: '#FAF8F5',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#FCE7F3',
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    primary: BrandColors.pink.primary,
    primaryPressed: BrandColors.pink.pressed,
    secondary: BrandColors.green.primary,
    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    warningText: '#92400E',
    danger: '#B4234D',
    dangerBg: '#FFF1F2',
    dangerBorder: '#FECDD3',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
    infoText: '#0369A1',
  },
  dark: {
    text: '#F8FAFC',
    textPrimary: '#F8FAFC',
    heading: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textTertiary: '#64748B',
    textPlaceholder: '#71717A',
    background: '#0F172A',
    surface: '#1E293B',
    card: '#1E293B',
    surfaceMuted: '#334155',
    backgroundElement: '#334155',
    backgroundSelected: '#475569',
    border: '#334155',
    borderSubtle: '#1E293B',
    primary: '#F43F5E',
    primaryPressed: '#E11D48',
    secondary: '#10B981',
    success: '#10B981',
    successBg: '#064E3B',
    successBorder: '#047857',
    warning: '#F59E0B',
    warningBg: '#78350F',
    warningBorder: '#B45309',
    warningText: '#FDE68A',
    danger: '#F43F5E',
    dangerBg: '#881337',
    dangerBorder: '#BE123C',
    info: '#38BDF8',
    infoBg: '#0C4A6E',
    infoBorder: '#0369A1',
    infoText: '#BAE6FD',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Typography = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
} as const;

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Alias for design system compatibility
export const BorderRadius = Radius;

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// Alias for elevation design token compatibility
export const Elevation = {
  none: Shadows.none,
  low: Shadows.sm,
  medium: Shadows.md,
  high: Shadows.lg,
} as const;

export const HitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
  lg: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 80;
export const MaxContentWidth = 800;

export const RoleThemes = {
  seller: {
    primary: BrandColors.pink.primary,
    pressed: BrandColors.pink.pressed,
    surface: BrandColors.pink.subtle,
    tint: BrandColors.pink.tint,
    title: 'Field Sales Officer',
  },
  manager: {
    primary: BrandColors.green.primary,
    pressed: BrandColors.green.pressed,
    surface: BrandColors.green.surface,
    tint: BrandColors.green.light,
    title: 'Territory Operations Manager',
  },
  admin: {
    primary: BrandColors.pink.dark,
    pressed: BrandColors.pink.deep,
    surface: BrandColors.pink.surface,
    tint: BrandColors.pink.tint,
    title: 'Executive Super Admin',
  },
} as const;
