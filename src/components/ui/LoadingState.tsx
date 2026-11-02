import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { BrandColors, Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { PulseIndicator } from './PulseIndicator';

export interface LoadingStateProps {
  message?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/**
 * LoadingState
 * Smooth animated loading state with glowing pulse ring and breathing text.
 */
export function LoadingState({
  message = 'Loading data...',
  color = BrandColors.pink.primary,
  style,
  compact = false,
}: LoadingStateProps) {
  const textFade = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(textFade, {
          toValue: 0.95,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(textFade, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [textFade]);

  return (
    <View style={[styles.container, compact && styles.compactContainer, style]}>
      <View style={styles.spinnerWrapper}>
        <PulseIndicator color={color} size={36} style={styles.pulseRing} />
        <View style={styles.spinnerCenter}>
          <ActivityIndicator size={compact ? 'small' : 'large'} color={color} />
        </View>
      </View>

      {message ? (
        <Animated.Text style={[styles.message, { opacity: textFade }]}>
          {message}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.light.background,
  },
  compactContainer: {
    flex: 0,
    padding: Spacing.md,
    backgroundColor: 'transparent',
  },
  spinnerWrapper: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  pulseRing: {
    position: 'absolute',
  },
  spinnerCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});

