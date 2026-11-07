import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { Shift } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import {
  BrandColors,
  Colors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function SellerProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [totalShiftsCount, setTotalShiftsCount] = useState<number>(0);

  // Edit Profile Modal States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [editState, setEditState] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editVillage, setEditVillage] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    sellerApi
      .getShiftHistory({ pageSize: 5 })
      .then((res) => {
        setShiftHistory(res.items || []);
        setTotalShiftsCount(res.pagination?.total ?? (res.items?.length || 0));
      })
      .catch(() => {});
  }, []);

  function handleOpenEditModal() {
    setEditName(user?.name || '');
    const cleanPhone = (user?.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, '');
    setEditPhone(cleanPhone);
    setEditAlternatePhone(user?.alternatePhone || '');
    setEditState(user?.state || '');
    setEditDistrict(user?.district || '');
    setEditVillage(user?.village || '');
    setEditAddress(user?.address || '');
    setEditPincode(user?.pincode || '');
    setEditErrors({});
    setIsEditModalVisible(true);
  }

  function handleCloseEditModal() {
    if (savingProfile) return;
    setIsEditModalVisible(false);
  }

  async function handleSaveProfile() {
    const errors: Record<string, string> = {};
    const trimmedName = editName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.name = 'Full name is required (minimum 2 characters)';
    }

    const cleanPhone = editPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = 'Valid 10-digit mobile number is required';
    }

    if (editPincode.trim() && !/^\d{6}$/.test(editPincode.trim())) {
      errors.pincode = 'Pincode must be exactly 6 digits';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setSavingProfile(true);
    setEditErrors({});

    try {
      const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : `+91${cleanPhone.slice(-10)}`;

      await updateProfile({
        name: trimmedName,
        phone: formattedPhone,
        alternatePhone: editAlternatePhone.trim() || undefined,
        state: editState.trim() || undefined,
        district: editDistrict.trim() || undefined,
        village: editVillage.trim() || undefined,
        address: editAddress.trim() || undefined,
        pincode: editPincode.trim() || undefined,
      });

      setIsEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile details.');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your session?', [
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
    <View style={styles.container}>
      <Header title="My Profile" subtitle="Field Officer Account & Duty Log" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          {/* User Card */}
          <Card style={styles.profileCard}>
            <View style={styles.profileCardTop}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {user?.name?.slice(0, 2).toUpperCase() || 'SF'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user?.name}</Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
                  <Badge label="SELLER • FIELD FORCE" variant="ACTIVE" style={{ marginTop: 6 }} />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.editProfilePill, pressed && styles.editProfilePillPressed]}
                onPress={handleOpenEditModal}
                accessibilityRole="button"
                accessibilityLabel="Edit Officer Profile"
                hitSlop={HitSlop.sm}
              >
                <Ionicons name="create-outline" size={14} color={BrandColors.pink.primary} />
                <Text style={styles.editProfilePillText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mobile Number</Text>
              <Text style={styles.infoVal}>{user?.phone || 'Not provided'}</Text>
            </View>

            {user?.alternatePhone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Alternate Phone</Text>
                <Text style={styles.infoVal}>{user.alternatePhone}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Territory</Text>
              <Text style={styles.infoVal}>
                {[user?.village, user?.district, user?.state].filter(Boolean).join(', ') || 'Assigned Territory'}
              </Text>
            </View>

            {user?.address ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoVal}>
                  {[user.address, user.pincode].filter(Boolean).join(' - ')}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Multi-Role Return for Managers viewing Field Sales Mode */}
          {user?.role === 'MANAGER' ? (
            <Card style={styles.roleSwitchCard}>
              <View style={styles.roleSwitchHeader}>
                <Ionicons name="swap-horizontal" size={20} color={BrandColors.green.primary} style={{ marginRight: 8 }} />
                <Text style={styles.roleSwitchTitle}>Territory Manager Session</Text>
              </View>
              <Text style={styles.roleSwitchDesc}>
                You are currently in Field Sales Mode. Tap below to return to your primary Territory Manager operational dashboard.
              </Text>
              <Button
                title="Return to Manager Hub"
                variant="secondary"
                size="md"
                onPress={() => router.replace('/(manager)' as any)}
                icon={<Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          ) : null}

          {/* Operational Shortcuts */}
          <Text style={styles.sectionHeading}>Account Settings</Text>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Profile Details"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={handleOpenEditModal}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconCircle}>
                  <Ionicons name="person-circle-outline" size={18} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.menuText}>Edit Profile & Details</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
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
                  <Ionicons name="notifications-outline" size={18} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.menuText}>Notifications Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change Password"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => router.push('/(shared)/change-password' as any)}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconCircle}>
                  <Ionicons name="key-outline" size={18} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.menuText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          </Card>

          {/* Recent Duty Shifts */}
          <View style={styles.shiftSectionHeader}>
            <Text style={styles.sectionHeading}>Recent Duty Shifts</Text>
            {shiftHistory.length > 0 ? (
              <Pressable
                onPress={() => router.push('/(seller)/profile/shifts' as any)}
                hitSlop={HitSlop.md}
                style={styles.viewAllLink}
                accessibilityRole="button"
                accessibilityLabel="View all duty shifts"
              >
                <Text style={styles.viewAllLinkText}>See All ({totalShiftsCount || shiftHistory.length})</Text>
                <Ionicons name="chevron-forward" size={14} color={BrandColors.pink.primary} />
              </Pressable>
            ) : null}
          </View>

          {shiftHistory.length === 0 ? (
            <Card variant="flat" style={{ padding: Spacing.md }}>
              <Text style={{ color: '#64748B', ...Typography.caption }}>No completed shifts recorded yet.</Text>
            </Card>
          ) : (
            <>
              {shiftHistory.slice(0, 5).map((shift) => (
                <Card key={shift.id} style={styles.shiftCard}>
                  <View style={styles.shiftHeader}>
                    <Text style={styles.shiftDate}>
                      {new Date(shift.startTime).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <Badge label={shift.status} variant={shift.status === 'COMPLETED' ? 'success' : 'warning'} size="sm" />
                  </View>
                  <Text style={styles.shiftKm}>
                    Odometer: {shift.startOdometerKm} KM → {shift.endOdometerKm ?? 'Active'} KM
                    {shift.endOdometerKm ? ` (${(shift.endOdometerKm - shift.startOdometerKm).toFixed(1)} KM traveled)` : ''}
                  </Text>
                </Card>
              ))}

              <Pressable
                style={styles.seeMoreShiftsBtn}
                onPress={() => router.push('/(seller)/profile/shifts' as any)}
                accessibilityRole="button"
                accessibilityLabel="View full shifts history in a separate page"
              >
                <Text style={styles.seeMoreShiftsText}>
                  {totalShiftsCount > 5
                    ? `View All ${totalShiftsCount} Shifts on Dedicated Page`
                    : 'View Detailed Shifts History'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={BrandColors.pink.primary} />
              </Pressable>
            </>
          )}

          {/* Sign Out Button */}
          <Button
            title="Sign Out"
            variant="outline"
            size="lg"
            onPress={handleLogout}
            style={styles.logoutBtn}
            icon={<Ionicons name="log-out-outline" size={20} color={BrandColors.pink.primary} />}
          />
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={handleCloseEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={handleCloseEditModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Profile Details</Text>
                <Text style={styles.modalSubtitle}>Update your on-field contact and territory information</Text>
              </View>
              <Pressable
                onPress={handleCloseEditModal}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Profile Editor"
              >
                <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScrollBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Identity Chips */}
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>EMAIL</Text>
                  <Text style={styles.metaChipVal}>{user?.email || 'N/A'}</Text>
                </View>
                {user?.employeeCode ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipLabel}>EMP CODE</Text>
                    <Text style={styles.metaChipVal}>{user.employeeCode}</Text>
                  </View>
                ) : null}
              </View>

              <Input
                label="Full Name *"
                value={editName}
                onChangeText={(val) => {
                  setEditName(val);
                  if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Enter full name"
                error={editErrors.name}
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Mobile Phone *"
                value={editPhone}
                onChangeText={(val) => {
                  setEditPhone(val);
                  if (editErrors.phone) setEditErrors((prev) => ({ ...prev, phone: '' }));
                }}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                error={editErrors.phone}
                helperText="Primary contact number for communications and alerts"
                leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Alternate Phone"
                value={editAlternatePhone}
                onChangeText={setEditAlternatePhone}
                placeholder="Optional emergency phone"
                keyboardType="phone-pad"
                maxLength={15}
                leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="State"
                    value={editState}
                    onChangeText={setEditState}
                    placeholder="e.g. Maharashtra"
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="District"
                    value={editDistrict}
                    onChangeText={setEditDistrict}
                    placeholder="e.g. Thane"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <Input
                label="Village / Assigned Beat"
                value={editVillage}
                onChangeText={setEditVillage}
                placeholder="e.g. Diva, Mumbra, Shilphata"
                autoCapitalize="words"
                leftIcon={<Ionicons name="location-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Residential Address"
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Street address or landmark"
                multiline
                numberOfLines={2}
                leftIcon={<Ionicons name="home-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Pincode"
                value={editPincode}
                onChangeText={(val) => {
                  setEditPincode(val);
                  if (editErrors.pincode) setEditErrors((prev) => ({ ...prev, pincode: '' }));
                }}
                placeholder="6-digit postal code"
                keyboardType="number-pad"
                maxLength={6}
                error={editErrors.pincode}
                leftIcon={<Ionicons name="pin-outline" size={18} color={Colors.light.textTertiary} />}
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={handleCloseEditModal}
                style={{ flex: 1, marginRight: Spacing.sm }}
                disabled={savingProfile}
              />
              <Button
                title={savingProfile ? 'Saving...' : 'Save Profile'}
                variant="primary"
                size="md"
                onPress={handleSaveProfile}
                loading={savingProfile}
                style={{ flex: 1.5 }}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  contentWrapper: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.light.surface,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 2,
    borderColor: BrandColors.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.headingMedium,
    color: BrandColors.pink.primary,
    fontWeight: '800',
  },
  userName: {
    ...Typography.headingSmall,
    color: Colors.light.heading,
  },
  userEmail: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  editProfilePillPressed: {
    opacity: 0.7,
  },
  editProfilePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  infoVal: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  roleSwitchCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: BrandColors.green.subtle,
    borderWidth: 1,
    borderColor: BrandColors.green.tint,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  roleSwitchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleSwitchTitle: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  roleSwitchDesc: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  sectionHeading: {
    ...Typography.headingSmall,
    fontSize: 15,
    color: Colors.light.heading,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: Spacing.lg,
  },
  shiftCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shiftDate: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  shiftKm: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  shiftSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  viewAllLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  seeMoreShiftsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  seeMoreShiftsText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  logoutBtn: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.headingSmall,
    color: Colors.light.heading,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalScrollBody: {
    padding: Spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metaChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  metaChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textTertiary,
    letterSpacing: 0.5,
  },
  metaChipVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    marginTop: 2,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalActionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
});
