import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthRole, CategoryItem, CustomerItem } from '@/api/types';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { Button } from '@/components/ui/Button';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { SearchableDropdownModal, type DropdownOption } from '@/components/ui/SearchableDropdownModal';
import { BrandColors, Colors, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import type { GpsAcquisitionStatus } from '@/utils/locationUtils';
import { useResponsiveLayout } from '@/utils/responsive';

export const PHOTO_REASONS = [
  { label: 'Slow internet', icon: 'cellular-outline' as const },
  { label: 'Shopkeeper said no', icon: 'person-remove-outline' as const },
  { label: 'Shop closed / owner away', icon: 'storefront-outline' as const },
  { label: 'Camera not working', icon: 'camera-reverse-outline' as const },
  { label: 'Dark inside shop', icon: 'sunny-outline' as const },
];

export type PincodeLookupStatus = 'idle' | 'loading' | 'found' | 'not_found';

export interface CustomerOnboardingFormProps {
  role: Extract<AuthRole, 'MANAGER' | 'SELLER'>;
  onBack: () => void;
  onOpenBatchEntry: () => void;

  // GPS / Location
  gpsStatus: GpsAcquisitionStatus;
  onRefreshLocation: () => void;
  latitude: number | null;
  longitude: number | null;

  // Photo & Exemption
  photoUri: string | null;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  noPhotoReason: string;
  onSelectNoPhotoReason: (reason: string) => void;
  isReasonDropdownOpen: boolean;
  onToggleReasonDropdown: () => void;

  // Shop Details
  shopName: string;
  onChangeShopName: (v: string) => void;
  ownerName: string;
  onChangeOwnerName: (v: string) => void;
  phone: string;
  onChangePhone: (v: string) => void;
  email: string;
  onChangeEmail: (v: string) => void;

  // Manager / Seller Assignment
  selectedManagerName: string;
  selectedManagerSub?: string;
  canPickAssignee: boolean;
  managerLoading: boolean;
  isManagerModalOpen: boolean;
  onOpenManagerModal: () => void;
  onCloseManagerModal: () => void;
  managerDropdownOptions: DropdownOption[];
  selectedManagerId: string;
  onSelectManager: (opt: DropdownOption) => void;

  // Trade Category
  selectedCategory: CategoryItem | undefined;
  categoryLoading: boolean;
  isCategoryModalOpen: boolean;
  onOpenCategoryModal: () => void;
  onCloseCategoryModal: () => void;
  categoryDropdownOptions: DropdownOption[];
  categoryId: string;
  onSelectCategory: (opt: DropdownOption) => void;

  // Shop Address
  pincode: string;
  onChangePincode: (v: string) => void;
  pincodeStatus: PincodeLookupStatus;
  address: string;
  onChangeAddress: (v: string) => void;
  village: string;
  onChangeVillage: (v: string) => void;
  district: string;
  onChangeDistrict: (v: string) => void;
  stateName: string;
  onChangeStateName: (v: string) => void;
  formattedAddress: string;

  // Submission & Feedback
  errors: Record<string, string>;
  feedback: { type: FeedbackType; title?: string; message: string } | null;
  onDismissFeedback: () => void;
  isSubmitting: boolean;
  onSubmit: () => void;

  // Saved Success Screen
  savedCustomer: CustomerItem | null;
  onResetForm: () => void;
  onDoneAfterSave: () => void;
}

export function CustomerOnboardingForm(props: CustomerOnboardingFormProps) {
  const insets = useSafeAreaInsets();
  const { width } = useResponsiveLayout();
  const isCompactScreen = width < 380;

  const {
    role,
    onBack,
    onOpenBatchEntry,
    gpsStatus,
    onRefreshLocation,
    latitude,
    longitude,
    photoUri,
    onPickPhoto,
    onRemovePhoto,
    noPhotoReason,
    onSelectNoPhotoReason,
    isReasonDropdownOpen,
    onToggleReasonDropdown,
    shopName,
    onChangeShopName,
    ownerName,
    onChangeOwnerName,
    phone,
    onChangePhone,
    email,
    onChangeEmail,
    selectedManagerName,
    selectedManagerSub,
    canPickAssignee,
    managerLoading,
    isManagerModalOpen,
    onOpenManagerModal,
    onCloseManagerModal,
    managerDropdownOptions,
    selectedManagerId,
    onSelectManager,
    selectedCategory,
    categoryLoading,
    isCategoryModalOpen,
    onOpenCategoryModal,
    onCloseCategoryModal,
    categoryDropdownOptions,
    categoryId,
    onSelectCategory,
    pincode,
    onChangePincode,
    pincodeStatus,
    address,
    onChangeAddress,
    village,
    onChangeVillage,
    district,
    onChangeDistrict,
    stateName,
    onChangeStateName,
    formattedAddress,
    errors,
    feedback,
    onDismissFeedback,
    isSubmitting,
    onSubmit,
    savedCustomer,
    onResetForm,
    onDoneAfterSave,
  } = props;

  const headerTopPadding = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 16) + 4;

  // ----------------------------------------------------
  // Success Confirmation View
  // ----------------------------------------------------
  if (savedCustomer) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: headerTopPadding }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onDoneAfterSave}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Shop Added
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentWrapper}>
            <SaveConfirmationCard
              title="Shop Added"
              count={1}
              customers={[savedCustomer]}
              serverCreatedAt={savedCustomer.createdAt}
              hasPhoto={Boolean(photoUri)}
              photoReason={photoUri ? 'Shop photo saved' : noPhotoReason || 'No photo reason'}
              hasGps={Boolean(latitude && longitude)}
              latitude={latitude}
              longitude={longitude}
              onReset={onResetForm}
              onDone={onDoneAfterSave}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const isPhotoUploaded = Boolean(photoUri);
  const isAcquiringGps = gpsStatus === 'acquiring_high' || gpsStatus === 'acquiring_fallback';
  const isGpsFound = gpsStatus === 'acquired';
  const gpsStatusLabel = isAcquiringGps
    ? 'Getting Location...'
    : isGpsFound
      ? 'Location Found'
      : 'Location Not Found';

  const areaSummary = [village.trim(), district.trim(), stateName.trim()].filter(Boolean).join(', ');
  const locationSubtitleText = isAcquiringGps
    ? 'Checking GPS...'
    : isGpsFound
      ? areaSummary || 'GPS ready'
      : gpsStatus === 'denied'
        ? 'Turn on GPS or type address below'
        : areaSummary || 'Tap Retry or enter address below';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Fixed Header */}
      <View style={[styles.headerRow, { paddingTop: headerTopPadding }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Add New Shop
          </Text>
        </View>

        <TouchableOpacity
          style={styles.batchBtn}
          onPress={onOpenBatchEntry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Batch Entry"
        >
          <Ionicons name="layers-outline" size={16} color={BrandColors.pink.deep} style={{ marginRight: 5 }} />
          <Text style={styles.batchBtnText} numberOfLines={1}>
            Batch Entry
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              onDismiss={onDismissFeedback}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 1. CURRENT LOCATION CARD */}
          <View style={styles.locationCard}>
            <View style={styles.locationLeft}>
              <View
                style={[
                  styles.locationIconCircle,
                  isGpsFound && { backgroundColor: '#16A34A' },
                  !isGpsFound && !isAcquiringGps && { backgroundColor: '#D97706' },
                ]}
              >
                {isAcquiringGps ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={isGpsFound ? 'location-sharp' : 'alert-outline'}
                    size={18}
                    color="#FFFFFF"
                  />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.locationTitle,
                    isGpsFound && { color: '#15803D' },
                    !isGpsFound && !isAcquiringGps && { color: '#B45309' },
                  ]}
                  numberOfLines={1}
                >
                  {gpsStatusLabel}
                </Text>
                <Text style={styles.locationSubtitle} numberOfLines={1}>
                  {locationSubtitleText}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.changeBtn}
              onPress={onRefreshLocation}
              activeOpacity={0.8}
              disabled={isAcquiringGps}
              accessibilityRole="button"
              accessibilityLabel="Change or retry location"
            >
              <Ionicons name="locate-outline" size={15} color={BrandColors.pink.deep} style={{ marginRight: 4 }} />
              <Text style={styles.changeBtnText}>
                {isGpsFound ? 'Change' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 2. SHOP PHOTO CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.cardHeaderTitle}>Take Shop Photo</Text>
            </View>

            <TouchableOpacity
              style={[styles.photoDashedBox, isPhotoUploaded && styles.photoDashedBoxActive]}
              onPress={onPickPhoto}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Take Shop Photo"
            >
              {isPhotoUploaded ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image
                    source={{ uri: photoUri || undefined }}
                    style={styles.photoPreviewThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.photoPreviewMeta}>
                    <View style={styles.photoCapturedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 5 }} />
                      <Text style={styles.photoCapturedText}>Shop Photo Saved</Text>
                    </View>
                    <View style={styles.photoActionsRow}>
                      <TouchableOpacity
                        onPress={onPickPhoto}
                        activeOpacity={0.7}
                        style={styles.photoActionPill}
                      >
                        <Text style={styles.photoActionLink}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          onRemovePhoto();
                        }}
                        activeOpacity={0.7}
                        style={[styles.photoActionPill, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                      >
                        <Text style={[styles.photoActionLink, { color: '#DC2626' }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPlaceholderCenter}>
                  <View style={styles.photoCameraIconBox}>
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.photoTakeTitle}>Take Shop Photo</Text>
                  <Text style={styles.photoTakeSub}>Tap to use Camera or Gallery</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Why no photo? */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.inputLabel}>
                Why no photo? {!isPhotoUploaded && <Text style={styles.reqAsterisk}>*</Text>}
              </Text>

              <View
                style={[
                  styles.dropdownContainer,
                  isPhotoUploaded && styles.dropdownContainerDisabled,
                  Boolean(errors.noPhotoReason) && styles.inputErrorBorder,
                ]}
              >
                <TouchableOpacity
                  style={styles.dropdownHeader}
                  onPress={() => {
                    if (!isPhotoUploaded) {
                      onToggleReasonDropdown();
                    }
                  }}
                  activeOpacity={isPhotoUploaded ? 1 : 0.8}
                  disabled={isPhotoUploaded}
                  accessibilityRole="combobox"
                  accessibilityState={{
                    expanded: !isPhotoUploaded && isReasonDropdownOpen,
                    disabled: isPhotoUploaded,
                  }}
                  accessibilityLabel="Why no photo"
                >
                  <Text
                    style={[
                      styles.dropdownHeaderText,
                      isPhotoUploaded && styles.dropdownDisabledText,
                      !noPhotoReason && !isPhotoUploaded && styles.dropdownPlaceholderText,
                    ]}
                    numberOfLines={1}
                  >
                    {isPhotoUploaded
                      ? 'Photo saved — reason not needed'
                      : noPhotoReason || 'Select a reason'}
                  </Text>
                  <Ionicons
                    name={
                      isPhotoUploaded
                        ? 'checkmark-circle'
                        : isReasonDropdownOpen
                          ? 'chevron-up'
                          : 'chevron-down'
                    }
                    size={18}
                    color={isPhotoUploaded ? '#16A34A' : BrandColors.pink.deep}
                  />
                </TouchableOpacity>

                {!isPhotoUploaded && isReasonDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {PHOTO_REASONS.map((item, idx) => {
                      const isSelected = noPhotoReason === item.label;
                      return (
                        <TouchableOpacity
                          key={item.label}
                          style={[
                            styles.dropdownItem,
                            idx === 0 && { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => onSelectNoPhotoReason(item.label)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <Ionicons
                            name={item.icon}
                            size={17}
                            color={isSelected ? BrandColors.pink.deep : '#475569'}
                            style={{ marginRight: 10 }}
                          />
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={17} color={BrandColors.pink.deep} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {errors.noPhotoReason ? (
                <Text style={styles.errorSubText}>{errors.noPhotoReason}</Text>
              ) : null}
            </View>
          </View>

          {/* 3. SHOP DETAILS CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="storefront" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.cardHeaderTitle}>Shop Details</Text>
            </View>

            {/* Shop Name * */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                Shop Name <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, Boolean(errors.shopName) && styles.inputErrorBorder]}>
                <Ionicons name="storefront-outline" size={18} color={BrandColors.pink.deep} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={shopName}
                  onChangeText={onChangeShopName}
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="Enter shop name"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.shopName ? <Text style={styles.errorSubText}>{errors.shopName}</Text> : null}
            </View>

            {/* Owner Name * */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                Owner Name <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, Boolean(errors.ownerName) && styles.inputErrorBorder]}>
                <Ionicons name="person-outline" size={18} color={BrandColors.pink.deep} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={ownerName}
                  onChangeText={onChangeOwnerName}
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="Enter owner's name"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.ownerName ? <Text style={styles.errorSubText}>{errors.ownerName}</Text> : null}
            </View>

            {/* Mobile Number * */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                Mobile Number <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, Boolean(errors.phone) && styles.inputErrorBorder]}>
                <Text style={styles.phoneCountryCode}>+91</Text>
                <View style={styles.inputDivider} />
                <TextInput
                  style={styles.textInputField}
                  value={phone}
                  onChangeText={onChangePhone}
                  keyboardType="numeric"
                  maxLength={10}
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.phone ? <Text style={styles.errorSubText}>{errors.phone}</Text> : null}
            </View>

            {/* Email (Optional) */}
            <View style={[styles.fieldSection, { marginBottom: 0 }]}>
              <View style={styles.labelWithTag}>
                <Text style={styles.inputLabelNoMargin}>Email</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <View style={[styles.inputBox, Boolean(errors.email) && styles.inputErrorBorder]}>
                <Ionicons name="mail-outline" size={18} color={BrandColors.pink.deep} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={email}
                  onChangeText={onChangeEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="Enter email address"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.email ? <Text style={styles.errorSubText}>{errors.email}</Text> : null}
            </View>
          </View>

          {/* 4. ASSIGN MANAGER & TRADE CATEGORY */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="people" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.cardHeaderTitle}>
                {role === 'MANAGER' ? 'Assign Manager & Category' : 'Shop Category'}
              </Text>
            </View>

            {/* Manager / Seller Assignment */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                {role === 'MANAGER' ? 'Assign Manager' : 'Assigned To'}{' '}
                {role === 'MANAGER' && <Text style={styles.reqAsterisk}>*</Text>}
              </Text>

              {canPickAssignee ? (
                <TouchableOpacity
                  style={[styles.dropdownSelectBox, Boolean(errors.managerId) && styles.inputErrorBorder]}
                  onPress={onOpenManagerModal}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Assign Manager"
                >
                  <View style={styles.dropdownSelectLeft}>
                    <View style={styles.dropdownSelectIconBox}>
                      <Ionicons name="person-circle-outline" size={20} color={BrandColors.pink.deep} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.dropdownSelectTitle} numberOfLines={1}>
                        {selectedManagerName}
                      </Text>
                      {selectedManagerSub ? (
                        <Text style={styles.dropdownSelectSub} numberOfLines={1}>
                          {selectedManagerSub}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {managerLoading ? (
                    <ActivityIndicator size="small" color={BrandColors.pink.deep} />
                  ) : (
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.dropdownSelectBox, styles.readOnlyBox]}>
                  <View style={styles.dropdownSelectLeft}>
                    <View style={[styles.dropdownSelectIconBox, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="person-circle" size={20} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.dropdownSelectTitle} numberOfLines={1}>
                        {selectedManagerName}
                      </Text>
                      <Text style={styles.dropdownSelectSub} numberOfLines={1}>
                        {role === 'MANAGER'
                          ? 'Assigned to your account'
                          : 'Assigned to you'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                </View>
              )}
              {errors.managerId ? <Text style={styles.errorSubText}>{errors.managerId}</Text> : null}
            </View>

            {/* Trade Category * */}
            <View style={[styles.fieldSection, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>
                Trade Category <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownSelectBox, Boolean(errors.categoryId) && styles.inputErrorBorder]}
                onPress={onOpenCategoryModal}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Select Trade Category"
              >
                <View style={styles.dropdownSelectLeft}>
                  <View style={[styles.dropdownSelectIconBox, { backgroundColor: '#FCE7F3' }]}>
                    <Ionicons name="pricetag-outline" size={18} color={BrandColors.pink.deep} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.dropdownSelectTitle} numberOfLines={1}>
                      {selectedCategory ? selectedCategory.name : 'Select shop category'}
                    </Text>
                  </View>
                </View>
                {categoryLoading ? (
                  <ActivityIndicator size="small" color={BrandColors.pink.deep} />
                ) : (
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
                )}
              </TouchableOpacity>
              {errors.categoryId ? <Text style={styles.errorSubText}>{errors.categoryId}</Text> : null}
            </View>
          </View>

          {/* 5. SHOP ADDRESS CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#E11D48' }]}>
                <Ionicons name="location-sharp" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.cardHeaderTitle}>Shop Address</Text>
            </View>

            {/* PIN Code * */}
            <View style={styles.fieldSection}>
              <View style={styles.labelWithTag}>
                <Text style={styles.inputLabelNoMargin}>
                  PIN Code <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                {pincodeStatus === 'loading' && (
                  <View style={styles.pinStatusRow}>
                    <ActivityIndicator size="small" color={BrandColors.pink.deep} style={{ marginRight: 4 }} />
                    <Text style={styles.pinStatusLoading}>Finding address...</Text>
                  </View>
                )}
                {pincodeStatus === 'found' && (
                  <View style={styles.pinStatusRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                    <Text style={styles.pinStatusFound}>Address Found</Text>
                  </View>
                )}
                {pincodeStatus === 'not_found' && (
                  <View style={styles.pinStatusRow}>
                    <Ionicons name="alert-circle" size={14} color="#D97706" style={{ marginRight: 4 }} />
                    <Text style={styles.pinStatusNotFound}>Address Not Found</Text>
                  </View>
                )}
              </View>
              <View style={[styles.inputBox, Boolean(errors.pincode) && styles.inputErrorBorder]}>
                <Ionicons name="navigate-outline" size={18} color={BrandColors.pink.deep} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={pincode}
                  onChangeText={onChangePincode}
                  keyboardType="numeric"
                  maxLength={6}
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="Enter 6-digit PIN code"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.pincode ? <Text style={styles.errorSubText}>{errors.pincode}</Text> : null}
            </View>

            {/* Shop Address * */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                Shop Address <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, Boolean(errors.address) && styles.inputErrorBorder]}>
                <Ionicons name="business-outline" size={18} color={BrandColors.pink.deep} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={address}
                  onChangeText={onChangeAddress}
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="Shop number, street, landmark"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.address ? <Text style={styles.errorSubText}>{errors.address}</Text> : null}
            </View>

            {/* Area / Village */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>Area / Village</Text>
              <View style={styles.inputBox}>
                <Ionicons name="map-outline" size={18} color={BrandColors.pink.deep} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={village}
                  onChangeText={onChangeVillage}
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="Enter area or village"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* District * & State * */}
            <View style={[styles.districtStateRow, isCompactScreen && styles.districtStateStacked]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  District <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                <View style={[styles.inputBox, Boolean(errors.district) && styles.inputErrorBorder]}>
                  <TextInput
                    style={styles.textInputField}
                    value={district}
                    onChangeText={onChangeDistrict}
                    autoComplete="off"
                    importantForAutofill="no"
                    placeholder="Enter district"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {errors.district ? <Text style={styles.errorSubText}>{errors.district}</Text> : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  State <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                <View style={[styles.inputBox, Boolean(errors.stateName) && styles.inputErrorBorder]}>
                  <TextInput
                    style={styles.textInputField}
                    value={stateName}
                    onChangeText={onChangeStateName}
                    autoComplete="off"
                    importantForAutofill="no"
                    placeholder="Enter state"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {errors.stateName ? <Text style={styles.errorSubText}>{errors.stateName}</Text> : null}
              </View>
            </View>

            {/* Compact Address Found Preview */}
            {formattedAddress ? (
              <View style={styles.addressPreviewBox}>
                <Ionicons name="checkmark-circle" size={17} color="#16A34A" style={{ marginTop: 1 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.addressPreviewTitle}>Address Found</Text>
                  <Text style={styles.addressPreviewText} numberOfLines={2}>
                    {formattedAddress}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Save Shop Footer */}
      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
      >
        <View style={styles.stickyFooterInner}>
          <Button
            title={isSubmitting ? 'Saving Shop...' : 'Save Shop'}
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={onSubmit}
          />
        </View>
      </View>

      {/* Searchable Assignee Modal (Manager & team sellers only) */}
      {canPickAssignee && (
        <SearchableDropdownModal
          visible={isManagerModalOpen}
          title="Assign Manager"
          searchPlaceholder="Search name..."
          options={managerDropdownOptions}
          selectedId={selectedManagerId}
          onSelect={onSelectManager}
          onClose={onCloseManagerModal}
          emptyMessage="No team members found"
        />
      )}

      {/* Searchable Trade Category Modal */}
      <SearchableDropdownModal
        visible={isCategoryModalOpen}
        title="Trade Category"
        searchPlaceholder="Search category..."
        options={categoryDropdownOptions}
        selectedId={categoryId}
        onSelect={onSelectCategory}
        onClose={onCloseCategoryModal}
        emptyMessage="No category found"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FECDD3',
    flexShrink: 0,
  },
  batchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.deep,
  },
  scrollContent: {
    paddingTop: Spacing.md,
  },
  contentWrapper: {
    paddingHorizontal: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  locationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.pink.deep,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  locationSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FECDD3',
    flexShrink: 0,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.deep,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: BrandColors.pink.deep,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  photoDashedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FDA4AF',
    borderRadius: Radius.md,
    backgroundColor: '#FFFDFD',
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  photoDashedBoxActive: {
    borderStyle: 'solid',
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  photoPlaceholderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCameraIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BrandColors.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoTakeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BrandColors.pink.deep,
  },
  photoTakeSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  photoPreviewWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  photoPreviewThumb: {
    width: 68,
    height: 68,
    borderRadius: Radius.sm,
    backgroundColor: '#E2E8F0',
  },
  photoPreviewMeta: {
    flex: 1,
    marginLeft: 12,
  },
  photoCapturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoCapturedText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  photoActionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  photoActionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.deep,
  },
  fieldSection: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputLabelNoMargin: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  labelWithTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reqAsterisk: {
    color: '#E11D48',
    fontWeight: '800',
  },
  optionalBadge: {
    fontSize: 11,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  textInputField: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 8,
  },
  phoneCountryCode: {
    fontSize: 15,
    fontWeight: '800',
    color: BrandColors.pink.deep,
    marginRight: 8,
  },
  inputDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#CBD5E1',
    marginRight: 8,
  },
  inputErrorBorder: {
    borderColor: '#E11D48',
    backgroundColor: '#FFF1F2',
  },
  errorSubText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: '600',
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  dropdownContainerDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  dropdownHeaderText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  dropdownDisabledText: {
    color: '#15803D',
  },
  dropdownPlaceholderText: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF5F7',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: BrandColors.pink.deep,
    fontWeight: '700',
  },
  dropdownSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  readOnlyBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  dropdownSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  dropdownSelectIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  dropdownSelectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownSelectSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  pinStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinStatusLoading: {
    fontSize: 12,
    color: BrandColors.pink.deep,
    fontWeight: '600',
  },
  pinStatusFound: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '700',
  },
  pinStatusNotFound: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '700',
  },
  districtStateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  districtStateStacked: {
    flexDirection: 'column',
    gap: 12,
  },
  addressPreviewBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radius.md,
    padding: 12,
    gap: 8,
  },
  addressPreviewTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 2,
  },
  addressPreviewText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...Shadows.md,
  },
  stickyFooterInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
