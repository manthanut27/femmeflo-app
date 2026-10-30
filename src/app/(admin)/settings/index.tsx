import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function AdminSettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [minPriceRupees, setMinPriceRupees] = useState('25');
  const [lowStockThreshold, setLowStockThreshold] = useState('50');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .getBusinessSettings()
      .then((res) => {
        if (res.minimumSalePricePaise) {
          setMinPriceRupees(String(res.minimumSalePricePaise / 100));
        }
        if (res.lowStockThreshold) {
          setLowStockThreshold(String(res.lowStockThreshold));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveSettings() {
    if (saving) return;
    const priceNum = parseFloat(minPriceRupees);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Minimum sale price must be a positive number.');
      return;
    }

    const thresholdNum = parseInt(lowStockThreshold, 10);

    setSaving(true);
    try {
      await adminApi.updateBusinessSettings({
        minimumSalePricePaise: Math.round(priceNum * 100),
        lowStockThreshold: isNaN(thresholdNum) ? undefined : thresholdNum,
      });

      Alert.alert('Settings Updated', `Global minimum sale price set to ₹${priceNum.toFixed(2)}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Sign out of executive session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login' as any);
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Business Configuration" subtitle="Global Governance & Price Invariants" />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.pink.dark} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.contentWrapper}>
            {/* Executive Profile Card */}
            <Card style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>SA</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user?.name || 'Super Admin'}</Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
                  <Badge label="SUPERUSER AUTHORITY" variant="ACTIVE" style={{ marginTop: 6 }} />
                </View>
              </View>
            </Card>

            {/* Pricing Invariants Card */}
            <Text style={styles.sectionHeading}>Pricing Rules & System Invariants</Text>
            <Card style={styles.card}>
              <View style={styles.ruleNotice}>
                <Ionicons name="information-circle-outline" size={18} color={BrandColors.pink.dark} />
                <Text style={styles.ruleNoticeText}>
                  Sales recorded by field sellers below this unit price require mandatory Super Admin approval before order confirmation.
                </Text>
              </View>

              <Input
                label="Authoritative Minimum Sale Price (₹) *"
                placeholder="e.g. 25"
                value={minPriceRupees}
                onChangeText={setMinPriceRupees}
                keyboardType="decimal-pad"
                helperText="Field sellers pricing below this value trigger mandatory Super Admin approval"
                leftIcon={<Text style={styles.rupeeSymbol}>₹</Text>}
              />

              <Input
                label="Low Stock Warehouse Warning (Packets)"
                placeholder="e.g. 50"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                keyboardType="number-pad"
                helperText="Threshold for alerting re-order triggers"
                leftIcon={<Ionicons name="cube-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Button
                title={saving ? 'Saving...' : 'Save Configuration'}
                onPress={handleSaveSettings}
                loading={saving}
                variant="admin"
                size="lg"
                icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.sm }}
              />
            </Card>

            {/* Navigation to Categories & Shared Features */}
            <Text style={styles.sectionHeading}>Catalog & Administration</Text>
            <Card style={styles.menuCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage Customer Categories"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => router.push('/(admin)/categories' as any)}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconCircle}>
                    <Ionicons name="pricetags-outline" size={18} color={BrandColors.pink.dark} />
                  </View>
                  <Text style={styles.menuText}>Manage Customer Categories</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
              </Pressable>

              <View style={styles.menuDivider} />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notifications Center"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => router.push('/(shared)/notifications' as any)}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconCircle}>
                    <Ionicons name="notifications-outline" size={18} color={BrandColors.pink.dark} />
                  </View>
                  <Text style={styles.menuText}>Notifications Center</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
              </Pressable>
            </Card>

            {/* Logout */}
            <Button
              title="Sign Out of Super Admin Session"
              variant="outline"
              size="lg"
              onPress={handleLogout}
              style={styles.logoutBtn}
              icon={<Ionicons name="log-out-outline" size={20} color={BrandColors.pink.primary} />}
            />
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
  },
  avatarText: {
    ...Typography.h2,
    color: BrandColors.pink.dark,
    fontWeight: '800',
  },
  userName: {
    ...Typography.h2,
    color: Colors.light.textPrimary,
  },
  userEmail: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  ruleNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: BrandColors.pink.subtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
  },
  ruleNoticeText: {
    flex: 1,
    ...Typography.bodySmall,
    color: BrandColors.pink.dark,
    lineHeight: 18,
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
    ...Elevation.low,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    minHeight: 56,
  },
  menuItemPressed: {
    backgroundColor: '#F8FAFC',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: Spacing.lg,
  },
  logoutBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
});
