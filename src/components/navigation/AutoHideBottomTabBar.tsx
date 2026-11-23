import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useImmersiveNavigation } from '@/context/ImmersiveNavigationContext';

export interface AutoHideBottomTabBarProps {
  state: {
    routes: Array<{
      key: string;
      name: string;
      params?: Record<string, any>;
    }>;
    index: number;
    [key: string]: any;
  };
  descriptors: Record<string, any>;
  navigation?: any;
  emitter?: any;
  navigateToTab?: (routeKey: string) => void;
  insets?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  [key: string]: any;
}

export const AutoHideBottomTabBar: React.FC<AutoHideBottomTabBarProps> = (props) => {
  const { state, descriptors, navigation, emitter, navigateToTab } = props;
  const insets = useSafeAreaInsets();
  const { isNavVisible, showNavigation, resetInactivityTimer } = useImmersiveNavigation();

  // Support options.tabBarStyle?.display === 'none' for nested detail/edit screens
  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = descriptors[focusedRoute?.key];
  const focusedOptions = focusedDescriptor?.options || {};

  const getNestedActiveRouteName = (route: any): string | undefined => {
    if (!route) return undefined;
    if (route.state?.routes && typeof route.state.index === 'number') {
      const child = route.state.routes[route.state.index];
      return getNestedActiveRouteName(child) || child?.name;
    }
    return route.name;
  };

  const activeNestedName = getNestedActiveRouteName(focusedRoute);
  const routeState = (focusedRoute as any)?.state;
  const isNestedSubScreen = Boolean(
    (routeState && typeof routeState.index === 'number' && routeState.index > 0) ||
    (activeNestedName && activeNestedName !== 'index' && activeNestedName !== focusedRoute?.name)
  );

  const isHiddenByScreen =
    focusedOptions.tabBarStyle &&
    (focusedOptions.tabBarStyle as any).display === 'none';

  // Animation values:
  // Visible: translateY = 0, opacity = 1, triggerOpacity = 0
  // Hidden: translateY = 100, opacity = 0, triggerOpacity = 1
  const slideAnim = useRef(new Animated.Value(isNavVisible ? 0 : 100)).current;
  const fadeAnim = useRef(new Animated.Value(isNavVisible ? 1 : 0)).current;
  const triggerFadeAnim = useRef(new Animated.Value(isNavVisible ? 0 : 1)).current;

  useEffect(() => {
    if (isNavVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(triggerFadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(triggerFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [isNavVisible, slideAnim, fadeAnim, triggerFadeAnim]);

  if (isHiddenByScreen) {
    return null;
  }

  if (isNestedSubScreen) {
    return null;
  }

  // Filter routes that are hidden by tabBarItemStyle or tabBarButton: () => null
  const visibleRoutes = state.routes.filter((route) => {
    const descriptor = descriptors[route.key];
    if (!descriptor) return false;
    const options = descriptor.options;
    if (options.tabBarItemStyle && (options.tabBarItemStyle as any).display === 'none') {
      return false;
    }
    if (typeof options.tabBarButton === 'function') {
      try {
        const customButton = options.tabBarButton({ children: null } as any);
        if (customButton === null) {
          return false;
        }
      } catch {
        // Safe fallback
      }
    }
    return true;
  });

  const handleTabPress = (route: any, routeIndex: number) => {
    resetInactivityTimer();

    const isFocused = state.index === routeIndex;
    let defaultPrevented = false;

    if (navigation?.emit) {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      defaultPrevented = event?.defaultPrevented ?? false;
    } else if (emitter?.emit) {
      const event = emitter.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      defaultPrevented = event?.defaultPrevented ?? false;
    }

    if (!isFocused && !defaultPrevented) {
      if (typeof navigateToTab === 'function') {
        navigateToTab(route.key);
      } else if (navigation?.navigate) {
        navigation.navigate(route.name, route.params);
      }
    }
  };

  const handleTabLongPress = (route: any) => {
    resetInactivityTimer();

    if (navigation?.emit) {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    } else if (emitter?.emit) {
      emitter.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    }
  };

  const handleTriggerPress = () => {
    showNavigation();
  };

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);

  return (
    <>
      {/* Interactive Bottom Area Trigger Handle (Present when Bottom Navbar is Hidden) */}
      <Animated.View
        style={[
          styles.triggerArea,
          {
            opacity: triggerFadeAnim,
            paddingBottom: Math.max(insets.bottom, 4),
          },
        ]}
        pointerEvents={isNavVisible ? 'none' : 'auto'}
      >
        <Pressable
          onPress={handleTriggerPress}
          style={styles.triggerTouchable}
          accessibilityLabel="Access bottom navigation"
          accessibilityRole="button"
          hitSlop={{ top: 16, bottom: 12, left: 24, right: 24 }}
        >
          <View style={styles.triggerPill} />
        </Pressable>
      </Animated.View>

      {/* Slide-Up & Fade-In Animated Bottom Navigation Bar */}
      <Animated.View
        style={[
          styles.tabBarContainer,
          {
            paddingBottom: bottomPadding,
          },
          focusedOptions.tabBarStyle,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
        pointerEvents={isNavVisible ? 'auto' : 'none'}
        onTouchStart={resetInactivityTimer}
      >
        {visibleRoutes.map((route) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const isFocused = state.index === routeIndex;

          const activeColor =
            options.tabBarActiveTintColor ||
            focusedOptions.tabBarActiveTintColor ||
            '#E91E63';
          const inactiveColor =
            options.tabBarInactiveTintColor ||
            focusedOptions.tabBarInactiveTintColor ||
            '#687076';
          const color = isFocused ? activeColor : inactiveColor;

          const label =
            options.tabBarLabel !== undefined
              ? typeof options.tabBarLabel === 'function'
                ? options.tabBarLabel({
                    focused: isFocused,
                    color,
                    position: 'below-icon',
                    children: options.title || route.name,
                  })
                : options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const icon = options.tabBarIcon
            ? options.tabBarIcon({
                focused: isFocused,
                color,
                size: (options.tabBarIcon as any).size || 22,
              })
            : null;

          if (typeof options.tabBarButton === 'function') {
            const customBtn = options.tabBarButton({
              onPress: () => handleTabPress(route, routeIndex),
              onLongPress: () => handleTabLongPress(route),
              children: (
                <View style={styles.tabItem}>
                  <View style={styles.iconContainer}>{icon}</View>
                  {typeof label === 'string' ? (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.tabLabel,
                        focusedOptions.tabBarLabelStyle,
                        options.tabBarLabelStyle,
                        { color },
                      ]}
                    >
                      {label}
                    </Text>
                  ) : (
                    label
                  )}
                </View>
              ),
            });
            if (customBtn !== null) {
              return <React.Fragment key={route.key}>{customBtn}</React.Fragment>;
            }
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ||
                (typeof label === 'string' ? label : undefined)
              }
              testID={options.tabBarTestID}
              onPress={() => handleTabPress(route, routeIndex)}
              onLongPress={() => handleTabLongPress(route)}
              style={[styles.tabItem, options.tabBarItemStyle]}
            >
              <View style={styles.iconContainer}>{icon}</View>
              {typeof label === 'string' ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    focusedOptions.tabBarLabelStyle,
                    options.tabBarLabelStyle,
                    { color },
                  ]}
                >
                  {label}
                </Text>
              ) : (
                label
              )}
            </Pressable>
          );
        })}
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 1000,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  triggerArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backgroundColor: 'transparent',
  },
  triggerTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerPill: {
    width: 48,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(50, 50, 50, 0.32)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
