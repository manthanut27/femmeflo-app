export type DeviceType =
  | 'smallMobile'
  | 'mobile'
  | 'largeMobile'
  | 'smallTablet'
  | 'tablet'
  | 'largeTablet';

export const Breakpoints = {
  smallMobileMax: 359,
  mobileMin: 360,
  mobileMax: 430,
  largeMobileMin: 431,
  largeMobileMax: 599,
  smallTabletMin: 600,
  smallTabletMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  largeTabletMin: 1024,
} as const;

export const BASELINE_WIDTH = 390;

/**
 * Returns the device category based on screen width in logical pixels.
 */
export function getDeviceType(width: number): DeviceType {
  if (width < Breakpoints.mobileMin) {
    return 'smallMobile';
  }
  if (width <= Breakpoints.mobileMax) {
    return 'mobile';
  }
  if (width < Breakpoints.smallTabletMin) {
    return 'largeMobile';
  }
  if (width < Breakpoints.tabletMin) {
    return 'smallTablet';
  }
  if (width < Breakpoints.largeTabletMin) {
    return 'tablet';
  }
  return 'largeTablet';
}

/**
 * Calculates a proportional size relative to the baseline width with a dampening factor
 * to prevent oversized UI elements on tablets or overly tiny ones on small devices.
 */
export function getResponsiveSize(
  size: number,
  width: number,
  factor = 0.5
): number {
  const scale = width / BASELINE_WIDTH;
  const dampenedScale = 1 + (scale - 1) * factor;
  // Bound scaling between 0.85x and 1.35x for visual stability
  const boundedScale = Math.min(Math.max(dampenedScale, 0.85), 1.35);
  return Math.round(size * boundedScale);
}

/**
 * Calculates responsive font size, factoring in bounds to prevent clipped labels.
 */
export function getResponsiveFontSize(fontSize: number, width: number): number {
  if (width < Breakpoints.mobileMin) {
    // Graceful reduction for small screens (<360px) like iPhone SE1 or compact Androids
    return Math.max(Math.round(fontSize * 0.92), 10);
  }
  if (width >= Breakpoints.largeTabletMin) {
    return Math.round(fontSize * 1.15);
  }
  if (width >= Breakpoints.smallTabletMin) {
    return Math.round(fontSize * 1.08);
  }
  return fontSize;
}

/**
 * Calculates responsive spacing for margins, paddings, and gaps.
 */
export function getResponsiveSpacing(spacing: number, width: number): number {
  if (width < Breakpoints.mobileMin) {
    if (spacing <= 0) return spacing;
    return Math.max(Math.round(spacing * 0.85), 2);
  }
  if (width >= Breakpoints.smallTabletMin) {
    return Math.round(spacing * 1.25);
  }
  return spacing;
}

/**
 * Calculates optimal grid column counts for responsive dashboard and catalog layouts.
 */
export function getGridColumns(width: number): number {
  if (width >= Breakpoints.largeTabletMin) {
    return 4;
  }
  if (width >= Breakpoints.tabletMin) {
    return 3;
  }
  if (width >= Breakpoints.smallTabletMin) {
    return 2;
  }
  return 1;
}

/**
 * Calculates appropriate container max-width to keep readable line lengths and
 * balanced whitespace on tablets and landscape orientations.
 */
export function getMaxContainerWidth(width: number): number {
  if (width >= Breakpoints.largeTabletMin) {
    return 1080;
  }
  if (width >= Breakpoints.tabletMin) {
    return 860;
  }
  if (width >= Breakpoints.smallTabletMin) {
    return 680;
  }
  return width;
}

