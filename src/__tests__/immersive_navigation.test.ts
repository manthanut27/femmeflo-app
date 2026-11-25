import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Immersive Navigation & Auto-Hide Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string) => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  it('verifies ImmersiveNavigationContext constants and status bar fade hiding', () => {
    const contextCode = readFile('src/context/ImmersiveNavigationContext.tsx');
    assert.match(contextCode, /INITIAL_HIDE_DELAY_MS\s*=\s*1500/, 'Initial auto-hide delay must be 1500ms (1.5s)');
    assert.match(contextCode, /INACTIVITY_AUTO_HIDE_MS\s*=\s*4000/, 'Inactivity auto-hide delay must be 4000ms (4s)');
    assert.match(contextCode, /RNStatusBar\.setHidden\(hidden,\s*['"]fade['"]\)/, 'Status bar hide/show must use fade animation');
    assert.match(contextCode, /export const ImmersiveNavigationProvider/, 'Must export ImmersiveNavigationProvider');
    assert.match(contextCode, /export const useImmersiveNavigation/, 'Must export useImmersiveNavigation hook');
    assert.match(contextCode, /export const TopStatusBarTrigger/, 'Must export TopStatusBarTrigger for easy status bar access near top edge');
  });

  it('verifies AutoHideBottomTabBar implementation and animations', () => {
    const code = readFile('src/components/navigation/AutoHideBottomTabBar.tsx');

    // Slide-up and fade-in animation checks
    assert.match(code, /translateY:\s*slideAnim/, 'Must animate translateY for slide transitions');
    assert.match(code, /opacity:\s*fadeAnim/, 'Must animate opacity for fade-in/fade-out transitions');
    assert.match(code, /toValue:\s*100/, 'Must translate down off-screen (toValue: 100) on hide');
    assert.match(code, /toValue:\s*0/, 'Must translate up on-screen (toValue: 0) on show');

    // Trigger handle area
    assert.match(code, /triggerArea/, 'Must define interactive bottom trigger area');
    assert.match(code, /triggerPill/, 'Must define visual handle pill indicator');
    assert.match(code, /handleTriggerPress/, 'Must handle trigger press to show navigation');

    // Nested detail/edit screens suppression
    assert.match(code, /display\s*===\s*['"]none['"]/, 'Must check for tabBarStyle display: "none"');
    assert.match(code, /return null;/, 'Must return null when hidden by screen options');

    // Tab interaction
    assert.match(code, /type:\s*['"]tabPress['"]/, 'Must emit tabPress navigation events');
    assert.match(code, /resetInactivityTimer\(\)/, 'Must reset inactivity timer on tab interaction');
  });

  it('verifies RootLayout integrates ImmersiveNavigationProvider', () => {
    const rootLayout = readFile('src/app/_layout.tsx');
    assert.match(rootLayout, /import\s*\{\s*ImmersiveNavigationProvider\s*\}\s*from\s*['"]\.\.\/context\/ImmersiveNavigationContext['"]/, 'RootLayout must import ImmersiveNavigationProvider');
    assert.match(rootLayout, /<ImmersiveNavigationProvider>/, 'RootLayout must wrap tree with ImmersiveNavigationProvider');
  });

  it('verifies (seller)/_layout.tsx configures AutoHideBottomTabBar while keeping all tabs & options', () => {
    const sellerCode = readFile('src/app/(seller)/_layout.tsx');
    assert.match(sellerCode, /AutoHideBottomTabBar/, 'Seller layout must import AutoHideBottomTabBar');
    assert.match(sellerCode, /tabBar=\{\(props\)\s*=>\s*<AutoHideBottomTabBar\s+\{\.\.\.props\}\s*\/>\}/, 'Seller layout must pass AutoHideBottomTabBar to tabBar prop');
    assert.match(sellerCode, /title:\s*'Home'/, 'Seller must retain Home tab');
    assert.match(sellerCode, /title:\s*'Attendance'/, 'Seller must retain Attendance tab');
    assert.match(sellerCode, /title:\s*'Sales'/, 'Seller must retain Sales tab');
    assert.match(sellerCode, /title:\s*'Customers'/, 'Seller must retain Customers tab');
    assert.match(sellerCode, /title:\s*'Profile'/, 'Seller must retain Profile tab');
    assert.match(sellerCode, /backBehavior="history"/, 'Seller must retain history back behavior');
    assert.match(sellerCode, /useSafeAreaInsets/, 'Seller must retain safe area insets');
    assert.match(sellerCode, /useResponsiveLayout/, 'Seller must retain responsive layout hook');
    assert.match(sellerCode, /TabBarIcon/, 'Seller must retain TabBarIcon');
  });

  it('verifies (manager)/_layout.tsx configures AutoHideBottomTabBar while keeping all tabs & options', () => {
    const managerCode = readFile('src/app/(manager)/_layout.tsx');
    assert.match(managerCode, /AutoHideBottomTabBar/, 'Manager layout must import AutoHideBottomTabBar');
    assert.match(managerCode, /tabBar=\{\(props\)\s*=>\s*<AutoHideBottomTabBar\s+\{\.\.\.props\}\s*\/>\}/, 'Manager layout must pass AutoHideBottomTabBar to tabBar prop');
    assert.match(managerCode, /title:\s*'Dashboard'/, 'Manager must retain Dashboard tab');
    assert.match(managerCode, /title:\s*'Team'/, 'Manager must retain Team tab');
    assert.match(managerCode, /title:\s*'Stores'/, 'Manager must retain Stores tab');
    assert.match(managerCode, /title:\s*'Sales'/, 'Manager must retain Sales tab');
    assert.match(managerCode, /title:\s*'Profile'/, 'Manager must retain Profile tab');
    assert.match(managerCode, /backBehavior="history"/, 'Manager must retain history back behavior');
    assert.match(managerCode, /useSafeAreaInsets/, 'Manager must retain safe area insets');
    assert.match(managerCode, /useResponsiveLayout/, 'Manager must retain responsive layout hook');
    assert.match(managerCode, /TabBarIcon/, 'Manager must retain TabBarIcon');
  });

  it('verifies (admin)/_layout.tsx configures AutoHideBottomTabBar while keeping all tabs & options', () => {
    const adminCode = readFile('src/app/(admin)/_layout.tsx');
    assert.match(adminCode, /AutoHideBottomTabBar/, 'Admin layout must import AutoHideBottomTabBar');
    assert.match(adminCode, /tabBar=\{\(props\)\s*=>\s*<AutoHideBottomTabBar\s+\{\.\.\.props\}\s*\/>\}/, 'Admin layout must pass AutoHideBottomTabBar to tabBar prop');
    assert.match(adminCode, /title:\s*'Dashboard'/, 'Admin must retain Dashboard tab');
    assert.match(adminCode, /title:\s*'Reports'/, 'Admin must retain Reports tab');
    assert.match(adminCode, /title:\s*'Approvals'/, 'Admin must retain Approvals tab');
    assert.match(adminCode, /title:\s*'Users'/, 'Admin must retain Users tab');
    assert.match(adminCode, /title:\s*'Settings'/, 'Admin must retain Settings tab');
    assert.match(adminCode, /backBehavior="history"/, 'Admin must retain history back behavior');
    assert.match(adminCode, /useSafeAreaInsets/, 'Admin must retain safe area insets');
    assert.match(adminCode, /useResponsiveLayout/, 'Admin layout must use responsive layout hook');
    assert.match(adminCode, /TabBarIcon/, 'Admin layout must use polished TabBarIcon');
  });
});
