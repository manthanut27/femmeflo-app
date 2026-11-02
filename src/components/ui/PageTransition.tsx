import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native';

export interface PageTransitionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  slideDistance?: number;
}

/**
 * PageTransition
 * Smoothly cascades opacity and subtle vertical translation on screen/tab entrance.
 */
export function PageTransition({
  children,
  style,
  duration = 260,
  slideDistance = 8,
}: PageTransitionProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, duration, slideDistance]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

