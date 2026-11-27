import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileNavigationDrawer } from '@/components/common/MobileNavigationDrawer';
import { Header } from '@/components/ui/Header';
import { PageTransition } from '@/components/ui/PageTransition';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function AdminHomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Header
        title="Home"
        showMenu
        onMenuPress={() => setMenuOpen(true)}
        showNotificationBell
      />

      <PageTransition style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 96, 120) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentWrapper}>
            {/* Top Brand Card: FemmeFlo + Sale Management System */}
            <View style={styles.heroBrandCard}>
              

              <Image
                source={require('../../../../assets/images/femmeflo-logo.png')}
                style={styles.femmefloLogo}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="FemmeFlo brand logo"
              />

              <Text style={styles.systemSubheading}>Sale Management System</Text>
              <Text style={styles.welcomeLine}>
                Welcome, {user?.name || 'Administrator'}
              </Text>
            </View>

            {/* Bottom Corporate Brand Card: Masako Logo */}
            <View style={styles.masakoFooterCard}>
              <Text style={styles.masakoOverline}>A BRAND BY</Text>
              <View style={styles.masakoLogoContainer}>
                <Image
                  source={require('../../../../assets/images/masako-logo.jpeg')}
                  style={styles.masakoLogo}
                  resizeMode="contain"
                  accessibilityRole="image"
                  accessibilityLabel="Masako Enterprises logo"
                />
              </View>
              <Text style={styles.masakoCompanyName}>Masako Enterprises Private Limited</Text>
            
            </View>
          </View>
        </ScrollView>
      </PageTransition>

      <MobileNavigationDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Spacing.lg,
    justifyContent: 'space-between',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
    gap: Spacing.xl,
  },
  heroBrandCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    ...Shadows.md,
  },
  brandTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: Spacing.lg,
  },
  brandTopBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: BrandColors.pink.dark,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  femmefloLogo: {
    width: 220,
    height: 84,
    marginBottom: Spacing.sm,
  },
  femmefloHeading: {
    fontSize: 30,
    fontWeight: '800',
    color: '#006B35',
    letterSpacing: -0.5,
  },
  systemSubheading: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.pink.primary,
    marginTop: 4,
  },
  welcomeLine: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: Spacing.md,
  },
  masakoFooterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  masakoOverline: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Colors.light.textTertiary,
    marginBottom: Spacing.sm,
  },
  masakoLogoContainer: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: Spacing.sm,
  },
  masakoLogo: {
    width: 116,
    height: 116,
  },
  masakoCompanyName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  masakoCaption: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
});
