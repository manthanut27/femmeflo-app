import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { StatusBar as RNStatusBar, Platform, Pressable, StyleSheet, View } from 'react-native';

export interface ImmersiveNavigationContextType {
  isNavVisible: boolean;
  isStatusBarVisible: boolean;
  showNavigation: () => void;
  hideNavigation: () => void;
  toggleNavigation: () => void;
  revealStatusBar: () => void;
  hideStatusBar: () => void;
  resetInactivityTimer: () => void;
}

const defaultContext: ImmersiveNavigationContextType = {
  isNavVisible: true,
  isStatusBarVisible: true,
  showNavigation: () => {},
  hideNavigation: () => {},
  toggleNavigation: () => {},
  revealStatusBar: () => {},
  hideStatusBar: () => {},
  resetInactivityTimer: () => {},
};

export const ImmersiveNavigationContext = createContext<ImmersiveNavigationContextType>(defaultContext);

export const useImmersiveNavigation = () => useContext(ImmersiveNavigationContext);

export const INITIAL_HIDE_DELAY_MS = 1500;
export const INACTIVITY_AUTO_HIDE_MS = 4000;
export const AUTO_HIDE_NAV_ENABLED = true;

export const ImmersiveNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isStatusBarVisible, setIsStatusBarVisible] = useState(true);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to safely set native status bar and Android system navigation bar with gaming-style immersive mode
  const updateNativeStatusBar = useCallback((hidden: boolean) => {
    try {
      if (Platform.OS !== 'web' && RNStatusBar && typeof RNStatusBar.setHidden === 'function') {
        RNStatusBar.setHidden(hidden, 'fade');
      }
      if (Platform.OS === 'android') {
        try {
          import('expo-navigation-bar').then((NavigationBar) => {
            if (hidden) {
              NavigationBar.setVisibilityAsync('hidden');
              NavigationBar.setBehaviorAsync('overlay-swipe');
            } else {
              NavigationBar.setVisibilityAsync('visible');
            }
          }).catch(() => {});
        } catch {
          // Graceful fallback when running in testing/mock environments
        }
      }
    } catch {
      // Ignore if not supported on platform
    }
  }, []);

  const hideNavigation = useCallback((hideAppTabBar = false) => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    if (!AUTO_HIDE_NAV_ENABLED) {
      return;
    }
    // Autohide only system navigation and notification bar, NOT the app bottom navbar
    if (hideAppTabBar) {
      setIsNavVisible(false);
    }
    setIsStatusBarVisible(false);
    updateNativeStatusBar(true);
  }, [updateNativeStatusBar]);

  const showNavigation = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    setIsNavVisible(true);
    setIsStatusBarVisible(true);
    updateNativeStatusBar(false);

    if (AUTO_HIDE_NAV_ENABLED) {
      // Auto-hide after inactivity (4 seconds) to restore the immersive full-screen view
      autoHideTimerRef.current = setTimeout(() => {
        hideNavigation();
      }, INACTIVITY_AUTO_HIDE_MS);
    }
  }, [hideNavigation, updateNativeStatusBar]);

  const toggleNavigation = useCallback(() => {
    if (!AUTO_HIDE_NAV_ENABLED) {
      return;
    }
    if (isNavVisible) {
      hideNavigation();
    } else {
      showNavigation();
    }
  }, [isNavVisible, hideNavigation, showNavigation]);

  const revealStatusBar = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    setIsStatusBarVisible(true);
    updateNativeStatusBar(false);

    if (AUTO_HIDE_NAV_ENABLED) {
      autoHideTimerRef.current = setTimeout(() => {
        hideNavigation();
      }, INACTIVITY_AUTO_HIDE_MS);
    }
  }, [hideNavigation, updateNativeStatusBar]);

  const hideStatusBar = useCallback(() => {
    if (!AUTO_HIDE_NAV_ENABLED) {
      return;
    }
    setIsStatusBarVisible(false);
    updateNativeStatusBar(true);
  }, [updateNativeStatusBar]);

  const resetInactivityTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    if (AUTO_HIDE_NAV_ENABLED && isNavVisible) {
      autoHideTimerRef.current = setTimeout(() => {
        hideNavigation();
      }, INACTIVITY_AUTO_HIDE_MS);
    }
  }, [isNavVisible, hideNavigation]);

  // Requirement:
  // When the app opens, notification bar and bottom nav bar are initially visible.
  // After exactly 1.5 seconds (1500ms), it hides with fade animation: StatusBar.setHidden(true, 'fade').
  useEffect(() => {
    updateNativeStatusBar(false);

    const initialTimer = setTimeout(() => {
      hideNavigation();
    }, INITIAL_HIDE_DELAY_MS);

    return () => {
      clearTimeout(initialTimer);
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [hideNavigation, updateNativeStatusBar]);

  return (
    <ImmersiveNavigationContext.Provider
      value={{
        isNavVisible,
        isStatusBarVisible,
        showNavigation,
        hideNavigation,
        toggleNavigation,
        revealStatusBar,
        hideStatusBar,
        resetInactivityTimer,
      }}
    >
      <View style={styles.providerContainer}>
        {children}
        <TopStatusBarTrigger />
      </View>
    </ImmersiveNavigationContext.Provider>
  );
};

export const TopStatusBarTrigger: React.FC = () => {
  const { isStatusBarVisible, revealStatusBar, showNavigation } = useImmersiveNavigation();

  // If status bar is already visible, unmount so headers, back buttons, and titles receive all touches freely
  if (isStatusBarVisible) {
    return null;
  }

  return (
    <Pressable
      onPress={() => {
        revealStatusBar();
        showNavigation();
      }}
      style={styles.topTriggerArea}
      accessibilityLabel="Access notification bar"
      accessibilityRole="button"
      hitSlop={{ top: 0, bottom: 8, left: 0, right: 0 }}
    />
  );
};

const styles = StyleSheet.create({
  providerContainer: {
    flex: 1,
  },
  topTriggerArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 28 : 24,
    zIndex: 99999,
    backgroundColor: 'transparent',
  },
});
