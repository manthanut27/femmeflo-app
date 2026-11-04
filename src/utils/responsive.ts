import { useWindowDimensions } from 'react-native';
import {
  Breakpoints,
  DeviceType,
  getDeviceType,
  getGridColumns,
  getMaxContainerWidth,
  getResponsiveFontSize,
  getResponsiveSize,
  getResponsiveSpacing,
} from './responsiveCore';

export * from './responsiveCore';

export interface ResponsiveLayout {
  width: number;
  height: number;
  deviceType: DeviceType;
  isSmallMobile: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  columns: number;
  maxContentWidth: number;
  scaleSize: (size: number, factor?: number) => number;
  scaleFontSize: (size: number) => number;
  scaleSpacing: (spacing: number) => number;
}

/**
 * Active hook providing real-time responsive dimensions, orientation, and scaling helpers.
 * Automatically updates on screen resize or device orientation changes.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const isLandscape = width > height;
  const isTablet = width >= Breakpoints.smallTabletMin;

  return {
    width,
    height,
    deviceType,
    isSmallMobile: deviceType === 'smallMobile',
    isMobile: !isTablet,
    isTablet,
    isLargeTablet: deviceType === 'largeTablet',
    isLandscape,
    isPortrait: !isLandscape,
    columns: getGridColumns(width),
    maxContentWidth: getMaxContainerWidth(width),
    scaleSize: (size: number, factor?: number) => getResponsiveSize(size, width, factor),
    scaleFontSize: (size: number) => getResponsiveFontSize(size, width),
    scaleSpacing: (spacing: number) => getResponsiveSpacing(spacing, width),
  };
}
