import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  HitSlop,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function ManagerProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  // Edit Manager Profile Modal States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [editState, setEditState] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  function handleOpenEditModal() {
    setEditName(user?.name || '');
    const cleanPhone = (user?.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, '');
    setEditPhone(cleanPhone);
    setEditAlternatePhone(user?.alternatePhone || '');
    setEditState(user?.state || '');
    setEditDistrict(user?.district || '');
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
      errors.name = 'Manager name is required (minimum 2 characters)';
    }

    const cleanPhone = editPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = 'Valid 10-digit mobile phone number is required';
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
        address: editAddress.trim() || undefined,
        pincode: editPincode.trim() || undefined,
      });

      setIsEditModalVisible(false);
      Alert.alert('Profile Updated', 'Manager profile and contact details have been successfully saved.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update manager profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
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
      <Header title="Manager Profile" subtitle="Territory Administration" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.innerContainer}>
          <Card style={styles.profileCard}>
            <View style={styles.profileCardTop}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {user?.name?.slice(0, 2).toUpperCase() || 'TM'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user?.name}</Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
                  <Badge label="TERRITORY MANAGER" variant="ACTIVE" style={{ marginTop: 6 }} />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.editProfilePill, pressed && styles.editProfilePillPressed]}
                onPress={handleOpenEditModal}
                accessibilityRole="button"
                accessibilityLabel="Edit Manager Profile"
                hitSlop={HitSlop.sm}
              >
                <Ionicons name="create-outline" size={14} color={BrandColors.green.primary} />
                <Text style={styles.editProfilePillText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Assigned Territory</Text>
              <Text style={styles.infoVal}>
                {[user?.district, user?.state].filter(Boolean).join(', ') || 'All Regions'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoVal}>{user?.phone || 'Not configured'}</Text>
            </View>

            {user?.alternatePhone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Alternate Phone</Text>
                <Text style={styles.infoVal}>{user.alternatePhone}</Text>
              </View>
            ) : null}

            {user?.address ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Office / Address</Text>
                <Text style={styles.infoVal}>
                  {[user.address, user.pincode].filter(Boolean).join(' - ')}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Multi-Role Switcher for Managers with Field Sales Authority */}
          {user?.isSeller ? (
            <Card style={styles.roleSwitchCard}>
              <View style={styles.roleSwitchHeader}>
                <Ionicons name="swap-horizontal" size={20} color={BrandColors.pink.primary} style={{ marginRight: 8 }} />
                <Text style={styles.roleSwitchTitle}>Dual Operational Role</Text>
              </View>
              <Text style={styles.roleSwitchDesc}>
                You are designated as both Territory Manager and Field Sales Officer. Switch into Field Sales mode to enter mobile POS orders and record on-ground duty shifts.
              </Text>
              <Button
                title="Switch to Field Sales Mode"
                variant="primary"
                size="md"
                onPress={() => router.replace('/(seller)' as any)}
                icon={<Ionicons name="bag-handle-outline" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          ) : null}

          <Text style={styles.sectionHeading}>Settings & Actions</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleOpenEditModal}
              accessibilityRole="button"
              accessibilityLabel="Edit Profile Details"
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconBadge, { backgroundColor: BrandColors.green.subtle }]}>
                  <Ionicons name="person-circle-outline" size={20} color={BrandColors.green.primary} />
                </View>
                <Text style={styles.menuText}>Edit Profile & Details</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(shared)/notifications' as any)}
              accessibilityRole="button"
              accessibilityLabel="Notifications Center"
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconBadge, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.light.textPrimary} />
                </View>
                <Text style={styles.menuText}>Notifications Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(shared)/change-password' as any)}
              accessibilityRole="button"
              accessibilityLabel="Change Password"
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconBadge, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="key-outline" size={20} color={Colors.light.textPrimary} />
                </View>
                <Text style={styles.menuText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          </Card>

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

      {/* Edit Manager Profile Modal */}
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
                <Text style={styles.modalTitle}>Edit Manager Profile</Text>
                <Text style={styles.modalSubtitle}>Update your territory management contact and regional office info</Text>
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
                  <Text style={styles.metaChipLabel}>OFFICIAL EMAIL</Text>
                  <Text style={styles.metaChipVal}>{user?.email || 'N/A'}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>ROLE JURISDICTION</Text>
                  <Text style={styles.metaChipVal}>Territory Manager</Text>
                </View>
              </View>

              <Input
                label="Manager Full Name *"
                value={editName}
                onChangeText={(val) => {
                  setEditName(val);
                  if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Enter full legal name"
                error={editErrors.name}
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Primary Phone Number *"
                value={editPhone}
                onChangeText={(val) => {
                  setEditPhone(val);
                  if (editErrors.phone) setEditErrors((prev) => ({ ...prev, phone: '' }));
                }}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                error={editErrors.phone}
                helperText="Primary communication line for district field escalations"
                leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Alternate Phone"
                value={editAlternatePhone}
                onChangeText={setEditAlternatePhone}
                placeholder="Secondary / emergency phone"
                keyboardType="phone-pad"
                maxLength={15}
                leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="Assigned State"
                    value={editState}
                    onChangeText={setEditState}
                    placeholder="e.g. Maharashtra"
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Assigned District"
                    value={editDistrict}
                    onChangeText={setEditDistrict}
                    placeholder="e.g. Thane"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <Input
                label="Regional Office / Residential Address"
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Office or regional address"
                multiline
                numberOfLines={2}
                leftIcon={<Ionicons name="business-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Postal Pincode"
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
                title={savingProfile ? 'Saving...' : 'Save Changes'}
                variant="primary"
                size="md"
                onPress={handleSaveProfile}
                loading={savingProfile}
                style={{ flex: 1.5, backgroundColor: BrandColors.green.primary }}
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
  innerContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
    ...Elevation.low,
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
    backgroundColor: '#EBF6EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: BrandColors.green.primary,
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
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BrandColors.green.subtle,
    borderWidth: 1,
    borderColor: BrandColors.green.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  editProfilePillPressed: {
    opacity: 0.7,
  },
  editProfilePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
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
    borderRadius: BorderRadius.lg,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
    marginBottom: Spacing.lg,
    ...Elevation.low,
  },
  roleSwitchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleSwitchTitle: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  roleSwitchDesc: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    minHeight: 56,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    marginTop: Spacing.xxl,
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...Elevation.high,
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
    ...Typography.h2,
    fontSize: 18,
    color: Colors.light.textPrimary,
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
    borderRadius: BorderRadius.md,
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
