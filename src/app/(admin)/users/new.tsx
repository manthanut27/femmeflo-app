import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import { sellerApi } from '@/api/seller';
import type { PublicUser } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DropdownTrigger } from '@/components/ui/SearchableDropdownModal';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import {
  BorderRadius,
  BrandColors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';

const MANAGER_QUALIFICATION_OPTIONS = [
  'Graduate (B.A. / B.Com / B.Sc / BBA)',
  'Post Graduate (M.A. / M.Com / M.Sc / MBA)',
  'Diploma / Polytech',
  'Higher Secondary (12th Pass)',
  'Secondary (10th Pass)',
];

const SELLER_QUALIFICATION_OPTIONS = [
  '12th Standard / HSC / Intermediate',
  'Graduate (B.A. / B.Com / B.Sc / BBA)',
  '10th Standard / SSC / Matriculation',
  'Diploma / ITI',
  'Post Graduate (M.A. / M.Com / M.Sc / MBA)',
];

const DEFAULT_MANAGER_PERMISSIONS = [
  { id: 'view_sellers', label: 'View assigned field officers' },
  { id: 'onboard_sellers', label: 'Onboard new field officers' },
  { id: 'view_customers', label: 'View customer directory' },
  { id: 'onboard_customers', label: 'Onboard new customers' },
  { id: 'monitor_stock', label: 'Monitor territory stock' },
];

function formatAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export default function AdminOnboardUserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole = params.role === 'SELLER' ? 'SELLER' : 'MANAGER';
  const [selectedRole, setSelectedRole] = useState<'MANAGER' | 'SELLER'>(initialRole);

  // Common Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('FemmeFlo@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Thane');
  const [town, setTown] = useState('Thane City');

  // Shared Verification & Identity Fields
  const [designation, setDesignation] = useState('Field Sales Officer');
  const [employeeCode, setEmployeeCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [qualification, setQualification] = useState(
    initialRole === 'MANAGER'
      ? 'Graduate (B.A. / B.Com / B.Sc / BBA)'
      : '12th Standard / HSC / Intermediate'
  );
  const [alternatePhone, setAlternatePhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [isQualDropdownOpen, setIsQualDropdownOpen] = useState(false);

  // Manager-Specific Fields
  const [isSeller, setIsSeller] = useState(false);
  const [managerPermissions, setManagerPermissions] = useState<string[]>([
    'view_sellers',
    'onboard_sellers',
    'view_customers',
    'onboard_customers',
    'monitor_stock',
  ]);

  // Seller-Specific Fields
  const [managers, setManagers] = useState<PublicUser[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isManagerPickerOpen, setIsManagerPickerOpen] = useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = useState('');
  const [village, setVillage] = useState('Diva');

  // Submission & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Load active managers if role is SELLER
  const loadManagers = useCallback(async () => {
    setLoadingManagers(true);
    try {
      const res = await adminApi.listManagers({ page: 1, pageSize: 100 });
      const activeList = res.items.filter((m) => m.active);
      setManagers(activeList);
      if (activeList.length > 0 && !selectedManagerId) {
        setSelectedManagerId(activeList[0].id);
        if (activeList[0].state) setState(activeList[0].state);
        if (activeList[0].district) setDistrict(activeList[0].district);
      }
    } catch (err) {
      console.warn('Failed to fetch managers', err);
    } finally {
      setLoadingManagers(false);
    }
  }, [selectedManagerId]);

  useEffect(() => {
    if (selectedRole === 'SELLER') {
      loadManagers();
    }
  }, [selectedRole, loadManagers]);

  useEffect(() => {
    if (params.role === 'SELLER') {
      setSelectedRole('SELLER');
      setQualification('12th Standard / HSC / Intermediate');
    } else if (params.role === 'MANAGER') {
      setSelectedRole('MANAGER');
      setQualification('Graduate (B.A. / B.Com / B.Sc / BBA)');
    }
  }, [params.role]);

  const selectedManager = useMemo(() => {
    return managers.find((m) => m.id === selectedManagerId);
  }, [managers, selectedManagerId]);

  const filteredManagers = useMemo(() => {
    const q = managerSearchQuery.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter((m) => {
      const matchName = m.name?.toLowerCase().includes(q) ?? false;
      const matchEmail = m.email?.toLowerCase().includes(q) ?? false;
      const matchPhone = m.phone?.toLowerCase().includes(q) ?? false;
      const matchDistrict = m.district?.toLowerCase().includes(q) ?? false;
      const matchState = m.state?.toLowerCase().includes(q) ?? false;
      return matchName || matchEmail || matchPhone || matchDistrict || matchState;
    });
  }, [managers, managerSearchQuery]);

  function handleSelectManager(m: PublicUser) {
    setSelectedManagerId(m.id);
    if (m.state) setState(m.state);
    if (m.district) setDistrict(m.district);
    setIsManagerPickerOpen(false);
    setManagerSearchQuery('');
    if (errors.managerId) setErrors((p) => ({ ...p, managerId: '' }));
  }

  function toggleManagerPermission(permId: string) {
    setManagerPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  }

  function handleAadhaarChange(val: string) {
    const formatted = formatAadhaar(val);
    setAadhaarNumber(formatted);
    if (errors.aadhaarNumber) {
      setErrors((prev) => ({ ...prev, aadhaarNumber: '' }));
    }
  }

  async function handlePincodeChange(text: string) {
    setPincode(text);
    if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: '' }));

    if (text.length === 6 && /^\d{6}$/.test(text)) {
      setPincodeLoading(true);
      try {
        const lookup = await sellerApi.lookupPincode(text);
        if (lookup.state) setState(lookup.state);
        if (lookup.district) setDistrict(lookup.district);
        if (lookup.village) {
          setVillage(lookup.village);
          setTown(lookup.village);
        }
      } catch {
        // Fallback
      } finally {
        setPincodeLoading(false);
      }
    }
  }

  function validate() {
    const errs: Record<string, string> = {};

    if (selectedRole === 'MANAGER') {
      if (!name.trim()) errs.name = 'Manager name is required.';

      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        errs.phone = 'Valid 10-digit mobile number is required.';
      }

      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = 'Please provide a valid email format.';
      }

      if (!password || password.length < 12) {
        errs.password = 'Initial password must be at least 12 characters (or use FemmeFlo@2026).';
      }

      if (!state.trim()) errs.state = 'State is required.';
      if (!district.trim()) errs.district = 'District is required.';

      const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
      if (!cleanAadhaar || cleanAadhaar.length !== 12) {
        errs.aadhaarNumber = '12-digit UIDAI Aadhaar card number is required.';
      }
      if (!drivingLicenseNumber.trim()) {
        errs.drivingLicenseNumber = 'Valid Indian Driving License number is required.';
      }
    } else {
      // SELLER validation matching Section 1 to 4
      if (!name.trim()) errs.name = 'Employee name is required.';
      if (!designation.trim()) errs.designation = 'Designation is required.';
      if (!selectedManagerId) errs.managerId = 'Assigned reporting manager is required.';

      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        errs.phone = 'Valid 10-digit Indian mobile number is required.';
      }

      if (alternatePhone.trim()) {
        const cleanAlt = alternatePhone.replace(/\D/g, '');
        if (cleanAlt.length !== 10) {
          errs.alternatePhone = 'Alternate phone must be a 10-digit mobile number.';
        } else if (cleanAlt === cleanPhone) {
          errs.alternatePhone = 'Phone Number 2 must be distinct from Phone Number 1.';
        }
      }

      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = 'Please provide a valid email format.';
      }

      if (!password || password.length < 8) {
        errs.password = 'Initial password must be at least 8 characters.';
      }

      const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
      if (!cleanAadhaar || cleanAadhaar.length !== 12) {
        errs.aadhaarNumber = '12-digit Indian Aadhaar number is mandatory.';
      }

      if (!drivingLicenseNumber.trim()) {
        errs.drivingLicenseNumber = 'Valid Indian Driving License number is mandatory.';
      }

      if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
        errs.pincode = 'Valid 6-digit PIN code is required.';
      }

      if (!village.trim()) errs.village = 'Village / Town / Locality is required.';
      if (!district.trim()) errs.district = 'District is required.';
      if (!state.trim()) errs.state = 'State is required.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setFeedback({ type: 'error', message: 'Please correct all highlighted fields.' });
    }
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setFeedback(null);
    if (!validate()) return;

    setIsSubmitting(true);
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const formattedPhone = `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;
    const cleanAltPhone = alternatePhone.trim() ? `+91 ${alternatePhone.replace(/\D/g, '').slice(-10)}` : undefined;

    try {
      if (selectedRole === 'MANAGER') {
        const res = await adminApi.createManager({
          name: name.trim(),
          employeeCode: employeeCode.trim() || undefined,
          phone: formattedPhone,
          email: email.trim() || undefined,
          password: password.trim() || 'FemmeFlo@2026',
          state: state.trim(),
          district: district.trim(),
          village: town.trim() || undefined,
          aadhaarNumber: aadhaarNumber.replace(/\s+/g, '').trim(),
          drivingLicenseNumber: drivingLicenseNumber.trim(),
          qualification: qualification.trim(),
          alternatePhone: cleanAltPhone,
          address: address.trim() || undefined,
          pincode: pincode.trim() || undefined,
          isSeller,
          permissions: managerPermissions,
        });

        setFeedback({
          type: 'success',
          message: `Territory Manager ${res.manager.name} (${formattedPhone}) onboarded successfully!`,
        });

        Alert.alert(
          'Manager Provisioned Successfully',
          `${res.manager.name} has been enrolled as Territory Manager for ${district.trim()}, ${state.trim()}.${
            isSeller ? ' Dual-Role Persona is enabled (can also book direct sales).' : ''
          }`,
          [
            {
              text: 'View Users Directory',
              onPress: () => router.replace('/(admin)/users' as any),
            },
          ]
        );
      } else {
        const res = await adminApi.createSeller({
          name: name.trim(),
          designation: designation.trim(),
          employeeCode: employeeCode.trim() || undefined,
          active: isActive,
          managerId: selectedManagerId,
          phone: formattedPhone,
          alternatePhone: cleanAltPhone,
          email: email.trim() || undefined,
          password: password.trim() || 'FemmeFlo@2026',
          aadhaarNumber: aadhaarNumber.replace(/\s+/g, '').trim(),
          drivingLicenseNumber: drivingLicenseNumber.trim(),
          qualification: qualification.trim(),
          address: address.trim() || undefined,
          pincode: pincode.trim(),
          village: village.trim(),
          district: district.trim(),
          state: state.trim(),
        });

        setFeedback({
          type: 'success',
          message: `Field Sales Officer ${res.seller.name} (${formattedPhone}) onboarded successfully!`,
        });

        Alert.alert(
          'Officer Onboarded Successfully',
          `${res.seller.name} has been enrolled as ${designation.trim()} assigned to ${village.trim()}, ${district.trim()} reporting to ${selectedManager?.name || 'Territory Manager'}.`,
          [
            {
              text: 'View Users & Roster',
              onPress: () => router.replace('/(admin)/users' as any),
            },
          ]
        );
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to onboard user.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Onboarding Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isMgr = selectedRole === 'MANAGER';
  const roleThemeColor = isMgr ? BrandColors.green.primary : '#9F2545';
  const activeQualOptions = isMgr ? MANAGER_QUALIFICATION_OPTIONS : SELLER_QUALIFICATION_OPTIONS;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title={isMgr ? 'Onboard Territory Manager' : 'Officer information'}
        subtitle={
          isMgr
            ? 'Add and provision regional depot manager accounts'
            : 'Complete the required fields to save this record to the database'
        }
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Breadcrumb Navigation */}
          <View style={styles.breadcrumbBar}>
            <Text style={styles.breadcrumbWorkspace}>Admin workspace / Users</Text>
            <View style={styles.breadcrumbRow}>
              <Pressable
                style={styles.breadcrumbLink}
                onPress={() => router.replace('/(admin)/users' as any)}
              >
                <Ionicons name="arrow-back" size={13} color={roleThemeColor} style={{ marginRight: 4 }} />
                <Text style={[styles.breadcrumbLinkText, { color: roleThemeColor }]}>Back to users</Text>
              </Pressable>
              <Text style={styles.breadcrumbDivider}>•</Text>
              <Text style={styles.breadcrumbCurrent}>
                {isMgr ? 'Manager credentials & territory' : 'Officer onboarding'}
              </Text>
            </View>
          </View>

          {/* Role Tabs Switcher */}
          <View style={styles.roleTabsRow}>
            <Pressable
              style={[styles.roleTab, isMgr && styles.roleTabActiveManager]}
              onPress={() => {
                setSelectedRole('MANAGER');
                setQualification('Graduate (B.A. / B.Com / B.Sc / BBA)');
                setFeedback(null);
                setErrors({});
              }}
            >
              <Ionicons
                name="briefcase"
                size={16}
                color={isMgr ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text style={isMgr ? styles.roleTabTextActive : styles.roleTabTextInactive}>
                Territory Manager
              </Text>
            </Pressable>

            <Pressable
              style={[styles.roleTab, !isMgr && styles.roleTabActiveSeller]}
              onPress={() => {
                setSelectedRole('SELLER');
                setQualification('12th Standard / HSC / Intermediate');
                setFeedback(null);
                setErrors({});
              }}
            >
              <Ionicons
                name="person"
                size={16}
                color={!isMgr ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text style={!isMgr ? styles.roleTabTextActive : styles.roleTabTextInactive}>
                Field Seller
              </Text>
            </Pressable>
          </View>

          {feedback && (
            <View style={{ marginBottom: Spacing.md }}>
              <FeedbackBanner
                type={feedback.type}
                message={feedback.message}
                onDismiss={() => setFeedback(null)}
              />
            </View>
          )}

          {/* ======================================================= */}
          {/* MANAGER ONBOARDING SECTIONS                             */}
          {/* ======================================================= */}
          {isMgr ? (
            <>
              {/* SECTION 1: Manager credentials & territory */}
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionTitle}>Manager credentials & territory</Text>
                <Text style={styles.sectionSubtitle}>
                  Add and provision regional depot manager accounts
                </Text>
              </View>

              <Card style={styles.card}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Manager name <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="Enter full name"
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      if (errors.name) setErrors((p) => ({ ...p, name: '' }));
                    }}
                    error={errors.name}
                    leftIcon={<Ionicons name="person-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Employee code</Text>
                  <Input
                    placeholder="e.g. MGR-001"
                    value={employeeCode}
                    onChangeText={setEmployeeCode}
                    leftIcon={<Ionicons name="card-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Contact number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t);
                      if (errors.phone) setErrors((p) => ({ ...p, phone: '' }));
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={errors.phone}
                    leftIcon={<Text style={styles.phonePrefix}>+91</Text>}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Login email</Text>
                  <Input
                    placeholder="Enter manager email address"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errors.email) setErrors((p) => ({ ...p, email: '' }));
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email}
                    leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Initial password <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="At least 12 characters"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errors.password) setErrors((p) => ({ ...p, password: '' }));
                    }}
                    secureTextEntry={!showPassword}
                    error={errors.password}
                    leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />}
                    rightIcon={
                      <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={HitSlop.md}>
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#64748B"
                        />
                      </Pressable>
                    }
                    helperText="At least 12 characters (FemmeFlo@2026 default)"
                  />
                </View>

                <View style={styles.rowGrid}>
                  <View style={[styles.fieldCol, { marginRight: Spacing.sm }]}>
                    <Text style={styles.fieldLabel}>
                      State <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Input
                      placeholder="Maharashtra"
                      value={state}
                      onChangeText={(t) => {
                        setState(t);
                        if (errors.state) setErrors((p) => ({ ...p, state: '' }));
                      }}
                      error={errors.state}
                      leftIcon={<Ionicons name="map-outline" size={18} color="#94A3B8" />}
                    />
                  </View>

                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>
                      District <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Input
                      placeholder="Thane"
                      value={district}
                      onChangeText={(t) => {
                        setDistrict(t);
                        if (errors.district) setErrors((p) => ({ ...p, district: '' }));
                      }}
                      error={errors.district}
                      leftIcon={<Ionicons name="business-outline" size={18} color="#94A3B8" />}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Town / headquarters</Text>
                  <Input
                    placeholder="Thane City"
                    value={town}
                    onChangeText={setTown}
                    leftIcon={<Ionicons name="location-outline" size={18} color="#94A3B8" />}
                  />
                </View>
              </Card>

              {/* SECTION 2: Official Verification & Documents */}
              <View style={styles.sectionHeaderBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.sectionTitle}>Official Verification & Documents</Text>
                  <View style={styles.mandatoryBadge}>
                    <Text style={styles.mandatoryBadgeText}>(Mandatory)</Text>
                  </View>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Government identification required for manager supervisory credentials.
                </Text>
              </View>

              <Card style={styles.card}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Aadhaar Card Number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="XXXX XXXX XXXX"
                    value={aadhaarNumber}
                    onChangeText={handleAadhaarChange}
                    keyboardType="numeric"
                    maxLength={14}
                    error={errors.aadhaarNumber}
                    leftIcon={<Ionicons name="finger-print-outline" size={18} color="#94A3B8" />}
                    helperText="12-digit UIDAI number"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Driving License Number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="e.g. MH14 20210001234"
                    value={drivingLicenseNumber}
                    onChangeText={(t) => {
                      setDrivingLicenseNumber(t);
                      if (errors.drivingLicenseNumber) setErrors((p) => ({ ...p, drivingLicenseNumber: '' }));
                    }}
                    autoCapitalize="characters"
                    error={errors.drivingLicenseNumber}
                    leftIcon={<Ionicons name="car-outline" size={18} color="#94A3B8" />}
                    helperText="Valid Indian Driving License"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Educational Qualification</Text>
                  <Pressable
                    style={styles.dropdownSelectorBox}
                    onPress={() => setIsQualDropdownOpen((p) => !p)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="school-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                      <Text style={styles.dropdownValueText}>{qualification}</Text>
                    </View>
                    <Ionicons
                      name={isQualDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#64748B"
                    />
                  </Pressable>

                  {isQualDropdownOpen && (
                    <View style={styles.dropdownOptionsContainer}>
                      {MANAGER_QUALIFICATION_OPTIONS.map((opt) => {
                        const isSelected = qualification === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[styles.dropdownOptionRow, isSelected && styles.dropdownOptionRowSelected]}
                            onPress={() => {
                              setQualification(opt);
                              setIsQualDropdownOpen(false);
                            }}
                          >
                            <Ionicons
                              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                              size={16}
                              color={isSelected ? BrandColors.green.primary : '#94A3B8'}
                              style={{ marginRight: 8 }}
                            />
                            <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Alternate contact number (Optional)</Text>
                  <Input
                    placeholder="Second mobile number"
                    value={alternatePhone}
                    onChangeText={(t) => {
                      setAlternatePhone(t);
                      if (errors.alternatePhone) setErrors((p) => ({ ...p, alternatePhone: '' }));
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={errors.alternatePhone}
                    leftIcon={<Ionicons name="call-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Residential / Office Address</Text>
                  <Input
                    placeholder="Plot / Street / Building address"
                    value={address}
                    onChangeText={setAddress}
                    leftIcon={<Ionicons name="home-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PIN Code</Text>
                  <Input
                    placeholder="6-digit PIN"
                    value={pincode}
                    onChangeText={handlePincodeChange}
                    keyboardType="numeric"
                    maxLength={6}
                    error={errors.pincode}
                    leftIcon={<Ionicons name="mail-open-outline" size={18} color="#94A3B8" />}
                    rightIcon={
                      pincodeLoading ? (
                        <ActivityIndicator size="small" color={BrandColors.green.primary} />
                      ) : null
                    }
                  />
                </View>
              </Card>

              {/* SECTION 3: Seller Capability */}
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionTitle}>Seller Capability</Text>
              </View>

              <Card style={styles.card}>
                <View style={styles.sellerCapabilityBox}>
                  <View style={styles.capabilityTopRow}>
                    <View style={styles.capabilityIconCircle}>
                      <Ionicons name="bag-handle" size={22} color={BrandColors.green.primary} />
                    </View>
                    <View style={{ flex: 1, marginRight: Spacing.sm }}>
                      <Text style={styles.capabilityTitle}>
                        Same as Seller (Manager also acts as Field Seller)
                      </Text>
                      {isSeller && (
                        <Badge label="DUAL ROLE ACTIVE" variant="ACTIVE" size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                      )}
                    </View>
                    <Switch
                      value={isSeller}
                      onValueChange={setIsSeller}
                      trackColor={{ false: '#CBD5E1', true: BrandColors.green.light }}
                      thumbColor={isSeller ? BrandColors.green.primary : '#FFFFFF'}
                    />
                  </View>
                  <Text style={styles.capabilityDescription}>
                    Enable this if this manager will also directly perform field sales and customer onboarding. They can log in to both the Manager Portal and Seller Portal with the same ID &amp; password and will receive their own field stock balance.
                  </Text>
                </View>
              </Card>

              {/* SECTION 4: Initial operational permissions */}
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionTitle}>Initial operational permissions</Text>
                <Text style={styles.sectionSubtitle}>
                  Configure supervisory access rights for regional territory management
                </Text>
              </View>

              <Card style={styles.card}>
                {DEFAULT_MANAGER_PERMISSIONS.map((perm, idx) => {
                  const isChecked = managerPermissions.includes(perm.id);
                  return (
                    <Pressable
                      key={perm.id}
                      style={[
                        styles.permissionItemRow,
                        idx < DEFAULT_MANAGER_PERMISSIONS.length - 1 && styles.permissionBorderBottom,
                      ]}
                      onPress={() => toggleManagerPermission(perm.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isChecked ? BrandColors.green.primary : '#94A3B8'}
                        style={{ marginRight: 12 }}
                      />
                      <Text style={[styles.permissionLabel, isChecked && styles.permissionLabelActive]}>
                        {perm.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </Card>
            </>
          ) : (
            <>
              {/* ======================================================= */}
              {/* SELLER ONBOARDING SECTIONS (4-SECTION OFFICIAL LAYOUT) */}
              {/* ======================================================= */}

              {/* 1. Employee Identity & Role Assignment */}
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionTitle}>1. Employee Identity &amp; Role Assignment</Text>
                <Text style={styles.sectionSubtitle}>
                  Official officer identification, designation, status, and reporting manager
                </Text>
              </View>

              <Card style={styles.card}>
                {/* Employee Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Employee Name <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="e.g. Rahul Patil"
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      if (errors.name) setErrors((p) => ({ ...p, name: '' }));
                    }}
                    error={errors.name}
                    leftIcon={<Ionicons name="person-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                {/* Designation */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Designation <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="Field Sales Officer"
                    value={designation}
                    onChangeText={(t) => {
                      setDesignation(t);
                      if (errors.designation) setErrors((p) => ({ ...p, designation: '' }));
                    }}
                    error={errors.designation}
                    leftIcon={<Ionicons name="ribbon-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                {/* Employee Code */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Employee Code</Text>
                  <Input
                    placeholder="e.g. FF-FO-001"
                    value={employeeCode}
                    onChangeText={setEmployeeCode}
                    leftIcon={<Ionicons name="card-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                {/* Employment Status */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Employment Status</Text>
                  <View style={styles.statusToggleRow}>
                    <Pressable
                      style={[styles.statusOptionPill, isActive && styles.statusOptionPillActive]}
                      onPress={() => setIsActive(true)}
                    >
                      <Ionicons
                        name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={isActive ? BrandColors.green.primary : '#64748B'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.statusOptionText, isActive && styles.statusOptionTextActive]}>
                        Active (Authorized)
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.statusOptionPill, !isActive && styles.statusOptionPillInactive]}
                      onPress={() => setIsActive(false)}
                    >
                      <Ionicons
                        name={!isActive ? 'close-circle' : 'ellipse-outline'}
                        size={16}
                        color={!isActive ? '#DC2626' : '#64748B'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.statusOptionText, !isActive && styles.statusOptionTextInactive]}>
                        Inactive (Suspended)
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Assigned Reporting Manager */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelWithSubRow}>
                    <Text style={styles.fieldLabel}>
                      Assigned Reporting Manager <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Text style={styles.managerCountText}>{managers.length} available managers</Text>
                  </View>

                  <DropdownTrigger
                    label=""
                    required
                    value={selectedManager?.name}
                    subtitle={
                      selectedManager
                        ? `${selectedManager.name} (${selectedManager.territory || selectedManager.district || 'Territory'}) · ${selectedManager.phone || '+91 98765 00000'}`
                        : loadingManagers
                        ? 'Loading active managers...'
                        : 'Tap to select supervising manager...'
                    }
                    placeholder="Select assigned reporting manager..."
                    icon="people"
                    badge={selectedManager ? 'REPORTING MANAGER' : undefined}
                    onPress={() => {
                      setManagerSearchQuery('');
                      setIsManagerPickerOpen(true);
                    }}
                    error={errors.managerId}
                  />

                  {isManagerPickerOpen && (
                    <View style={styles.pickerContainer}>
                      <View style={styles.pickerHeaderRow}>
                        <Text style={styles.pickerHeaderTitle}>Select Reporting Manager</Text>
                        <Pressable
                          onPress={() => setIsManagerPickerOpen(false)}
                          hitSlop={HitSlop.md}
                        >
                          <Ionicons name="close-circle" size={22} color="#64748B" />
                        </Pressable>
                      </View>

                      <Input
                        placeholder="Search by manager name, territory, phone..."
                        value={managerSearchQuery}
                        onChangeText={setManagerSearchQuery}
                        leftIcon={<Ionicons name="search" size={16} color="#64748B" />}
                        containerStyle={{ marginBottom: Spacing.xs }}
                      />

                      <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                        {filteredManagers.map((m) => {
                          const isChosen = selectedManagerId === m.id;
                          return (
                            <Pressable
                              key={m.id}
                              style={[styles.managerOptionRow, isChosen && styles.managerOptionRowSelected]}
                              onPress={() => handleSelectManager(m)}
                            >
                              <Ionicons
                                name={isChosen ? 'radio-button-on' : 'radio-button-off'}
                                size={18}
                                color={isChosen ? '#9F2545' : '#94A3B8'}
                                style={{ marginRight: 10 }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.managerOptionName, isChosen && { color: '#9F2545', fontWeight: '700' }]}>
                                  {m.name}
                                </Text>
                                <Text style={styles.managerOptionSub}>
                                  ({m.territory || m.district || 'Territory'}) · {m.phone || '+91 98765 00000'}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </Card>

              {/* 2. Contact Numbers & Login Credentials */}
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionTitle}>2. Contact Numbers &amp; Login Credentials</Text>
                <Text style={styles.sectionSubtitle}>
                  Primary mobile number, distinct alternate phone, optional email, and login credentials
                </Text>
              </View>

              <Card style={styles.card}>
                {/* Phone Number 1 */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Phone Number 1 (Primary Contact) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="10-digit mobile number (e.g. 9876543210)"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t);
                      if (errors.phone) setErrors((p) => ({ ...p, phone: '' }));
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={errors.phone}
                    leftIcon={<Text style={styles.phonePrefix}>+91</Text>}
                    helperText="Primary number used for authentication and SMS notifications"
                  />
                </View>

                {/* Phone Number 2 */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Phone Number 2 / Alternate Phone (No duplication)
                  </Text>
                  <Input
                    placeholder="Alternate 10-digit mobile number"
                    value={alternatePhone}
                    onChangeText={(t) => {
                      setAlternatePhone(t);
                      if (errors.alternatePhone) setErrors((p) => ({ ...p, alternatePhone: '' }));
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={errors.alternatePhone}
                    leftIcon={<Text style={styles.phonePrefix}>+91</Text>}
                    helperText="Must be different from Phone Number 1"
                  />
                </View>

                {/* Email ID */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email ID (Optional)</Text>
                  <Input
                    placeholder="officer@femmeflo.in"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errors.email) setErrors((p) => ({ ...p, email: '' }));
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email}
                    leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                {/* Initial Account Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Initial Account Password <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errors.password) setErrors((p) => ({ ...p, password: '' }));
                    }}
                    secureTextEntry={!showPassword}
                    error={errors.password}
                    leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />}
                    rightIcon={
                      <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={HitSlop.md}>
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#64748B"
                        />
                      </Pressable>
                    }
                    helperText="Temporary password used by officer to log in"
                  />
                </View>
              </Card>

              {/* 3. Identification Documents & Qualification */}
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionTitle}>3. Identification Documents &amp; Qualification</Text>
                <Text style={styles.sectionSubtitle}>
                  Government identification documents and educational background
                </Text>
              </View>

              <Card style={styles.card}>
                {/* Aadhaar Card Number */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Aadhaar Card Number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="XXXX XXXX XXXX"
                    value={aadhaarNumber}
                    onChangeText={handleAadhaarChange}
                    keyboardType="numeric"
                    maxLength={14}
                    error={errors.aadhaarNumber}
                    leftIcon={<Ionicons name="finger-print-outline" size={18} color="#94A3B8" />}
                    helperText="Mandatory: 12-digit Indian Aadhaar number"
                  />
                </View>

                {/* Driving License Number */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Driving License Number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="e.g. MH14 20210001234"
                    value={drivingLicenseNumber}
                    onChangeText={(t) => {
                      setDrivingLicenseNumber(t);
                      if (errors.drivingLicenseNumber) setErrors((p) => ({ ...p, drivingLicenseNumber: '' }));
                    }}
                    autoCapitalize="characters"
                    error={errors.drivingLicenseNumber}
                    leftIcon={<Ionicons name="car-outline" size={18} color="#94A3B8" />}
                    helperText="Mandatory: Valid Indian Driving License for field travel"
                  />
                </View>

                {/* Educational Qualification */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Educational Qualification</Text>
                  <Pressable
                    style={styles.dropdownSelectorBox}
                    onPress={() => setIsQualDropdownOpen((p) => !p)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="school-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                      <Text style={styles.dropdownValueText}>{qualification}</Text>
                    </View>
                    <Ionicons
                      name={isQualDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#64748B"
                    />
                  </Pressable>

                  {isQualDropdownOpen && (
                    <View style={styles.dropdownOptionsContainer}>
                      {activeQualOptions.map((opt) => {
                        const isSelected = qualification === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[styles.dropdownOptionRow, isSelected && styles.dropdownOptionRowSelected]}
                            onPress={() => {
                              setQualification(opt);
                              setIsQualDropdownOpen(false);
                            }}
                          >
                            <Ionicons
                              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                              size={16}
                              color={isSelected ? '#9F2545' : '#94A3B8'}
                              style={{ marginRight: 8 }}
                            />
                            <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <Text style={styles.inputHelperSub}>Officer background</Text>
                </View>
              </Card>

              {/* 4. Complete Address & Territory */}
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionTitle}>4. Complete Address &amp; Territory</Text>
                <Text style={styles.sectionSubtitle}>
                  Residential address with PIN code lookup for territory jurisdiction
                </Text>
              </View>

              <Card style={styles.card}>
                {/* PIN Code */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    PIN Code <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="6-digit PIN"
                    value={pincode}
                    onChangeText={handlePincodeChange}
                    keyboardType="numeric"
                    maxLength={6}
                    error={errors.pincode}
                    leftIcon={<Ionicons name="mail-open-outline" size={18} color="#94A3B8" />}
                    rightIcon={
                      pincodeLoading ? (
                        <ActivityIndicator size="small" color="#9F2545" />
                      ) : pincode.length === 6 ? (
                        <Ionicons name="checkmark-circle" size={18} color={BrandColors.green.primary} />
                      ) : null
                    }
                  />
                </View>

                {/* Complete Address */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Complete Address / Street Name / House / Building</Text>
                  <Input
                    placeholder="House no., Building name, Street, Landmark"
                    value={address}
                    onChangeText={setAddress}
                    leftIcon={<Ionicons name="home-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                {/* Village / Town / Locality */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Village / Town / Locality <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Input
                    placeholder="e.g. Diva / Panvel"
                    value={village}
                    onChangeText={(t) => {
                      setVillage(t);
                      if (errors.village) setErrors((p) => ({ ...p, village: '' }));
                    }}
                    error={errors.village}
                    leftIcon={<Ionicons name="location-outline" size={18} color="#94A3B8" />}
                  />
                </View>

                {/* District & State Grid */}
                <View style={styles.rowGrid}>
                  <View style={[styles.fieldCol, { marginRight: Spacing.sm }]}>
                    <Text style={styles.fieldLabel}>
                      District <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Input
                      placeholder="e.g. Thane"
                      value={district}
                      onChangeText={(t) => {
                        setDistrict(t);
                        if (errors.district) setErrors((p) => ({ ...p, district: '' }));
                      }}
                      error={errors.district}
                      leftIcon={<Ionicons name="business-outline" size={18} color="#94A3B8" />}
                    />
                  </View>

                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>
                      State <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Input
                      placeholder="e.g. Maharashtra"
                      value={state}
                      onChangeText={(t) => {
                        setState(t);
                        if (errors.state) setErrors((p) => ({ ...p, state: '' }));
                      }}
                      error={errors.state}
                      leftIcon={<Ionicons name="map-outline" size={18} color="#94A3B8" />}
                    />
                  </View>
                </View>
              </Card>
            </>
          )}

          {/* SUBMIT BUTTON */}
          <View style={styles.submitSection}>
            <Button
              title={isMgr ? 'Save manager' : 'Save seller'}
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={{ backgroundColor: roleThemeColor }}
              icon={<Ionicons name="checkmark-done" size={20} color="#FFFFFF" />}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl * 3,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Breadcrumbs
  breadcrumbBar: {
    marginBottom: Spacing.md,
  },
  breadcrumbWorkspace: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  breadcrumbDivider: {
    marginHorizontal: 8,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  breadcrumbCurrent: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },

  // Role Switcher Tabs
  roleTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
  },
  roleTabActiveManager: {
    backgroundColor: BrandColors.green.primary,
    ...Shadows.sm,
  },
  roleTabActiveSeller: {
    backgroundColor: '#9F2545',
    ...Shadows.sm,
  },
  roleTabTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleTabTextInactive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // Headings
  sectionHeading: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionHeaderBox: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  mandatoryBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    marginLeft: 8,
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
  },

  // Cards & Fields
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderColor: '#E2E8F0',
  },
  fieldGroup: {
    marginBottom: Spacing.sm + 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  labelWithSubRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  managerCountText: {
    fontSize: 11,
    color: '#9F2545',
    fontWeight: '700',
  },
  requiredStar: {
    color: '#E61C5D',
    fontWeight: '800',
  },
  phonePrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginRight: 4,
  },
  rowGrid: {
    flexDirection: 'row',
  },
  fieldCol: {
    flex: 1,
  },
  inputHelperSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },

  // Employment Status Toggle
  statusToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusOptionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  statusOptionPillActive: {
    borderColor: BrandColors.green.light,
    backgroundColor: BrandColors.green.surface,
  },
  statusOptionPillInactive: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusOptionTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
  statusOptionTextInactive: {
    color: '#B91C1C',
    fontWeight: '700',
  },

  // Dropdown Selector
  dropdownSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  dropdownValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownOptionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    marginTop: 6,
    ...Shadows.sm,
    overflow: 'hidden',
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownOptionRowSelected: {
    backgroundColor: '#FFF1F5',
  },
  dropdownOptionText: {
    fontSize: 12,
    color: '#334155',
  },
  dropdownOptionTextSelected: {
    color: '#9F2545',
    fontWeight: '700',
  },

  // Seller Capability
  sellerCapabilityBox: {
    padding: 2,
  },
  capabilityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  capabilityIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BrandColors.green.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  capabilityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  capabilityDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginTop: 4,
  },

  // Permissions
  permissionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  permissionBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  permissionLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  permissionLabelActive: {
    color: '#0F172A',
    fontWeight: '700',
  },

  // Manager Picker Subview
  pickerContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  pickerHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  managerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  managerOptionRowSelected: {
    backgroundColor: '#FFF1F5',
  },
  managerOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  managerOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  // Submit Section
  submitSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
});
