import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';

export interface PulseIndicatorProps {
  color?: string;
  size?: number;
  style?: ViewStyle;
}

/**
 * PulseIndicator (adapted from 21st.dev status indicator)
 * Renders a ping-animated radar dot for live status, active shifts, and online states.
 */
export function PulseIndicator({ color = '#10B981', size = 8, style }: PulseIndicatorProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 2.5,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  const dotSize = size;
  const radius = dotSize / 2;

  return (
    <View style={[styles.container, { width: dotSize, height: dotSize }, style]}>
      {/* Animated ping wave */}
      <Animated.View
        style={[
          styles.ping,
          {
            backgroundColor: color,
            width: dotSize,
            height: dotSize,
            borderRadius: radius,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      {/* Solid center dot */}
      <View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            width: dotSize,
            height: dotSize,
            borderRadius: radius,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ping: {
    position: 'absolute',
  },
  dot: {
    position: 'relative',
  },
});

