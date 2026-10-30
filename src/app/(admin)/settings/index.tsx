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
import { authApi } from '@/api/auth';
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

  // Price Invariants
  const [minPriceRupees, setMinPriceRupees] = useState('25');
  const [lowStockThreshold, setLowStockThreshold] = useState('50');

  // Company Legal Settings
  const [companyName, setCompanyName] = useState('');
  const [companyGst, setCompanyGst] = useState('');
  const [companyPan, setCompanyPan] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState('');

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await adminApi.getBusinessSettings();
      if (res.minimumSalePricePaise) {
        setMinPriceRupees(String(res.minimumSalePricePaise / 100));
      } else if (res.minimumPricePaise) {
        setMinPriceRupees(String(res.minimumPricePaise / 100));
      }
      if (res.lowStockThreshold !== undefined) {
        setLowStockThreshold(String(res.lowStockThreshold));
      }
      if (res.companyName) setCompanyName(res.companyName);
      if (res.companyGst) setCompanyGst(res.companyGst);
      if (res.companyPan) setCompanyPan(res.companyPan);
      if (res.companyAddress) setCompanyAddress(res.companyAddress);
      if (res.companyPhone) setCompanyPhone(res.companyPhone);
      if (res.companyEmail) setCompanyEmail(res.companyEmail);
      if (res.invoiceTerms) setInvoiceTerms(res.invoiceTerms);
    } catch {
      // Mock / fallback defaults handled gracefully
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (savingSettings) return;

    const priceNum = parseFloat(minPriceRupees);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Authoritative minimum sale price must be a positive number.');
      return;
    }

    const thresholdNum = parseInt(lowStockThreshold, 10);

    setSavingSettings(true);
    try {
      await adminApi.updateBusinessSettings({
        minimumSalePricePaise: Math.round(priceNum * 100),
        lowStockThreshold: isNaN(thresholdNum) ? undefined : thresholdNum,
        companyName: companyName.trim() || undefined,
        companyGst: companyGst.trim().toUpperCase() || undefined,
        companyPan: companyPan.trim().toUpperCase() || undefined,
        companyAddress: companyAddress.trim() || undefined,
        companyPhone: companyPhone.trim() || undefined,
        companyEmail: companyEmail.trim() || undefined,
        invoiceTerms: invoiceTerms.trim() || undefined,
      });

      Alert.alert(
        'Settings Saved',
        'Company legal information and pricing invariants have been updated successfully.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update company configuration.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) {
      Alert.alert('Required Field', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 12) {
      Alert.alert('Password Too Short', 'New password must be at least 12 characters long.');
      return;
    }
    const byteLength = new TextEncoder().encode(newPassword).length;
    if (byteLength > 72) {
      Alert.alert('Password Too Long', 'New password exceeds the 72-byte limit.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password Updated', 'Your security credentials have been updated successfully.');
    } catch (err: any) {
      Alert.alert('Password Change Failed', err.message || 'Could not update password. Please check your current password.');
    } finally {
      setIsChangingPassword(false);
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
      <Header title="Company & Legal Settings" subtitle="Global Governance & Invoice Configuration" />

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

            {/* Legal Entity & Invoice Details */}
            <Text style={styles.sectionHeading}>Legal Entity & Invoice Details</Text>
            <Card style={styles.card}>
              <View style={styles.ruleNotice}>
                <Ionicons name="document-text-outline" size={18} color={BrandColors.pink.dark} />
                <Text style={styles.ruleNoticeText}>
                  These legal details appear on all generated PDF tax invoices shared with retailers and customers.
                </Text>
              </View>

              <Input
                label="Legal Company Name *"
                placeholder="e.g. MASAKO ENTERPRISES PRIVATE LIMITED"
                value={companyName}
                onChangeText={setCompanyName}
                autoCapitalize="words"
                helperText="Official registered entity name for tax invoices"
                leftIcon={<Ionicons name="business-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="Company GSTIN"
                    placeholder="e.g. 09AAECM1234F1Z5"
                    value={companyGst}
                    onChangeText={(val) => setCompanyGst(val.toUpperCase())}
                    autoCapitalize="characters"
                    helperText="15-character GST identification"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Company PAN"
                    placeholder="e.g. AAECM1234F"
                    value={companyPan}
                    onChangeText={(val) => setCompanyPan(val.toUpperCase())}
                    autoCapitalize="characters"
                    helperText="10-character PAN number"
                  />
                </View>
              </View>

              <Input
                label="Registered Corporate Address"
                placeholder="e.g. Plot 42, Industrial Area Phase II, Lucknow, UP 226012"
                value={companyAddress}
                onChangeText={setCompanyAddress}
                multiline
                numberOfLines={2}
                helperText="Printed on invoice header"
                leftIcon={<Ionicons name="location-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="Official Phone"
                    placeholder="+91 9876543210"
                    value={companyPhone}
                    onChangeText={setCompanyPhone}
                    keyboardType="phone-pad"
                    helperText="Billing support phone"
                    leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Official Email"
                    placeholder="billing@masako.co.in"
                    value={companyEmail}
                    onChangeText={setCompanyEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    helperText="Billing correspondence"
                    leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.light.textTertiary} />}
                  />
                </View>
              </View>

              <Input
                label="Invoice Terms & Conditions"
                placeholder="e.g. 1. Goods once sold will not be returned.\n2. Payment due on delivery."
                value={invoiceTerms}
                onChangeText={setInvoiceTerms}
                multiline
                numberOfLines={3}
                helperText="Standard terms printed at the bottom of all customer invoices"
                leftIcon={<Ionicons name="list-outline" size={18} color={Colors.light.textTertiary} />}
              />
            </Card>

            {/* Pricing Rules & System Invariants */}
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
                title={savingSettings ? 'Saving Settings...' : 'Save Legal & Pricing Configuration'}
                onPress={handleSaveSettings}
                loading={savingSettings}
                variant="admin"
                size="lg"
                icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.sm }}
              />
            </Card>

            {/* Account Security / Change Password */}
            <Text style={styles.sectionHeading}>Account Security</Text>
            <Card style={styles.card}>
              <Text style={styles.cardSubtext}>
                Ensure your Super Admin account uses a strong, unique password of at least 12 characters.
              </Text>

              <Input
                label="Current Password *"
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.light.textTertiary} />}
                rightIcon={
                  <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons
                      name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={Colors.light.textTertiary}
                    />
                  </Pressable>
                }
              />

              <Input
                label="New Password (min 12 characters) *"
                placeholder="Enter new strong password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                helperText={
                  newPassword.length > 0 && newPassword.length < 12
                    ? 'Password is too short (min 12 chars required)'
                    : undefined
                }
                leftIcon={<Ionicons name="key-outline" size={18} color={Colors.light.textTertiary} />}
                rightIcon={
                  <Pressable onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={Colors.light.textTertiary}
                    />
                  </Pressable>
                }
              />

              <Input
                label="Confirm New Password *"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                helperText={
                  confirmPassword.length > 0 && confirmPassword !== newPassword
                    ? 'Passwords do not match'
                    : undefined
                }
                leftIcon={<Ionicons name="checkmark-done-outline" size={18} color={Colors.light.textTertiary} />}
                rightIcon={
                  <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={Colors.light.textTertiary}
                    />
                  </Pressable>
                }
              />

              <Button
                title={isChangingPassword ? 'Updating Password...' : 'Change Password'}
                onPress={handleChangePassword}
                loading={isChangingPassword}
                variant="outline"
                size="md"
                disabled={!currentPassword || newPassword.length < 12 || newPassword !== confirmPassword}
                icon={<Ionicons name="shield-checkmark-outline" size={18} color={BrandColors.pink.primary} />}
                style={{ marginTop: Spacing.sm }}
              />
            </Card>

            {/* Navigation to Invoices, Categories & Shared Features */}
            <Text style={styles.sectionHeading}>Catalog & Administration</Text>
            <Card style={styles.menuCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Central Invoice Directory"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => router.push('/(admin)/invoices' as any)}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconCircle}>
                    <Ionicons name="receipt-outline" size={18} color={BrandColors.pink.dark} />
                  </View>
                  <Text style={styles.menuText}>Central Invoices Directory</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
              </Pressable>

              <View style={styles.menuDivider} />

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
  cardSubtext: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BrandColors.pink.tint,
    borderWidth: 2,
    borderColor: BrandColors.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.h2,
    color: BrandColors.pink.dark,
    fontWeight: '800',
  },
  userName: {
    ...Typography.h3,
    color: Colors.light.text,
  },
  userEmail: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.h3,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  ruleNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BrandColors.pink.tint,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  ruleNoticeText: {
    ...Typography.bodySmall,
    color: BrandColors.pink.dark,
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
    ...Elevation.low,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuItemPressed: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginLeft: 68,
  },
  logoutBtn: {
    marginTop: Spacing.sm,
    borderColor: BrandColors.pink.tint,
  },
});
