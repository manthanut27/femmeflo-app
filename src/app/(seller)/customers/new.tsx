import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import { categoriesApi } from '@/api/categories';
import { MOCK_ALL_MANAGERS } from '@/api/mockData';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem, PublicUser } from '@/api/types';
import { ShiftRequiredGate } from '@/components/common/ShiftRequiredGate';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { useAuth } from '@/context/AuthContext';
import { draftStorage } from '@/utils/draftStorage';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { acquireGpsCoordinates, type GpsAcquisitionStatus } from '@/utils/locationUtils';
import { checkHasActiveShift } from '@/utils/shiftGuard';

const PHOTO_REASONS = [
  { label: 'Poor network connectivity', icon: 'cellular-outline' as const },
  { label: 'Customer refused photo', icon: 'person-remove-outline' as const },
  { label: 'Shopkeeper not present / closed', icon: 'storefront-outline' as const },
  { label: 'Camera / device malfunction', icon: 'camera-reverse-outline' as const },
  { label: 'Indoor shop / poor lighting', icon: 'sunny-outline' as const },
];

const DEFAULT_TRADE_CATEGORIES: Array<{ id: string; name: string; icon?: any }> = [
  { id: 'cat_chemist_default', name: 'Chemist / Pharmacy', icon: 'medkit-outline' },
  { id: 'cat_general_default', name: 'General Store', icon: 'cart-outline' },
  { id: 'cat_supermarket_default', name: 'Supermarket', icon: 'basket-outline' },
  { id: 'cat_cosmetic_default', name: 'Beauty / Cosmetic', icon: 'sparkles-outline' },
  { id: 'cat_clinic_default', name: 'Clinic / Maternity', icon: 'fitness-outline' },
  { id: 'cat_retail_default', name: 'FMCG / Retail', icon: 'bag-handle-outline' },
  { id: 'cat_wholesale_default', name: 'Wholesale / Dist.', icon: 'cube-outline' },
];

export default function AddCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);
  const [checkingShift, setCheckingShift] = useState(true);

  // Core Form Fields
  const [shopName, setShopName] = useState('Reliance Smart');
  const [ownerName, setOwnerName] = useState('Store Manager');
  const [email, setEmail] = useState('store@reliancesmart.com');
  const [phone, setPhone] = useState('9820012345');
  const [categoryId, setCategoryId] = useState('cat_retail_default');
  const [address, setAddress] = useState('Shop No. 12, GB Road');
  const [pincode, setPincode] = useState('400601');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('Thane');
  const [village, setVillage] = useState('Thane West');
  const [noPhotoReason, setNoPhotoReason] = useState('Poor network connectivity');

  // Manager Searchable Dropdown State
  const [managers, setManagers] = useState<PublicUser[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = useState('');

  // UI Interactive States
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);

  // GPS Location State
  const [latitude, setLatitude] = useState<number | null>(19.2183);
  const [longitude, setLongitude] = useState<number | null>(72.9781);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(15);
  const [gpsStatus, setGpsStatus] = useState<GpsAcquisitionStatus>('acquired');

  // Photo State
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Categories
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const [savedCustomer, setSavedCustomer] = useState<CustomerItem | null>(null);

  useEffect(() => {
    checkHasActiveShift(user?.id).then((res) => {
      setHasActiveShift(res.hasActiveShift);
      setCheckingShift(false);
    });
  }, [user?.id]);

  useEffect(() => {
    categoriesApi
      .listCategories()
      .then((res) => {
        if (res.items && res.items.length > 0) {
          setCategories(res.items);
          if (!categoryId) setCategoryId(res.items[0].id);
        }
      })
      .catch(() => {});

    // Fetch managers for assignment
    const currentUserOption: PublicUser = {
      id: user?.id || 'usr_seller_me',
      name: user?.name ? `${user.name} (Assigned Seller)` : 'Myself (Assigned Seller)',
      email: user?.email || 'seller@femmeflo.com',
      role: 'SELLER' as any,
      active: true,
    };

    adminApi
      .listManagers({ pageSize: 50 })
      .then((res) => {
        const list = res.items || [];
        const deduped = [currentUserOption, ...list.filter((m) => m.id !== user?.id)];
        setManagers(deduped);
        setSelectedManagerId(currentUserOption.id);
      })
      .catch(() => {
        const fallback = [currentUserOption, ...MOCK_ALL_MANAGERS.filter((m) => m.id !== user?.id)];
        setManagers(fallback);
        setSelectedManagerId(currentUserOption.id);
      });

    startGpsAcquisition();

    draftStorage.getCustomerDraft().then((draft) => {
      if (draft) {
        if (draft.shopName) setShopName(draft.shopName);
        if (draft.ownerName) setOwnerName(draft.ownerName);
        if (draft.email) setEmail(draft.email);
        if (draft.phone) setPhone(draft.phone);
        if (draft.categoryId) setCategoryId(draft.categoryId);
        if (draft.address) setAddress(draft.address);
        if (draft.pincode) setPincode(draft.pincode);
        if (draft.state) setStateName(draft.state);
        if (draft.district) setDistrict(draft.district);
        if (draft.village) setVillage(draft.village);
        if (draft.photoUri) setPhotoUri(draft.photoUri);
        if (draft.noPhotoReason) setNoPhotoReason(draft.noPhotoReason);
        if (draft.latitude) setLatitude(draft.latitude);
        if (draft.longitude) setLongitude(draft.longitude);
      }
    });
  }, [user]);

  async function startGpsAcquisition() {
    setGpsStatus('acquiring_high');
    const res = await acquireGpsCoordinates({
      highAccuracyTimeoutMs: 6000,
      fallbackTimeoutMs: 4000,
      onStatusChange: setGpsStatus,
    });
    setGpsStatus(res.status);
    if (res.status === 'acquired' && res.latitude !== null && res.longitude !== null) {
      setLatitude(res.latitude);
      setLongitude(res.longitude);
      setGpsAccuracy(res.accuracy);
    }
  }

  async function handlePincodeChange(text: string) {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: '' }));

    if (clean.length === 6 && /^\d{6}$/.test(clean)) {
      setPincodeLoading(true);
      try {
        const lookup = await sellerApi.lookupPincode(clean);
        if (lookup.state) setStateName(lookup.state);
        if (lookup.district) setDistrict(lookup.district);
        if (lookup.village) setVillage(lookup.village);
      } catch {
        // Fallback
      } finally {
        setPincodeLoading(false);
      }
    }
  }

  async function pickPhoto() {
    Alert.alert('Store Photograph', 'Select photo source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            const compressed = await compressImage(res.assets[0].uri);
            setPhotoUri(compressed.uri);
            setIsReasonDropdownOpen(false);
            if (errors.noPhotoReason) {
              setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
            }
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery access is required.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            const compressed = await compressImage(res.assets[0].uri);
            setPhotoUri(compressed.uri);
            setIsReasonDropdownOpen(false);
            if (errors.noPhotoReason) {
              setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
            }
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!shopName.trim()) errs.shopName = 'Retail shop name is required.';
    if (!ownerName.trim()) errs.ownerName = 'Owner / Contact person name is required.';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Valid 10-digit Indian mobile number is required.';
    }
    if (!categoryId) errs.categoryId = 'Trade category selection is required.';
    if (!address.trim()) errs.address = 'Street address is required.';
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Valid 6-digit PIN code is required.';
    }
    if (!stateName.trim()) errs.stateName = 'State is required.';
    if (!district.trim()) errs.district = 'District is required.';

    // Mandatory photo exemption reason ONLY if storefront photo is omitted
    if (!photoUri && !noPhotoReason.trim()) {
      errs.noPhotoReason = 'Reason is required when photo is omitted.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    if (hasActiveShift === false) {
      setFeedback({
        type: 'error',
        title: 'Duty Shift Required',
        message: 'You must start your daily duty shift with selfie attendance before onboarding retailers.',
      });
      Alert.alert(
        'Duty Shift Required',
        'You must start your daily duty shift with selfie attendance before onboarding retailers.'
      );
      return;
    }

    if (!validate()) {
      setFeedback({
        type: 'error',
        title: 'Validation Error',
        message: 'Please complete all required fields highlighted in red.',
      });
      Alert.alert('Validation Error', 'Please complete all required fields highlighted in red.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const selectedCatId = categoryId || categories[0]?.id || 'cat_retail_default';
      const res = await sellerApi.createCustomer({
        shopName: shopName.trim(),
        ownerName: ownerName.trim() || 'Store Manager',
        email: email.trim() || 'store@reliancesmart.com',
        phone: phone.trim() || '9820012345',
        categoryId: selectedCatId,
        address: address.trim(),
        pincode: pincode.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        photoUri: photoUri || undefined,
        noPhotoReason: photoUri ? 'Storefront photo captured' : noPhotoReason.trim(),
      });

      const customerId = res.customer.id;
      if (photoUri && customerId) {
        try {
          const photoRes = await sellerApi.uploadCustomerPhoto(customerId, photoUri);
          if (photoRes?.photoUrl) {
            res.customer.photoUrl = photoRes.photoUrl;
          }
        } catch (photoErr) {
          console.warn('Customer photo upload fallback failed, record preserved', photoErr);
        }
      }

      await draftStorage.clearCustomerDraft();
      setSavedCustomer(res.customer);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Failed to save customer. Your entered details have been preserved.',
      });
      Alert.alert('Submission Error', err.message || 'Failed to save customer.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPhotoUploaded = Boolean(photoUri);

  const tradeCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: 'storefront-outline' as const,
      }));
    }
    return DEFAULT_TRADE_CATEGORIES;
  }, [categories]);

  const filteredManagers = useMemo(() => {
    const q = managerSearchQuery.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        ((m as any).phone && (m as any).phone.toLowerCase().includes(q))
    );
  }, [managers, managerSearchQuery]);

  const currentSelectedManager = useMemo(() => {
    const match = managers.find((m) => m.id === selectedManagerId);
    if (match) return match;
    return (
      managers[0] || {
        id: user?.id || 'usr_seller_me',
        name: user?.name ? `${user.name} (Assigned Seller)` : 'Myself (Assigned Seller)',
        email: user?.email || 'seller@femmeflo.com',
      }
    );
  }, [managers, selectedManagerId, user]);

  const formattedAddress = useMemo(() => {
    const parts = [
      address.trim(),
      village.trim(),
      district.trim(),
      stateName.trim() && pincode.trim()
        ? `${stateName.trim()} – ${pincode.trim()}`
        : stateName.trim() || pincode.trim(),
    ].filter(Boolean);
    return parts.length > 0
      ? parts.join(', ')
      : 'Shop No. 12, GB Road, Thane West, Maharashtra – 400601';
  }, [address, village, district, stateName, pincode]);

  if (savedCustomer) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(seller)/customers' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Customer Onboarded</Text>
            <Text style={styles.headerSubtitle}>Retail outlet registered successfully</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentWrapper}>
            <SaveConfirmationCard
              count={1}
              customers={[savedCustomer]}
              serverCreatedAt={savedCustomer.createdAt}
              hasPhoto={Boolean(photoUri)}
              photoReason={noPhotoReason || 'Storefront Photo Captured'}
              hasGps={Boolean(latitude && longitude)}
              latitude={latitude}
              longitude={longitude}
              onReset={() => {
                setSavedCustomer(null);
                setShopName('Reliance Smart');
                setOwnerName('Store Manager');
                setEmail('store@reliancesmart.com');
                setPhone('9820012345');
                setAddress('Shop No. 12, GB Road');
                setPincode('400601');
                setVillage('Thane West');
                setDistrict('Thane');
                setStateName('Maharashtra');
                setNoPhotoReason('Poor network connectivity');
                setPhotoUri(null);
                startGpsAcquisition();
              }}
              onDone={() => {
                router.replace('/(seller)/customers' as any);
              }}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (checkingShift) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#881337" />
      </View>
    );
  }

  if (hasActiveShift === false) {
    return (
      <ShiftRequiredGate
        title="Onboard Customer"
        subtitle="Daily Duty Shift Required"
        actionName="onboard new retailers or register new stores"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Top Header matching reference image */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Onboard Customer</Text>
          <Text style={styles.headerSubtitle}>Add a store to report issues</Text>
        </View>

        <TouchableOpacity
          style={styles.batchBtn}
          onPress={() => router.push('/(seller)/customers/bulk' as any)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Batch Entry"
        >
          <Ionicons name="layers-outline" size={16} color="#881337" style={{ marginRight: 5 }} />
          <Text style={styles.batchBtnText}>Batch Entry</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {feedback ? (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              actionLabel={feedback.actionLabel}
              onAction={feedback.onAction}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          {/* Current Location Card matching image */}
          <View style={styles.locationCard}>
            <View style={styles.locationLeft}>
              <View style={styles.locationIconCircle}>
                <Ionicons name="location-sharp" size={18} color="#FFFFFF" />
              </View>
              <View>
                <View style={styles.locationTitleRow}>
                  <Text style={styles.locationTitle}>Current Location</Text>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#16A34A"
                    style={{ marginLeft: 5 }}
                  />
                </View>
                <Text style={styles.locationSubtitle}>
                  {district ? `${district}, ${stateName}` : 'Thane, Maharashtra'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.changeBtn}
              onPress={startGpsAcquisition}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change or re-acquire location"
            >
              <Ionicons name="locate-outline" size={14} color="#881337" style={{ marginRight: 4 }} />
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Card 1: Storefront Photo & Photo Exemption Reason */}
          <View style={styles.storeCard}>
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <View style={styles.storeIconCircle}>
                  <Ionicons name="camera" size={15} color="#FFFFFF" />
                </View>
                <Text style={styles.fieldLabel}>Storefront Photo Verification</Text>
              </View>

              {/* Take Storefront Photo Dashed Box */}
              <TouchableOpacity
                style={[styles.photoDashedBox, isPhotoUploaded && styles.photoDashedBoxActive]}
                onPress={pickPhoto}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Take Storefront Photo"
              >
                {photoUri ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.photoPreviewThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.photoPreviewMeta}>
                      <View style={styles.photoCapturedBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={15}
                          color="#16A34A"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.photoCapturedText}>Storefront Photo Uploaded</Text>
                      </View>
                      <View style={styles.photoActionsRow}>
                        <Text style={styles.photoActionLink}>Retake Photo</Text>
                        <Text style={styles.photoActionDot}>•</Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setPhotoUri(null);
                          }}
                        >
                          <Text style={[styles.photoActionLink, { color: '#DC2626' }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoPlaceholderCenter}>
                    <View style={styles.photoCameraIconBox}>
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.photoTakeTitle}>Take Storefront Photo</Text>
                    <Text style={styles.photoTakeSub}>Upload store entrance or signboard</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Reason for not adding shopkeeper photo (DISABLED if photo is uploaded) */}
            <View style={[styles.fieldSection, { marginBottom: 0 }]}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name="help-circle" size={18} color="#881337" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>
                  Reason for not adding shopkeeper photo{' '}
                  {!isPhotoUploaded && <Text style={styles.reqAsterisk}>*</Text>}
                </Text>
              </View>

              {isPhotoUploaded ? (
                // Disabled State: Photo is uploaded, exemption not required
                <View style={styles.dropdownDisabled}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#16A34A"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.dropdownDisabledText}>
                      Storefront photo uploaded — exemption reason not required
                    </Text>
                  </View>
                  <Ionicons name="lock-closed" size={16} color="#94A3B8" />
                </View>
              ) : (
                // Enabled State: Photo is not uploaded, user must select a reason
                <View
                  style={[
                    styles.dropdownContainer,
                    errors.noPhotoReason && styles.inputErrorBorder,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.dropdownHeader}
                    onPress={() => setIsReasonDropdownOpen(!isReasonDropdownOpen)}
                    activeOpacity={0.8}
                    accessibilityRole="combobox"
                    accessibilityState={{ expanded: isReasonDropdownOpen }}
                    accessibilityLabel="Reason for not adding shopkeeper photo"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="images" size={17} color="#881337" style={{ marginRight: 8 }} />
                      <Text
                        style={[
                          styles.dropdownHeaderText,
                          !noPhotoReason && styles.dropdownPlaceholderText,
                        ]}
                      >
                        {noPhotoReason || 'Select a reason'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isReasonDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      color="#881337"
                    />
                  </TouchableOpacity>

                  {isReasonDropdownOpen && (
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
                            onPress={() => {
                              setNoPhotoReason(item.label);
                              setIsReasonDropdownOpen(false);
                              if (errors.noPhotoReason) {
                                setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
                              }
                            }}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                          >
                            <Ionicons
                              name={item.icon}
                              size={16}
                              color={isSelected ? '#881337' : '#475569'}
                              style={{ marginRight: 10, width: 20 }}
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
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color="#881337"
                                style={{ marginLeft: 'auto' }}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
              {Boolean(!isPhotoUploaded && errors.noPhotoReason) && (
                <Text style={styles.errorText}>{errors.noPhotoReason}</Text>
              )}
            </View>
          </View>

          {/* Section 2: Shop Information (Shop Name *, Owner Name *, Mobile Number *, Email) */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconCircleMaroon}>
                <Ionicons name="storefront" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Shop Information</Text>
                <Text style={styles.cardHeaderSubtitle}>Store name and owner contact details</Text>
              </View>
            </View>

            {/* Shop Name * */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Shop / Store Name <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.shopName && styles.inputErrorBorder]}
                value={shopName}
                onChangeText={(text) => {
                  setShopName(text);
                  if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
                }}
                placeholder="e.g. Reliance Smart"
                placeholderTextColor="#94A3B8"
              />
              {Boolean(errors.shopName) && (
                <Text style={styles.errorText}>{errors.shopName}</Text>
              )}
            </View>

            {/* Owner Name * */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Owner Name <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.ownerName && styles.inputErrorBorder]}
                value={ownerName}
                onChangeText={(text) => {
                  setOwnerName(text);
                  if (errors.ownerName) setErrors((prev) => ({ ...prev, ownerName: '' }));
                }}
                placeholder="e.g. Ramesh Kumar / Store Manager"
                placeholderTextColor="#94A3B8"
              />
              {Boolean(errors.ownerName) && (
                <Text style={styles.errorText}>{errors.ownerName}</Text>
              )}
            </View>

            {/* Mobile Number * */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Mobile Number <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={[styles.phoneInputWrap, errors.phone && styles.inputErrorBorder]}>
                <View style={styles.phoneCountryBadge}>
                  <Text style={styles.phoneCountryText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneTextInput}
                  value={phone}
                  onChangeText={(text) => {
                    const clean = text.replace(/\D/g, '').slice(0, 10);
                    setPhone(clean);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="9820012345"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {Boolean(errors.phone) && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            {/* Email (Optional) */}
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>Email (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="e.g. store@reliancesmart.com"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Section 3: Account Assignment to Manager (Searchable Dropdown) & Trade Category */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconCircleGreen}>
                <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Account Assignment</Text>
                <Text style={styles.cardHeaderSubtitle}>
                  Assign territory manager and select trade category
                </Text>
              </View>
            </View>

            {/* Account Assignment to Manager using Searchable Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Assign to Manager <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.managerDropdownTrigger}
                onPress={() => setIsManagerModalOpen(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Select territory manager"
              >
                <View style={styles.managerTriggerLeft}>
                  <View style={styles.managerTriggerAvatar}>
                    <Ionicons name="person" size={16} color="#881337" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.managerTriggerName} numberOfLines={1}>
                      {currentSelectedManager.name}
                    </Text>
                    <Text style={styles.managerTriggerSubtitle} numberOfLines={1}>
                      {currentSelectedManager.email ||
                        currentSelectedManager.role ||
                        'Territory Lead'}
                    </Text>
                  </View>
                </View>
                <View style={styles.managerTriggerSearchBtn}>
                  <Ionicons name="search" size={14} color="#881337" style={{ marginRight: 4 }} />
                  <Text style={styles.managerTriggerSearchText}>Search</Text>
                  <Ionicons
                    name="chevron-down"
                    size={15}
                    color="#881337"
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Trade Category */}
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>
                Trade Category <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={styles.categoriesWrap}>
                {tradeCategories.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                      onPress={() => {
                        setCategoryId(cat.id);
                        if (errors.categoryId) {
                          setErrors((prev) => ({ ...prev, categoryId: '' }));
                        }
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Ionicons
                        name={cat.icon || 'storefront-outline'}
                        size={14}
                        color={isSelected ? '#FFFFFF' : '#475569'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#FFFFFF"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {Boolean(errors.categoryId) && (
                <Text style={styles.errorText}>{errors.categoryId}</Text>
              )}
            </View>
          </View>

          {/* Section 4: Address Details (PIN Code *, Street Address, Village / Locality, District *, State *) */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconCircleMaroon}>
                <Ionicons name="location-sharp" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Address Details</Text>
                <Text style={styles.cardHeaderSubtitle}>
                  Store location and territory info
                </Text>
              </View>
            </View>

            {/* PIN Code * with 6-digit auto lookup */}
            <View style={styles.inputGroup}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.inputLabel}>
                  PIN Code <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                {pincodeLoading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#881337" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, color: '#881337', fontWeight: '600' }}>
                      Looking up PIN...
                    </Text>
                  </View>
                )}
              </View>
              <TextInput
                style={[styles.textInput, errors.pincode && styles.inputErrorBorder]}
                value={pincode}
                onChangeText={handlePincodeChange}
                keyboardType="numeric"
                maxLength={6}
                placeholder="e.g. 400601 (6 digits)"
                placeholderTextColor="#94A3B8"
              />
              {Boolean(errors.pincode) && (
                <Text style={styles.errorText}>{errors.pincode}</Text>
              )}
            </View>

            {/* Street Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Street Address <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.address && styles.inputErrorBorder]}
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                }}
                placeholder="Shop No. 12, GB Road, Near Market"
                placeholderTextColor="#94A3B8"
              />
              {Boolean(errors.address) && (
                <Text style={styles.errorText}>{errors.address}</Text>
              )}
            </View>

            {/* Village / Locality */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Village / Locality</Text>
              <TextInput
                style={styles.textInput}
                value={village}
                onChangeText={setVillage}
                placeholder="e.g. Thane West / Main Bazaar"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* District * & State * in 2 Columns */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  District <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, errors.district && styles.inputErrorBorder]}
                  value={district}
                  onChangeText={(text) => {
                    setDistrict(text);
                    if (errors.district) setErrors((prev) => ({ ...prev, district: '' }));
                  }}
                  placeholder="e.g. Thane"
                  placeholderTextColor="#94A3B8"
                />
                {Boolean(errors.district) && (
                  <Text style={styles.errorText}>{errors.district}</Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  State <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, errors.stateName && styles.inputErrorBorder]}
                  value={stateName}
                  onChangeText={(text) => {
                    setStateName(text);
                    if (errors.stateName) setErrors((prev) => ({ ...prev, stateName: '' }));
                  }}
                  placeholder="e.g. Maharashtra"
                  placeholderTextColor="#94A3B8"
                />
                {Boolean(errors.stateName) && (
                  <Text style={styles.errorText}>{errors.stateName}</Text>
                )}
              </View>
            </View>

            {/* Live Formatted Address Preview Box with Mini Map */}
            <View style={[styles.addressBox, { marginTop: 14 }]}>
              <View style={styles.miniMap}>
                <View style={styles.mapRoadH1} />
                <View style={styles.mapRoadH2} />
                <View style={styles.mapRoadV1} />
                <View style={styles.mapRoadDiag} />
                <View style={styles.mapPinContainer}>
                  <Ionicons name="location-sharp" size={22} color="#E11D48" />
                  <View style={styles.mapPinShadow} />
                </View>
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={styles.addressText} numberOfLines={2}>
                  {formattedAddress}
                </Text>
                {Boolean(latitude && longitude) && (
                  <Text style={styles.addressGpsCoordinates}>
                    GPS: {latitude?.toFixed(4)}, {longitude?.toFixed(4)} (
                    {gpsStatus === 'acquired' ? 'Acquired' : gpsStatus})
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Prominent Register Customer Pill Button */}
          <TouchableOpacity
            style={[styles.registerBtn, isSubmitting && styles.registerBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Register Customer"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.registerBtnText}>Register Customer</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Searchable Manager Dropdown Modal */}
      <Modal
        visible={isManagerModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setIsManagerModalOpen(false);
          setManagerSearchQuery('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.managerModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Assign Territory Manager</Text>
                <Text style={styles.modalSubtitle}>Search and select a manager for this store</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setIsManagerModalOpen(false);
                  setManagerSearchQuery('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Bar with live search */}
            <View style={styles.modalSearchBar}>
              <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search manager by name or email..."
                placeholderTextColor="#94A3B8"
                value={managerSearchQuery}
                onChangeText={setManagerSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {managerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setManagerSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filtered Manager List */}
            <ScrollView
              style={styles.managerListScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredManagers.map((mgr) => {
                const isSelected = selectedManagerId === mgr.id;
                return (
                  <TouchableOpacity
                    key={mgr.id}
                    style={[
                      styles.managerOptionRow,
                      isSelected && styles.managerOptionRowSelected,
                    ]}
                    onPress={() => {
                      setSelectedManagerId(mgr.id);
                      setIsManagerModalOpen(false);
                      setManagerSearchQuery('');
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View
                      style={[
                        styles.managerAvatarCircle,
                        isSelected && styles.managerAvatarCircleSelected,
                      ]}
                    >
                      <Ionicons
                        name={mgr.id.includes('seller') ? 'person' : 'briefcase'}
                        size={16}
                        color={isSelected ? '#881337' : '#64748B'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          style={[
                            styles.managerOptionName,
                            isSelected && styles.managerOptionNameSelected,
                          ]}
                        >
                          {mgr.name}
                        </Text>
                        {isSelected && (
                          <View style={styles.selectedPillBadge}>
                            <Text style={styles.selectedPillBadgeText}>Selected</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.managerOptionEmail} numberOfLines={1}>
                        {mgr.email || mgr.role || 'Territory Lead'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'chevron-forward'}
                      size={20}
                      color={isSelected ? '#881337' : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                );
              })}
              {filteredManagers.length === 0 && (
                <View style={styles.emptyManagerContainer}>
                  <Ionicons name="person-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyManagerText}>
                    No managers found matching "{managerSearchQuery}"
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF9FA',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 12,
    backgroundColor: '#FBF9FA',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  batchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#881337',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  locationCard: {
    backgroundColor: '#FFF1F4',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#881337',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
  },
  storeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircleMaroon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#881337',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconCircleGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  fieldSection: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#881337',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  reqAsterisk: {
    color: '#E11D48',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 2,
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  phoneCountryBadge: {
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneCountryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownPlaceholderText: {
    color: '#881337',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF1F2',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  dropdownItemTextSelected: {
    color: '#881337',
    fontWeight: '700',
  },
  dropdownDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    opacity: 0.85,
  },
  dropdownDisabledText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
    lineHeight: 18,
  },
  photoDashedBox: {
    borderWidth: 1.5,
    borderColor: '#FDA4AF',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#FFFBFB',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDashedBoxActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
    borderStyle: 'solid',
  },
  photoPlaceholderCenter: {
    alignItems: 'center',
  },
  photoCameraIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#881337',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  photoTakeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#881337',
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
    paddingHorizontal: 14,
  },
  photoPreviewThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    marginRight: 12,
  },
  photoPreviewMeta: {
    flex: 1,
  },
  photoCapturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoCapturedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoActionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#881337',
  },
  photoActionDot: {
    marginHorizontal: 6,
    color: '#CBD5E1',
  },
  managerDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  managerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  managerTriggerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  managerTriggerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  managerTriggerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  managerTriggerSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  managerTriggerSearchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  categoryChipActive: {
    backgroundColor: '#881337',
    borderColor: '#881337',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addressBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniMap: {
    width: 64,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapRoadH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 14,
    height: 6,
    backgroundColor: '#CBD5E1',
  },
  mapRoadH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    height: 5,
    backgroundColor: '#CBD5E1',
  },
  mapRoadV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 24,
    width: 6,
    backgroundColor: '#CBD5E1',
  },
  mapRoadDiag: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    right: 14,
    width: 5,
    backgroundColor: '#CBD5E1',
    transform: [{ rotate: '30deg' }],
  },
  mapPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinShadow: {
    width: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: -2,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 18,
  },
  addressGpsCoordinates: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 2,
  },
  registerBtn: {
    backgroundColor: '#881337',
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  registerBtnDisabled: {
    opacity: 0.7,
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  managerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  managerListScroll: {
    maxHeight: 320,
  },
  managerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  managerOptionRowSelected: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FDA4AF',
  },
  managerAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  managerAvatarCircleSelected: {
    backgroundColor: '#FFE4E6',
  },
  managerOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  managerOptionNameSelected: {
    color: '#881337',
    fontWeight: '700',
  },
  selectedPillBadge: {
    backgroundColor: '#881337',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  selectedPillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  managerOptionEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emptyManagerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyManagerText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
});
