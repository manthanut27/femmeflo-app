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

  // Price Invariants
  const [minPriceRupees, setMinPriceRupees] = useState('25');
  const [lowStockThreshold, setLowStockThreshold] = useState('50');
  const [savingPricing, setSavingPricing] = useState(false);

  // Company Legal Settings
  const [companyName, setCompanyName] = useState('');
  const [companyGst, setCompanyGst] = useState('');
  const [companyPan, setCompanyPan] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState('');

  // Edit / Save toggle for Legal Entity & Invoice Details
  const [isEditingLegal, setIsEditingLegal] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);
  const [originalLegal, setOriginalLegal] = useState({
    companyName: '',
    companyGst: '',
    companyPan: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    invoiceTerms: '',
  });

  const [loading, setLoading] = useState(true);

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

      // Filter out any default dummy placeholder text to ensure fields are clean
      const rawName = res.companyName && res.companyName !== 'MASAKO ENTERPRISES PRIVATE LIMITED' ? res.companyName : '';
      const rawGst = res.companyGst && res.companyGst !== '09AAECM1234F1Z5' ? res.companyGst : '';
      const rawPan = res.companyPan && res.companyPan !== 'AAECM1234F' ? res.companyPan : '';
      const rawAddr = res.companyAddress && !res.companyAddress.includes('Plot 42') ? res.companyAddress : '';
      const rawPhone = res.companyPhone && res.companyPhone !== '+91 9876543210' ? res.companyPhone : '';
      const rawEmail = res.companyEmail && res.companyEmail !== 'billing@masako.co.in' ? res.companyEmail : '';
      const rawTerms = res.invoiceTerms && !res.invoiceTerms.includes('Goods once sold will not be taken back') ? res.invoiceTerms : '';

      setCompanyName(rawName);
      setCompanyGst(rawGst);
      setCompanyPan(rawPan);
      setCompanyAddress(rawAddr);
      setCompanyPhone(rawPhone);
      setCompanyEmail(rawEmail);
      setInvoiceTerms(rawTerms);

      setOriginalLegal({
        companyName: rawName,
        companyGst: rawGst,
        companyPan: rawPan,
        companyAddress: rawAddr,
        companyPhone: rawPhone,
        companyEmail: rawEmail,
        invoiceTerms: rawTerms,
      });
    } catch {
      // Defaults handled gracefully
    } finally {
      setLoading(false);
    }
  }

  function handleCancelLegalEdit() {
    setCompanyName(originalLegal.companyName);
    setCompanyGst(originalLegal.companyGst);
    setCompanyPan(originalLegal.companyPan);
    setCompanyAddress(originalLegal.companyAddress);
    setCompanyPhone(originalLegal.companyPhone);
    setCompanyEmail(originalLegal.companyEmail);
    setInvoiceTerms(originalLegal.invoiceTerms);
    setIsEditingLegal(false);
  }

  async function handleSaveLegalDetails() {
    if (savingLegal) return;
    setSavingLegal(true);
    try {
      await adminApi.updateBusinessSettings({
        companyName: companyName.trim() || undefined,
        companyGst: companyGst.trim().toUpperCase() || undefined,
        companyPan: companyPan.trim().toUpperCase() || undefined,
        companyAddress: companyAddress.trim() || undefined,
        companyPhone: companyPhone.trim() || undefined,
        companyEmail: companyEmail.trim() || undefined,
        invoiceTerms: invoiceTerms.trim() || undefined,
      });

      setOriginalLegal({
        companyName,
        companyGst,
        companyPan,
        companyAddress,
        companyPhone,
        companyEmail,
        invoiceTerms,
      });

      setIsEditingLegal(false);
      Alert.alert(
        'Legal Details Saved',
        'Company legal information and invoice details have been updated successfully.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update legal details.');
    } finally {
      setSavingLegal(false);
    }
  }

  async function handleSavePricing() {
    if (savingPricing) return;

    const priceNum = parseFloat(minPriceRupees);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Authoritative minimum sale price must be a positive number.');
      return;
    }

    const thresholdNum = parseInt(lowStockThreshold, 10);

    setSavingPricing(true);
    try {
      await adminApi.updateBusinessSettings({
        minimumSalePricePaise: Math.round(priceNum * 100),
        lowStockThreshold: isNaN(thresholdNum) ? undefined : thresholdNum,
      });

      Alert.alert(
        'Pricing Rules Saved',
        'Minimum price threshold and inventory alert level updated successfully.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update pricing rules.');
    } finally {
      setSavingPricing(false);
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

            {/* Legal Entity & Invoice Details Card */}
            <Card style={styles.card}>
              <View style={styles.cardHeaderWithAction}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.cardHeaderTitle}>Legal Entity & Invoice Details</Text>
                  <Text style={styles.cardHeaderSubtitle}>
                    Official registered business info printed on PDF tax invoices
                  </Text>
                </View>
                {!isEditingLegal ? (
                  <Button
                    title="Edit Details"
                    variant="outline"
                    size="sm"
                    onPress={() => setIsEditingLegal(true)}
                    icon={<Ionicons name="create-outline" size={15} color={BrandColors.pink.dark} />}
                  />
                ) : (
                  <Badge label="EDITING MODE" variant="warning" size="sm" />
                )}
              </View>

              <View style={styles.ruleNotice}>
                <Ionicons name="document-text-outline" size={18} color={BrandColors.pink.dark} />
                <Text style={styles.ruleNoticeText}>
                  {isEditingLegal
                    ? 'Enter your official corporate credentials below and tap Save Legal Details when finished.'
                    : 'These legal details appear on all generated PDF tax invoices. Tap "Edit Details" to update the form.'}
                </Text>
              </View>

              <Input
                label="Legal Company Name *"
                placeholder="Enter legal entity / business name"
                value={companyName}
                onChangeText={setCompanyName}
                autoCapitalize="words"
                editable={isEditingLegal}
                containerStyle={!isEditingLegal ? styles.readOnlyInput : undefined}
                helperText="Official registered entity name for tax invoices"
                leftIcon={<Ionicons name="business-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="Company GSTIN"
                    placeholder="Enter 15-digit GSTIN"
                    value={companyGst}
                    onChangeText={(val) => setCompanyGst(val.toUpperCase())}
                    autoCapitalize="characters"
                    editable={isEditingLegal}
                    containerStyle={!isEditingLegal ? styles.readOnlyInput : undefined}
                    helperText="15-character GST identification"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Company PAN"
                    placeholder="Enter 10-digit PAN"
                    value={companyPan}
                    onChangeText={(val) => setCompanyPan(val.toUpperCase())}
                    autoCapitalize="characters"
                    editable={isEditingLegal}
                    containerStyle={!isEditingLegal ? styles.readOnlyInput : undefined}
                    helperText="10-character PAN number"
                  />
                </View>
              </View>

              <Input
                label="Registered Corporate Address"
                placeholder="Enter registered corporate / office address"
                value={companyAddress}
                onChangeText={setCompanyAddress}
                multiline
                numberOfLines={2}
                editable={isEditingLegal}
                containerStyle={!isEditingLegal ? styles.readOnlyInput : undefined}
                helperText="Printed on invoice header"
                leftIcon={<Ionicons name="location-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="Official Phone"
                    placeholder="Enter billing phone number"
                    value={companyPhone}
                    onChangeText={setCompanyPhone}
                    keyboardType="phone-pad"
                    editable={isEditingLegal}
                    containerStyle={!isEditingLegal ? styles.readOnlyInput : undefined}
                    helperText="Billing support phone"
                    leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Official Email"
                    placeholder="Enter billing email address"
                    value={companyEmail}
                    onChangeText={setCompanyEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={isEditingLegal}
                    containerStyle={!isEditingLegal ? styles.readOnlyInput : undefined}
                    helperText="Billing correspondence"
                    leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.light.textTertiary} />}
                  />
                </View>
              </View>

              <Input
                label="Invoice Terms & Conditions"
                placeholder="Enter standard payment, delivery, or warranty terms"
                value={invoiceTerms}
                onChangeText={setInvoiceTerms}
                multiline
                numberOfLines={3}
                editable={isEditingLegal}
                containerStyle={!isEditingLegal ? styles.readOnlyInput : undefined}
                helperText="Standard terms printed at the bottom of customer invoices"
                leftIcon={<Ionicons name="list-outline" size={18} color={Colors.light.textTertiary} />}
              />

              {isEditingLegal && (
                <View style={styles.legalActionRow}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    size="md"
                    style={{ flex: 1, marginRight: Spacing.sm }}
                    onPress={handleCancelLegalEdit}
                    disabled={savingLegal}
                  />
                  <Button
                    title={savingLegal ? 'Saving Legal Details...' : 'Save Legal Details'}
                    variant="admin"
                    size="md"
                    style={{ flex: 1.5 }}
                    loading={savingLegal}
                    onPress={handleSaveLegalDetails}
                    icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
                  />
                </View>
              )}
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
                title={savingPricing ? 'Saving Rules...' : 'Save Pricing Rules'}
                onPress={handleSavePricing}
                loading={savingPricing}
                variant="admin"
                size="lg"
                icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
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

            {/* Change Password Button (Located directly above Sign Out) */}
            <Button
              title="Change Password"
              variant="outline"
              size="lg"
              onPress={() => router.push('/(admin)/settings/password' as any)}
              style={styles.changePasswordBtn}
              icon={<Ionicons name="key-outline" size={18} color={BrandColors.pink.dark} />}
            />

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
  cardHeaderWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardHeaderTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  cardHeaderSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  userName: {
    ...Typography.h2,
    color: Colors.light.textPrimary,
  },
  userEmail: {
    ...Typography.bodyMedium,
    color: Colors.light.textSecondary,
  },
  sectionHeading: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginLeft: 4,
  },
  ruleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDF2F8',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    marginBottom: Spacing.md,
  },
  ruleNoticeText: {
    ...Typography.caption,
    color: BrandColors.pink.dark,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  readOnlyInput: {
    opacity: 0.85,
  },
  legalActionRow: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: Spacing.xs,
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.pink.dark,
    marginRight: 4,
  },
  menuCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 0,
    overflow: 'hidden',
    ...Elevation.low,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  menuItemPressed: {
    backgroundColor: Colors.light.surfaceMuted,
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
    marginHorizontal: Spacing.md,
  },
  changePasswordBtn: {
    borderColor: BrandColors.pink.border,
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  logoutBtn: {
    borderColor: BrandColors.pink.tint,
    backgroundColor: '#FFF1F2',
    marginBottom: Spacing.huge,
  },
});
