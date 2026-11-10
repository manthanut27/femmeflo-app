import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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
import { sanitizeBackendPermissions } from '@/utils/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import {
  BorderRadius,
  BrandColors,
  Colors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';

const QUALIFICATION_OPTIONS = [
  'Graduate (B.A. / B.Com / B.Sc / BBA)',
  'Post Graduate (M.A. / M.Com / M.Sc / MBA)',
  'Diploma / Polytech',
  'Higher Secondary (12th Pass)',
  'Secondary (10th Pass)',
  'Other Qualification',
];

const DEFAULT_PERMISSIONS = [
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

export default function AdminOnboardManagerScreen() {
  const router = useRouter();

  // Section 1: Manager credentials & territory
  const [name, setName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Thane');
  const [town, setTown] = useState('Thane City');

  // Section 2: Official Verification & Documents (Mandatory)
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [qualification, setQualification] = useState('Graduate (B.A. / B.Com / B.Sc / BBA)');
  const [customQualification, setCustomQualification] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [isQualDropdownOpen, setIsQualDropdownOpen] = useState(false);

  // Section 3: Seller Capability
  const [isSeller, setIsSeller] = useState(false);

  // Section 4: Initial operational permissions
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'view_sellers',
    'onboard_sellers',
    'view_customers',
    'onboard_customers',
    'monitor_stock',
  ]);

  // Submission & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  function togglePermission(permId: string) {
    setSelectedPermissions((prev) =>
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

  function validate() {
    const errs: Record<string, string> = {};

    // 1. Credentials & Territory
    if (!name.trim()) errs.name = 'Manager name is required.';

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errs.phone = 'Valid 10-digit mobile contact number is required.';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please provide a valid login email address.';
    }

    const trimmedPassword = password.trim();
    if (!trimmedPassword || trimmedPassword.length < 12) {
      errs.password = 'Initial password must be at least 12 characters.';
    }

    if (!state.trim()) errs.state = 'State is required.';
    if (!district.trim()) errs.district = 'District is required.';

    // 2. Official Verification & Documents
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
    if (!cleanAadhaar || cleanAadhaar.length !== 12) {
      errs.aadhaarNumber = '12-digit UIDAI Aadhaar card number is required.';
    }

    if (!drivingLicenseNumber.trim()) {
      errs.drivingLicenseNumber = 'Valid Indian Driving License number is required.';
    }

    if (alternatePhone.trim()) {
      const cleanAlt = alternatePhone.replace(/\D/g, '');
      if (cleanAlt.length < 10) {
        errs.alternatePhone = 'Alternate phone must be at least 10 digits.';
      }
    }

    if (pincode.trim()) {
      const cleanPin = pincode.replace(/\D/g, '');
      if (cleanPin.length !== 6) {
        errs.pincode = 'PIN code must be a 6-digit number.';
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setFeedback({ type: 'error', message: 'Please correct the highlighted mandatory fields.' });
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

    const resolvedQualification =
      qualification === 'Other Qualification'
        ? (customQualification.trim() || undefined)
        : (qualification.trim() || undefined);

    try {
      const res = await adminApi.createManager({
        name: name.trim(),
        employeeCode: employeeCode.trim() || undefined,
        phone: formattedPhone,
        email: email.trim() || undefined,
        password: password.trim(),
        state: state.trim(),
        district: district.trim(),
        village: town.trim() || undefined,
        aadhaarNumber: aadhaarNumber.replace(/\s+/g, '').trim(),
        drivingLicenseNumber: drivingLicenseNumber.trim(),
        qualification: resolvedQualification,
        alternatePhone: cleanAltPhone,
        address: address.trim() || undefined,
        pincode: pincode.trim() || undefined,
        isSeller,
        permissions: sanitizeBackendPermissions(selectedPermissions),
      });

      setFeedback({
        type: 'success',
        message: `Manager ${res.manager.name} added!`,
      });

      Alert.alert(
        'Manager Added',
        `Manager ${res.manager.name} has been added for ${district.trim()}, ${state.trim()}.${
          isSeller ? ' Can also take orders.' : ''
        }`,
        [
          {
            text: 'Add Another',
            onPress: () => {
              setName('');
              setEmployeeCode('');
              setPhone('');
              setEmail('');
              setPassword('');
              setAadhaarNumber('');
              setDrivingLicenseNumber('');
              setQualification('Graduate (B.A. / B.Com / B.Sc / BBA)');
              setCustomQualification('');
              setAlternatePhone('');
              setAddress('');
              setPincode('');
              setIsSeller(false);
              setFeedback(null);
            },
          },
          {
            text: 'View Managers',
            onPress: () => router.replace('/(admin)/users' as any),
          },
        ]
      );
    } catch (err: any) {
      const msg = err.message || 'Failed to add manager.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Save Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Add Territory Manager"
        subtitle="Create Manager Account"
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
            <Text style={styles.breadcrumbWorkspace}>Admin workspace / Users / Managers</Text>
            <View style={styles.breadcrumbRow}>
              <Pressable
                style={styles.breadcrumbLink}
                onPress={() => router.replace('/(admin)/users' as any)}
              >
                <Ionicons name="arrow-back" size={13} color={BrandColors.green.primary} style={{ marginRight: 4 }} />
                <Text style={styles.breadcrumbLinkText}>Back to users</Text>
              </Pressable>
              <Text style={styles.breadcrumbDivider}>•</Text>
              <Text style={styles.breadcrumbCurrent}>Add manager</Text>
            </View>
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

          {/* SECTION 1: Manager credentials & territory */}
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionTitle}>Manager credentials & territory</Text>
            <Text style={styles.sectionSubtitle}>
              Add and provision regional depot manager accounts
            </Text>
          </View>

          <Card style={styles.card}>
            {/* Manager name */}
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

            {/* Employee code */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Employee code</Text>
              <Input
                placeholder="e.g. MGR-001"
                value={employeeCode}
                onChangeText={setEmployeeCode}
                leftIcon={<Ionicons name="card-outline" size={18} color="#94A3B8" />}
              />
            </View>

            {/* Contact number */}
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

            {/* Login email */}
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

            {/* Initial password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Initial password <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Input
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
                helperText="At least 12 characters"
              />
            </View>

            {/* State & District Grid */}
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

            {/* Town / headquarters */}
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
                helperText="12-digit UIDAI number"
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
                helperText="Valid Indian Driving License"
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
                  {QUALIFICATION_OPTIONS.map((opt) => {
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

              {qualification === 'Other Qualification' && (
                <View style={{ marginTop: Spacing.xs }}>
                  <Input
                    placeholder="Enter other qualification (e.g. B.Tech, LLB, Ph.D, B.Ed)"
                    value={customQualification}
                    onChangeText={setCustomQualification}
                    leftIcon={<Ionicons name="school-outline" size={16} color="#94A3B8" />}
                  />
                </View>
              )}
            </View>

            {/* Alternate contact number */}
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

            {/* Residential / Office Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Residential / Office Address</Text>
              <Input
                placeholder="Plot / Street / Building address"
                value={address}
                onChangeText={setAddress}
                leftIcon={<Ionicons name="home-outline" size={18} color="#94A3B8" />}
              />
            </View>

            {/* PIN Code */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PIN Code</Text>
              <Input
                placeholder="6-digit PIN"
                value={pincode}
                onChangeText={(t) => {
                  setPincode(t);
                  if (errors.pincode) setErrors((p) => ({ ...p, pincode: '' }));
                }}
                keyboardType="numeric"
                maxLength={6}
                error={errors.pincode}
                leftIcon={<Ionicons name="mail-open-outline" size={18} color="#94A3B8" />}
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
                    Manager Can Also Sell (Field Orders)
                  </Text>
                  {isSeller && (
                    <Badge label="CAN ALSO SELL" variant="ACTIVE" size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
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
                Enable this if this manager will also take customer orders and visit shops. They can use both Manager and Seller screens with the same login, and have their own stock in their van.
              </Text>
            </View>
          </Card>

          {/* SECTION 4: Manager Permissions */}
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionTitle}>Manager Permissions</Text>
            <Text style={styles.sectionSubtitle}>
              Choose what this manager can see and approve
            </Text>
          </View>

          <Card style={styles.card}>
            {DEFAULT_PERMISSIONS.map((perm, idx) => {
              const isChecked = selectedPermissions.includes(perm.id);
              return (
                <Pressable
                  key={perm.id}
                  style={[
                    styles.permissionItemRow,
                    idx < DEFAULT_PERMISSIONS.length - 1 && styles.permissionBorderBottom,
                  ]}
                  onPress={() => togglePermission(perm.id)}
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

          {/* SECTION 5: Save Manager Action */}
          <View style={styles.submitSection}>
            <Button
              title="Save manager"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={{ backgroundColor: BrandColors.green.primary }}
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
    color: BrandColors.green.primary,
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

  // Section Headers
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
    backgroundColor: '#F0FDF4',
  },
  dropdownOptionText: {
    fontSize: 12,
    color: '#334155',
  },
  dropdownOptionTextSelected: {
    color: BrandColors.green.primary,
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

  // Submit Section
  submitSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
});
