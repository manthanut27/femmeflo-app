import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { managerApi } from '@/api/manager';
import { sellerApi } from '@/api/seller';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { useAuth } from '@/context/AuthContext';
import { canOnboardSellers } from '@/utils/permissions';

const QUALIFICATION_OPTIONS = [
  '12th Standard / HSC / Intermediate',
  'Graduate (B.A. / B.Com / B.Sc / BBA)',
  '10th Standard / SSC / Matriculation',
  'Diploma / ITI',
  'Post Graduate (M.A. / M.Com / M.Sc / MBA)',
  'Other Qualification',
];

function formatAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export default function ManagerOnboardSellerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Section 1: Employee Identity & Role Assignment
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Field Sales Officer');
  const [employeeCode, setEmployeeCode] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Section 2: Contact Numbers & Login Credentials
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Section 3: Identification Documents & Qualification
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [qualification, setQualification] = useState('12th Standard / HSC / Intermediate');
  const [customQualification, setCustomQualification] = useState('');
  const [isQualDropdownOpen, setIsQualDropdownOpen] = useState(false);

  // Section 4: Complete Address & Territory
  const [pincode, setPincode] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState(user?.village || 'Diva');
  const [district, setDistrict] = useState(user?.district || 'Thane');
  const [state, setState] = useState(user?.state || 'Maharashtra');

  // Form handling & feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

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
        if (lookup.village) setVillage(lookup.village);
      } catch {
        // Fallback
      } finally {
        setPincodeLoading(false);
      }
    }
  }

  function validate() {
    const errs: Record<string, string> = {};

    // 1. Identity & Role
    if (!name.trim()) errs.name = 'Employee name is required.';
    if (!designation.trim()) errs.designation = 'Designation is required.';

    // 2. Contact & Login
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
      errs.email = 'Please provide a valid operational email.';
    }

    const trimmedPassword = password.trim();
    if (!trimmedPassword || trimmedPassword.length < 8) {
      errs.password = 'Initial password must be at least 8 characters.';
    }

    // 3. Identification & Qualification
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
    if (!cleanAadhaar || cleanAadhaar.length !== 12) {
      errs.aadhaarNumber = '12-digit Indian Aadhaar number is mandatory.';
    }

    if (!drivingLicenseNumber.trim()) {
      errs.drivingLicenseNumber = 'Valid Indian Driving License number is mandatory.';
    }

    if (qualification === 'Other Qualification' && !customQualification.trim()) {
      errs.customQualification = 'Please specify the custom qualification.';
    }

    // 4. Address & Territory
    if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Valid 6-digit PIN code is required.';
    }

    if (!village.trim()) errs.village = 'Village / Town / Locality is required.';
    if (!district.trim()) errs.district = 'District is required.';
    if (!state.trim()) errs.state = 'State is required.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setFeedback({ type: 'error', message: 'Please fix all highlighted fields before saving.' });
    }
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!canOnboardSellers(user)) {
      Alert.alert('Access Denied', 'You do not have permission to onboard new field officers.');
      return;
    }
    setFeedback(null);
    if (!validate()) return;

    setIsSubmitting(true);
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const formattedPhone = `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;
    const cleanAlt = alternatePhone.trim() ? `+91 ${alternatePhone.replace(/\D/g, '').slice(-10)}` : undefined;

    const resolvedQualification =
      qualification === 'Other Qualification'
        ? (customQualification.trim() || undefined)
        : (qualification.trim() || undefined);

    try {
      const res = await managerApi.createSeller({
        name: name.trim(),
        designation: designation.trim(),
        employeeCode: employeeCode.trim() || undefined,
        active: isActive,
        phone: formattedPhone,
        alternatePhone: cleanAlt,
        email: email.trim() || undefined,
        password: password.trim(),
        aadhaarNumber: aadhaarNumber.replace(/\s+/g, '').trim(),
        drivingLicenseNumber: drivingLicenseNumber.trim(),
        qualification: resolvedQualification,
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
        `${res.seller.name} has been enrolled as ${designation.trim()} assigned to ${village.trim()}, ${district.trim()} reporting to your team.`,
        [
          {
            text: 'Onboard Another',
            onPress: () => {
              setName('');
              setEmployeeCode('');
              setPhone('');
              setAlternatePhone('');
              setEmail('');
              setPassword('');
              setAadhaarNumber('');
              setDrivingLicenseNumber('');
              setQualification('12th Standard / HSC / Intermediate');
              setCustomQualification('');
              setAddress('');
              setPincode('');
              setFeedback(null);
            },
          },
          {
            text: 'View Field Force',
            onPress: () => router.replace('/(manager)/sellers' as any),
          },
        ]
      );
    } catch (err: any) {
      const msg = err.message || 'Failed to onboard field officer.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Onboarding Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canOnboardSellers(user)) {
    return (
      <View style={styles.container}>
        <Header title="Officer information" subtitle="Onboard field officer" showBack />
        <View style={styles.restrictedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="Access Restricted"
            description="You do not have permission to onboard new field officers. Please contact your administrator to request 'Onboard new field officers' permission."
            iconColor={Colors.light.danger}
            iconBgColor={Colors.light.dangerBg}
            actionTitle="Back to Field Force"
            buttonVariant="secondary"
            onAction={() => router.replace('/(manager)/sellers' as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Officer information"
        subtitle="Complete the required fields to save this record to the database"
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
            <Text style={styles.breadcrumbWorkspace}>Manager workspace / Field Force</Text>
            <View style={styles.breadcrumbRow}>
              <Pressable
                style={styles.breadcrumbLink}
                onPress={() => router.replace('/(manager)/sellers' as any)}
              >
                <Ionicons name="arrow-back" size={13} color={BrandColors.green.primary} style={{ marginRight: 4 }} />
                <Text style={styles.breadcrumbLinkText}>Back to field force</Text>
              </Pressable>
              <Text style={styles.breadcrumbDivider}>•</Text>
              <Text style={styles.breadcrumbCurrent}>Officer onboarding</Text>
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
              <Text style={styles.fieldLabel}>
                Assigned Reporting Manager <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.reportingManagerCard}>
                <View style={styles.managerIconBadge}>
                  <Ionicons name="shield-checkmark" size={18} color={BrandColors.green.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportingManagerName}>{user?.name || 'Territory Manager'}</Text>
                  <Text style={styles.reportingManagerDetails}>
                    ({user?.district || user?.state || 'Your Supervised Territory'}) · {user?.phone || user?.email || 'Direct Supervisor'}
                  </Text>
                </View>
                <Badge label="YOU" variant="ACTIVE" size="sm" />
              </View>
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
              <Text style={styles.inputHelperSub}>Officer background</Text>

              {qualification === 'Other Qualification' && (
                <View style={{ marginTop: Spacing.xs }}>
                  <Input
                    placeholder="Enter other qualification (e.g. B.Tech, LLB, Ph.D, B.Ed)"
                    value={customQualification}
                    onChangeText={(val) => {
                      setCustomQualification(val);
                      if (errors.customQualification) setErrors((p) => ({ ...p, customQualification: '' }));
                    }}
                    error={errors.customQualification}
                    leftIcon={<Ionicons name="school-outline" size={16} color="#94A3B8" />}
                  />
                </View>
              )}
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
                    <ActivityIndicator size="small" color={BrandColors.green.primary} />
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

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Button
              title="Save seller"
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

  // Reporting Manager Card
  reportingManagerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  managerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.green.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  reportingManagerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  reportingManagerDetails: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
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

  // Submit Section
  submitSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
