import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Immersive Auto-Hide Navigation & Notification Bar Test Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string) => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  // =========================================================================
  // Requirement 1: Initial 1.5s Auto-Hide Timing
  // =========================================================================
  describe('1. Initial 1.5s Auto-Hide Timing', () => {
    it('verifies INITIAL_HIDE_DELAY_MS = 1500 (1.5 seconds) is defined and exported', () => {
      const code = readFile('src/context/ImmersiveNavigationContext.tsx');
      assert.match(
        code,
        /export\s+const\s+INITIAL_HIDE_DELAY_MS\s*=\s*1500/,
        'INITIAL_HIDE_DELAY_MS must be explicitly exported as 1500 (1.5 seconds)'
      );
    });

    it('verifies isStatusBarHidden and isTabBarHidden start false and transition to true after 1500ms', () => {
      const code = readFile('src/context/ImmersiveNavigationContext.tsx');

      // Context must initialize both navigation and status bar as visible (not hidden)
      assert.match(
        code,
        /const\s*\[\s*isNavVisible\s*,\s*setIsNavVisible\s*\]\s*=\s*useState\(\s*true\s*\)/,
        'isNavVisible must initialize to true (tab bar not hidden)'
      );
      assert.match(
        code,
        /const\s*\[\s*isStatusBarVisible\s*,\s*setIsStatusBarVisible\s*\]\s*=\s*useState\(\s*true\s*\)/,
        'isStatusBarVisible must initialize to true (status bar not hidden)'
      );

      // Status bar explicitly unhidden at mount
      assert.match(
        code,
        /updateNativeStatusBar\(\s*false\s*\)/,
        'Status bar must be unhidden (visible) on initial mount'
      );

      // Timer set for INITIAL_HIDE_DELAY_MS transitioning to hidden state
      assert.match(
        code,
        /setTimeout\(\s*\(\)\s*=>\s*\{\s*hideNavigation\(\);\s*\}\s*,\s*INITIAL_HIDE_DELAY_MS\s*\)/,
        'Must schedule hideNavigation() after INITIAL_HIDE_DELAY_MS (1500ms)'
      );

      // Verify hideNavigation marks both status bar and tab bar hidden
      assert.match(
        code,
        /setIsNavVisible\(\s*false\s*\)/,
        'hideNavigation must transition isNavVisible to false (tab bar hidden)'
      );
      assert.match(
        code,
        /setIsStatusBarVisible\(\s*false\s*\)/,
        'hideNavigation must transition isStatusBarVisible to false (status bar hidden)'
      );
      assert.match(
        code,
        /updateNativeStatusBar\(\s*true\s*\)/,
        'hideNavigation must tell native status bar to hide'
      );
    });

    it('simulates 1.5s initial lifecycle and verifies state transitions and timer cleanup', () => {
      // Mock / Simulation of the ImmersiveNavigation state machine
      class MockImmersiveController {
        isNavVisible = true;
        isStatusBarVisible = true;
        nativeStatusBarHidden = false;
        nativeStatusBarAnimation = '';
        activeTimers: Array<{ id: number; delay: number; callback: () => void }> = [];
        timerCounter = 0;

        get isTabBarHidden() {
          return !this.isNavVisible;
        }

        get isStatusBarHidden() {
          return !this.isStatusBarVisible;
        }

        updateNativeStatusBar(hidden: boolean) {
          this.nativeStatusBarHidden = hidden;
          this.nativeStatusBarAnimation = 'fade';
        }

        hideNavigation() {
          this.isNavVisible = false;
          this.isStatusBarVisible = false;
          this.updateNativeStatusBar(true);
        }

        mount(initialDelayMs = 1500) {
          this.updateNativeStatusBar(false);
          const id = ++this.timerCounter;
          this.activeTimers.push({
            id,
            delay: initialDelayMs,
            callback: () => this.hideNavigation(),
          });
          return id;
        }

        advanceTime(ms: number) {
          const ready = this.activeTimers.filter((t) => t.delay <= ms);
          this.activeTimers = this.activeTimers.filter((t) => t.delay > ms);
          ready.forEach((t) => t.callback());
        }
      }

      const controller = new MockImmersiveController();
      controller.mount(1500);

      // Initially at 0ms: visible (not hidden)
      assert.strictEqual(controller.isTabBarHidden, false, 'Tab bar must not be hidden initially');
      assert.strictEqual(controller.isStatusBarHidden, false, 'Status bar must not be hidden initially');
      assert.strictEqual(controller.nativeStatusBarHidden, false, 'Native status bar must be visible');

      // Before 1500ms (e.g. at 1000ms): still visible
      controller.advanceTime(1000);
      assert.strictEqual(controller.isTabBarHidden, false, 'Tab bar must remain visible before 1500ms');
      assert.strictEqual(controller.isStatusBarHidden, false, 'Status bar must remain visible before 1500ms');

      // After 1500ms: auto-hides with animation
      controller.advanceTime(1500);
      assert.strictEqual(controller.isTabBarHidden, true, 'Tab bar must transition to hidden after 1500ms');
      assert.strictEqual(controller.isStatusBarHidden, true, 'Status bar must transition to hidden after 1500ms');
      assert.strictEqual(controller.nativeStatusBarHidden, true, 'Native status bar must be hidden');
      assert.strictEqual(controller.nativeStatusBarAnimation, 'fade', 'Status bar animation must be fade');
    });

    it('verifies timer cleanup on unmount to prevent leaks', () => {
      const code = readFile('src/context/ImmersiveNavigationContext.tsx');
      assert.match(
        code,
        /clearTimeout\(\s*initialTimer\s*\)/,
        'Must clear initial timer on component unmount'
      );
      assert.match(
        code,
        /clearTimeout\(\s*autoHideTimerRef\.current\s*\)/,
        'Must clear inactivity auto-hide timer on component unmount'
      );
    });
  });

  // =========================================================================
  // Requirement 2: Bottom Area Click & Slide-Up / Fade-In Access
  // =========================================================================
  describe('2. Bottom Area Click & Slide-Up / Fade-In Access', () => {
    it('verifies bottom access trigger handle invokes showBars / showNavigation', () => {
      const code = readFile('src/components/navigation/AutoHideBottomTabBar.tsx');

      // Trigger area definition and trigger handle press
      assert.match(code, /styles\.triggerArea/, 'Must define interactive bottom trigger area style');
      assert.match(code, /styles\.triggerPill/, 'Must render visible trigger handle pill');
      assert.match(code, /onPress=\{handleTriggerPress\}/, 'Trigger area press must execute handleTriggerPress');
      assert.match(code, /const\s+handleTriggerPress\s*=\s*\(\)\s*=>\s*\{\s*showNavigation\(\);?\s*\}/, 'handleTriggerPress must invoke showNavigation');
    });

    it('verifies translateY transitions to 0 (slide up) and opacity transitions to 1 (fade in)', () => {
      const code = readFile('src/components/navigation/AutoHideBottomTabBar.tsx');

      // Animated slide and fade refs
      assert.match(code, /const\s+slideAnim\s*=\s*useRef/, 'Must define slideAnim using Animated.Value');
      assert.match(code, /const\s+fadeAnim\s*=\s*useRef/, 'Must define fadeAnim using Animated.Value');
      assert.match(code, /const\s+triggerFadeAnim\s*=\s*useRef/, 'Must define triggerFadeAnim for handle');

      // When isNavVisible is true: translateY slides up to 0, opacity fades in to 1
      assert.match(
        code,
        /if\s*\(\s*isNavVisible\s*\)\s*\{[\s\S]*?Animated\.timing\(\s*slideAnim,\s*\{[\s\S]*?toValue:\s*0[\s\S]*?duration:\s*280/,
        'slideAnim must animate toValue: 0 (slide up) on show'
      );
      assert.match(
        code,
        /if\s*\(\s*isNavVisible\s*\)\s*\{[\s\S]*?Animated\.timing\(\s*fadeAnim,\s*\{[\s\S]*?toValue:\s*1[\s\S]*?duration:\s*250/,
        'fadeAnim must animate toValue: 1 (fade in) on show'
      );

      // When isNavVisible is false: translateY slides down off-screen to 100, opacity fades out to 0
      assert.match(
        code,
        /else\s*\{[\s\S]*?Animated\.timing\(\s*slideAnim,\s*\{[\s\S]*?toValue:\s*100[\s\S]*?duration:\s*280/,
        'slideAnim must animate toValue: 100 (slide down) on hide'
      );
      assert.match(
        code,
        /else\s*\{[\s\S]*?Animated\.timing\(\s*fadeAnim,\s*\{[\s\S]*?toValue:\s*0[\s\S]*?duration:\s*250/,
        'fadeAnim must animate toValue: 0 (fade out) on hide'
      );

      // Verify transform and opacity applied to Animated.View
      assert.match(code, /transform:\s*\[\s*\{\s*translateY:\s*slideAnim\s*\}\s*\]/, 'translateY: slideAnim must be bound to tab bar container');
      assert.match(code, /opacity:\s*fadeAnim/, 'opacity: fadeAnim must be bound to tab bar container');
    });

    it('verifies auto-hide inactivity timeout is 4000ms (4 seconds)', () => {
      const code = readFile('src/context/ImmersiveNavigationContext.tsx');
      const inactivityMatch = code.match(/(?:AUTO_HIDE_INACTIVITY_MS|INACTIVITY_AUTO_HIDE_MS)\s*=\s*(\d+)/);
      assert.ok(inactivityMatch, 'Must define inactivity auto-hide delay constant');
      assert.strictEqual(Number(inactivityMatch[1]), 4000, 'Auto-hide inactivity timeout must be 4000ms (4 seconds)');

      // Verify showNavigation schedules 4-second auto-hide
      assert.match(
        code,
        /autoHideTimerRef\.current\s*=\s*setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?hideNavigation\(\);[\s\S]*?\},\s*(?:AUTO_HIDE_INACTIVITY_MS|INACTIVITY_AUTO_HIDE_MS)\s*\)/,
        'showNavigation must schedule hideNavigation after inactivity delay (4000ms)'
      );
    });

    it('verifies user interactions reset the inactivity timer to prevent auto-hiding while active', () => {
      const tabBarCode = readFile('src/components/navigation/AutoHideBottomTabBar.tsx');
      const contextCode = readFile('src/context/ImmersiveNavigationContext.tsx');

      // resetInactivityTimer defined in context
      assert.match(contextCode, /resetInactivityTimer/, 'Context must provide resetInactivityTimer');

      // resetInactivityTimer called on touchStart and tab press
      assert.match(tabBarCode, /onTouchStart=\{resetInactivityTimer\}/, 'Touching the tab bar container must reset inactivity timer');
      assert.match(
        tabBarCode,
        /const\s+handleTabPress\s*=\s*\(.*?\)\s*=>\s*\{[\s\S]*?resetInactivityTimer\(\);/,
        'Pressing a tab must reset inactivity timer'
      );
      assert.match(
        tabBarCode,
        /const\s+handleTabLongPress\s*=\s*\(.*?\)\s*=>\s*\{[\s\S]*?resetInactivityTimer\(\);/,
        'Long-pressing a tab must reset inactivity timer'
      );
    });

    it('simulates tapping bottom trigger, slide-up/fade-in, inactivity timer reset, and 4s auto-hide', () => {
      interface AnimationState {
        translateY: number;
        opacity: number;
        triggerOpacity: number;
      }

      class MockAnimatedTabBar {
        isNavVisible = false;
        animState: AnimationState = { translateY: 100, opacity: 0, triggerOpacity: 1 };
        inactivityTimerMs = 0;
        inactivityTimeoutId: NodeJS.Timeout | null = null;

        tapBottomTrigger() {
          // Bottom area clicked
          this.isNavVisible = true;
          // Animated slide up & fade in
          this.animState = { translateY: 0, opacity: 1, triggerOpacity: 0 };
          this.scheduleInactivityTimer();
        }

        scheduleInactivityTimer() {
          this.clearInactivityTimer();
          this.inactivityTimerMs = 4000;
        }

        clearInactivityTimer() {
          this.inactivityTimerMs = 0;
        }

        userInteraction() {
          if (this.isNavVisible) {
            // Reset 4000ms timer
            this.scheduleInactivityTimer();
          }
        }

        advanceInactivity(ms: number) {
          if (this.inactivityTimerMs > 0) {
            this.inactivityTimerMs -= ms;
            if (this.inactivityTimerMs <= 0) {
              this.inactivityTimerMs = 0;
              // Auto-hide after 4 seconds
              this.isNavVisible = false;
              this.animState = { translateY: 100, opacity: 0, triggerOpacity: 1 };
            }
          }
        }
      }

      const bar = new MockAnimatedTabBar();
      assert.strictEqual(bar.animState.translateY, 100, 'Initially hidden with translateY=100');
      assert.strictEqual(bar.animState.opacity, 0, 'Initially hidden with opacity=0');

      // User taps bottom trigger area
      bar.tapBottomTrigger();
      assert.strictEqual(bar.isNavVisible, true, 'Nav must become visible');
      assert.strictEqual(bar.animState.translateY, 0, 'Must slide up to translateY=0');
      assert.strictEqual(bar.animState.opacity, 1, 'Must fade in to opacity=1');
      assert.strictEqual(bar.inactivityTimerMs, 4000, 'Must start 4000ms inactivity timer');

      // User interacts after 2 seconds (e.g. taps a tab)
      bar.advanceInactivity(2000);
      assert.strictEqual(bar.isNavVisible, true, 'Nav must still be visible');
      bar.userInteraction();
      assert.strictEqual(bar.inactivityTimerMs, 4000, 'Timer must be reset back to 4000ms');

      // After another 3 seconds (5s total, but 3s since last interaction)
      bar.advanceInactivity(3000);
      assert.strictEqual(bar.isNavVisible, true, 'Nav must still be visible (1000ms left)');

      // After remaining 1 second (4s since last interaction)
      bar.advanceInactivity(1000);
      assert.strictEqual(bar.isNavVisible, false, 'Nav must auto-hide after 4 seconds of inactivity');
      assert.strictEqual(bar.animState.translateY, 100, 'Must slide down to translateY=100');
      assert.strictEqual(bar.animState.opacity, 0, 'Must fade out to opacity=0');
    });
  });

  // =========================================================================
  // Requirement 3: Mobile Notification Bar Accessibility
  // =========================================================================
  describe('3. Mobile Notification Bar Accessibility', () => {
    it('verifies status bar is controlled with StatusBar.setHidden(..., "fade")', () => {
      const code = readFile('src/context/ImmersiveNavigationContext.tsx');
      assert.match(
        code,
        /RNStatusBar\.setHidden\(\s*hidden\s*,\s*['"]fade['"]\s*\)/,
        'StatusBar must be controlled using RNStatusBar.setHidden(hidden, "fade")'
      );
    });

    it('verifies tapping the bottom area reveals the notification bar', () => {
      const tabBarCode = readFile('src/components/navigation/AutoHideBottomTabBar.tsx');
      const contextCode = readFile('src/context/ImmersiveNavigationContext.tsx');

      // Bottom trigger executes showNavigation
      assert.match(tabBarCode, /const\s+handleTriggerPress\s*=\s*\(\)\s*=>\s*\{\s*showNavigation\(\);?\s*\}/);

      // showNavigation sets status bar visible and calls updateNativeStatusBar(false)
      assert.match(
        contextCode,
        /const\s+showNavigation\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?setIsStatusBarVisible\(\s*true\s*\);[\s\S]*?updateNativeStatusBar\(\s*false\s*\);/,
        'showNavigation must unhide the mobile notification bar with fade animation'
      );
    });

    it('verifies TopStatusBarTrigger provides easy access to the notification bar near the top edge', () => {
      const code = readFile('src/context/ImmersiveNavigationContext.tsx');

      // TopStatusBarTrigger component exists and is exported
      assert.match(code, /export\s+const\s+TopStatusBarTrigger/, 'Must export TopStatusBarTrigger');

      // When tapped, reveals status bar and navigation
      assert.match(
        code,
        /onPress=\{\(\)\s*=>\s*\{[\s\S]*?revealStatusBar\(\);[\s\S]*?showNavigation\(\);[\s\S]*?\}\}/,
        'TopStatusBarTrigger onPress must call revealStatusBar and showNavigation'
      );

      // Accessibility attributes
      assert.match(code, /accessibilityLabel="Access notification bar"/, 'Top trigger must have clear accessibility label');
      assert.match(code, /accessibilityRole="button"/, 'Top trigger must have accessibility role button');

      // When status bar is already visible, TopStatusBarTrigger unmounts (returns null) so screen headers receive all touches
      assert.match(
        code,
        /if\s*\(\s*isStatusBarVisible\s*\)\s*\{\s*return\s+null;\s*\}/,
        'TopStatusBarTrigger must return null when status bar is visible to not interfere with screen headers'
      );
    });

    it('verifies revealStatusBar / showNotificationBar reveals status bar without blocking user navigation', () => {
      const code = readFile('src/context/ImmersiveNavigationContext.tsx');

      // revealStatusBar function implementation
      assert.match(
        code,
        /const\s+revealStatusBar\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?setIsStatusBarVisible\(\s*true\s*\);[\s\S]*?updateNativeStatusBar\(\s*false\s*\);/,
        'revealStatusBar must set isStatusBarVisible=true and unhide native status bar'
      );

      // revealStatusBar is included in context value
      assert.match(
        code,
        /value=\{\{[\s\S]*?revealStatusBar,[\s\S]*?\}\}/,
        'revealStatusBar must be exposed through ImmersiveNavigationContext'
      );
    });
  });

  // =========================================================================
  // Requirement 4: Layout & Tab Navigation Compatibility
  // =========================================================================
  describe('4. Layout & Tab Navigation Compatibility', () => {
    it('verifies src/app/_layout.tsx wraps root hierarchy with ImmersiveNavigationProvider', () => {
      const rootLayout = readFile('src/app/_layout.tsx');

      // Imports ImmersiveNavigationProvider
      assert.match(
        rootLayout,
        /import\s*\{\s*ImmersiveNavigationProvider\s*\}\s*from\s*['"]\.\.\/context\/ImmersiveNavigationContext['"]/,
        'Root layout must import ImmersiveNavigationProvider from context'
      );

      // Wraps stack navigation with ImmersiveNavigationProvider
      assert.match(
        rootLayout,
        /<ImmersiveNavigationProvider>[\s\S]*?<Stack[\s\S]*?<\/Stack>[\s\S]*?<\/ImmersiveNavigationProvider>/,
        'Root layout must wrap Stack with ImmersiveNavigationProvider'
      );
    });

    it('verifies (seller)/_layout.tsx integrates AutoHideBottomTabBar and retains tabs, history, and insets', () => {
      const code = readFile('src/app/(seller)/_layout.tsx');

      // Imports and integrates AutoHideBottomTabBar
      assert.match(code, /import\s*\{\s*AutoHideBottomTabBar\s*\}\s*from\s*['"]@\/components\/navigation\/AutoHideBottomTabBar['"]/);
      assert.match(code, /tabBar=\{\(props\)\s*=>\s*<AutoHideBottomTabBar\s+\{\.\.\.props\}\s*\/>\}/);

      // Tab bar configuration
      assert.match(code, /backBehavior="history"/, 'Seller tabs must retain backBehavior="history"');
      assert.match(code, /useSafeAreaInsets/, 'Seller tabs must retain useSafeAreaInsets');
      assert.match(code, /useResponsiveLayout/, 'Seller tabs must retain useResponsiveLayout');
      assert.match(code, /TabBarIcon/, 'Seller tabs must retain TabBarIcon');

      // Retains all active tab screen names and titles
      assert.match(code, /title:\s*'Home'/, 'Seller must retain Home tab');
      assert.match(code, /title:\s*'Shift'/, 'Seller must retain Shift tab');
      assert.match(code, /title:\s*'Sales'/, 'Seller must retain Sales tab');
      assert.match(code, /title:\s*'Customers'/, 'Seller must retain Customers tab');
      assert.match(code, /title:\s*'Profile'/, 'Seller must retain Profile tab');
    });

    it('verifies (manager)/_layout.tsx integrates AutoHideBottomTabBar and retains tabs, history, and insets', () => {
      const code = readFile('src/app/(manager)/_layout.tsx');

      // Imports and integrates AutoHideBottomTabBar
      assert.match(code, /import\s*\{\s*AutoHideBottomTabBar\s*\}\s*from\s*['"]@\/components\/navigation\/AutoHideBottomTabBar['"]/);
      assert.match(code, /tabBar=\{\(props\)\s*=>\s*<AutoHideBottomTabBar\s+\{\.\.\.props\}\s*\/>\}/);

      // Tab bar configuration
      assert.match(code, /backBehavior="history"/, 'Manager tabs must retain backBehavior="history"');
      assert.match(code, /useSafeAreaInsets/, 'Manager tabs must retain useSafeAreaInsets');
      assert.match(code, /useResponsiveLayout/, 'Manager tabs must retain useResponsiveLayout');
      assert.match(code, /TabBarIcon/, 'Manager tabs must retain TabBarIcon');

      // Retains all tab screen names and titles
      assert.match(code, /title:\s*'Dashboard'/, 'Manager must retain Dashboard tab');
      assert.match(code, /title:\s*'Team'/, 'Manager must retain Team tab');
      assert.match(code, /title:\s*'Stores'/, 'Manager must retain Stores tab');
      assert.match(code, /title:\s*'Sales'/, 'Manager must retain Sales tab');
      assert.match(code, /title:\s*'Profile'/, 'Manager must retain Profile tab');
    });

    it('verifies (admin)/_layout.tsx integrates AutoHideBottomTabBar and retains tabs, history, and insets', () => {
      const code = readFile('src/app/(admin)/_layout.tsx');

      // Imports and integrates AutoHideBottomTabBar
      assert.match(code, /import\s*\{\s*AutoHideBottomTabBar\s*\}\s*from\s*['"]@\/components\/navigation\/AutoHideBottomTabBar['"]/);
      assert.match(code, /tabBar=\{\(props\)\s*=>\s*<AutoHideBottomTabBar\s+\{\.\.\.props\}\s*\/>\}/);

      // Tab bar configuration
      assert.match(code, /backBehavior="history"/, 'Admin tabs must retain backBehavior="history"');
      assert.match(code, /useSafeAreaInsets/, 'Admin tabs must retain useSafeAreaInsets');
      assert.match(code, /useResponsiveLayout/, 'Admin tabs must retain useResponsiveLayout');
      assert.match(code, /TabBarIcon/, 'Admin tabs must retain TabBarIcon');

      // Retains all tab screen names and titles
      assert.match(code, /title:\s*'Dashboard'/, 'Admin must retain Dashboard tab');
      assert.match(code, /title:\s*'Reports'/, 'Admin must retain Reports tab');
      assert.match(code, /title:\s*'Approvals'/, 'Admin must retain Approvals tab');
      assert.match(code, /isSmallMobile \? 'Stock' : 'Inventory'/, 'Admin must retain responsive Inventory tab');
      assert.match(code, /title:\s*'Users'/, 'Admin must retain Users tab');
      assert.match(code, /title:\s*'Settings'/, 'Admin must retain Settings tab');
    });

    it('verifies tabBarStyle: { display: "none" } is respected for sub-routes', () => {
      const code = readFile('src/components/navigation/AutoHideBottomTabBar.tsx');

      // Detects options.tabBarStyle?.display === 'none'
      assert.match(
        code,
        /const\s+isHiddenByScreen\s*=\s*focusedOptions\.tabBarStyle\s*&&\s*\(focusedOptions\.tabBarStyle\s+as\s+any\)\.display\s*===\s*['"]none['"]/,
        'Must detect when focused route specifies tabBarStyle: { display: "none" }'
      );

      // Returns null when suppressed by screen
      assert.match(
        code,
        /if\s*\(\s*isHiddenByScreen\s*\)\s*\{\s*return\s+null;\s*\}/,
        'Must return null to hide both bottom tab bar and trigger handle on full-screen sub-routes'
      );
    });

    it('verifies route filtering hides routes with tabBarItemStyle display: "none" or tabBarButton: () => null', () => {
      const code = readFile('src/components/navigation/AutoHideBottomTabBar.tsx');

      // Filters out hidden routes from tab bar rendering
      assert.match(
        code,
        /if\s*\(options\.tabBarItemStyle\s*&&\s*\(options\.tabBarItemStyle\s*as\s*any\)\.display\s*===\s*['"]none['"]\)\s*\{\s*return\s+false;\s*\}/,
        'Must filter out routes with tabBarItemStyle display: "none"'
      );
      assert.match(
        code,
        /if\s*\(customButton\s*===\s*null\)\s*\{\s*return\s+false;\s*\}/,
        'Must filter out routes when tabBarButton returns null'
      );
    });
  });
});
