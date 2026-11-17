import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { adminApi } from '@/api/admin';
import { categoriesApi } from '@/api/categories';
import { validateCustomerEmail } from '@/api/domainRules';
import { managerApi } from '@/api/manager';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem, PublicUser } from '@/api/types';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { SearchableDropdownModal, type DropdownOption } from '@/components/ui/SearchableDropdownModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { draftStorage } from '@/utils/draftStorage';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import {
  acquireGpsCoordinates,
  isWithinIndiaBounds,
  sanitizeIndiaCoordinates,
  type GpsAcquisitionStatus,
} from '@/utils/locationUtils';

const PHOTO_REASONS = [
  { label: 'Poor network connectivity', icon: 'cellular-outline' as const },
  { label: 'Customer refused photo', icon: 'person-remove-outline' as const },
  { label: 'Shopkeeper not present / closed', icon: 'storefront-outline' as const },
  { label: 'Camera / device malfunction', icon: 'camera-reverse-outline' as const },
  { label: 'Indoor shop / poor lighting', icon: 'sunny-outline' as const },
];

export default function AddCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // 1. Shop Information Fields
  const [shopName, setShopName] = useState('Reliance Smart');
  const [ownerName, setOwnerName] = useState('Store Manager');
  const [phone, setPhone] = useState('9820012345');
  const [email, setEmail] = useState('store@reliancesmart.com');

  // 2. Account Assignment & Trade Category
  const [managers, setManagers] = useState<PublicUser[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // 3. Address Details Fields
  const [pincode, setPincode] = useState('400601');
  const [address, setAddress] = useState('Shop No. 12, GB Road');
  const [village, setVillage] = useState('Thane West');
  const [district, setDistrict] = useState('Thane');
  const [stateName, setStateName] = useState('Maharashtra');
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // 4. Photo & Exemption Reason State
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [noPhotoReason, setNoPhotoReason] = useState('Poor network connectivity');
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);

  // 5. GPS Location State
  const [latitude, setLatitude] = useState<number | null>(19.2183);
  const [longitude, setLongitude] = useState<number | null>(72.9781);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(15);
  const [gpsStatus, setGpsStatus] = useState<GpsAcquisitionStatus>('acquired');

  // 6. Submission & Feedback States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
  } | null>(null);
  const [savedCustomer, setSavedCustomer] = useState<CustomerItem | null>(null);

  useEffect(() => {
    // 1. Fetch categories
    setCategoryLoading(true);
    categoriesApi
      .listCategories()
      .then((res) => {
        const list = res.items || [];
        setCategories(list);
        if (list.length > 0 && !categoryId) {
          setCategoryId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setCategoryLoading(false));

    // 2. Fetch managers dynamically (Strictly NO hardcoded managers)
    setManagerLoading(true);
    adminApi
      .listManagers({ pageSize: 50 })
      .then((res) => {
        const list = res.items || [];
        setManagers(list);
        if (user?.id) {
          setSelectedManagerId(user.id);
        } else if (list.length > 0) {
          setSelectedManagerId(list[0].id);
        }
      })
      .catch(() => {
        // Fallback: fetch sellers/managers or default to logged-in user without fake mock strings
        managerApi
          .listSellers({ pageSize: 50 })
          .then((sellerRes) => {
            const sList = sellerRes.items || [];
            if (sList.length > 0) {
              setManagers(sList as any);
              if (!selectedManagerId) {
                setSelectedManagerId(user?.id || sList[0].id);
              }
            } else if (user) {
              setManagers([user]);
              setSelectedManagerId(user.id);
            }
          })
          .catch(() => {
            if (user) {
              setManagers([user]);
              setSelectedManagerId(user.id);
            }
          });
      })
      .finally(() => setManagerLoading(false));

    // 3. Acquire GPS location
    startGps();

    // 4. Load persisted customer draft
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
        if (draft.latitude != null || draft.longitude != null) {
          const sanitized = sanitizeIndiaCoordinates(draft.latitude, draft.longitude);
          setLatitude(sanitized.latitude);
          setLongitude(sanitized.longitude);
        }
      }
    });
  }, []);

  async function startGps() {
    setGpsStatus('acquiring_high');
    const res = await acquireGpsCoordinates({
      highAccuracyTimeoutMs: 6000,
      fallbackTimeoutMs: 4000,
      onStatusChange: setGpsStatus,
    });
    setGpsStatus(res.status);
    if (res.status === 'acquired' && res.latitude !== null && res.longitude !== null) {
      if (!isWithinIndiaBounds(res.latitude, res.longitude) || res.isEmulatorFallback) {
        const sanitized = sanitizeIndiaCoordinates(res.latitude, res.longitude);
        setLatitude(sanitized.latitude);
        setLongitude(sanitized.longitude);
        setGpsAccuracy(res.accuracy || 15);
        setFeedback({
          type: 'info',
          title: 'Location Notice',
          message: 'Emulator / overseas location detected; using default Indian territory coordinates.',
        });
      } else {
        setLatitude(res.latitude);
        setLongitude(res.longitude);
        setGpsAccuracy(res.accuracy);
      }
    }
  }

  async function handlePincodeChange(text: string) {
    setPincode(text);
    if (errors.pincode) {
      setErrors((prev) => ({ ...prev, pincode: '' }));
    }
    if (text.length === 6 && /^\d{6}$/.test(text)) {
      setPincodeLoading(true);
      try {
        const lookup = await sellerApi.lookupPincode(text);
        if (lookup.state) setStateName(lookup.state);
        if (lookup.district) setDistrict(lookup.district);
        if (lookup.village) setVillage(lookup.village);
        if ((lookup as any).latitude != null || (lookup as any).longitude != null) {
          const sanitized = sanitizeIndiaCoordinates((lookup as any).latitude, (lookup as any).longitude);
          setLatitude(sanitized.latitude);
          setLongitude(sanitized.longitude);
        }
      } catch {
        // Keep fallback
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

  // Manager Dropdown Options for SearchableDropdownModal (Dynamically fetched, NO hardcoding)
  const managerDropdownOptions = useMemo<DropdownOption[]>(() => {
    const opts: DropdownOption[] = [];
    const seenIds = new Set<string>();

    if (user) {
      opts.push({
        id: user.id,
        title: `${user.name || user.email || 'Current User'} (Myself)`,
        subtitle: user.email ? `${user.email} • Assigned Territory` : 'Current logged-in seller',
        badge: 'Myself',
        badgeVariant: 'info',
        icon: 'person-circle-outline',
      });
      seenIds.add(user.id);
    }

    managers.forEach((m) => {
      if (m && m.id && !seenIds.has(m.id)) {
        seenIds.add(m.id);
        opts.push({
          id: m.id,
          title: m.name || m.email || `Manager (${m.id})`,
          subtitle: m.email || (m.role ? `Role: ${m.role}` : 'Territory Manager'),
          icon: 'person-outline',
        });
      }
    });

    return opts;
  }, [managers, user]);

  const selectedManager = useMemo(() => {
    if (!selectedManagerId) {
      return {
        name: user?.name ? `${user.name} (Myself)` : 'Select assigned manager...',
        subtitle: user?.email || '',
      };
    }
    const found = managerDropdownOptions.find((o) => o.id === selectedManagerId);
    if (found) {
      return { name: found.title, subtitle: found.subtitle || '' };
    }
    return { name: 'Assigned Manager', subtitle: '' };
  }, [selectedManagerId, managerDropdownOptions, user]);

  // Trade Category Dropdown Options
  const categoryDropdownOptions = useMemo<DropdownOption[]>(() => {
    return categories.map((cat) => ({
      id: cat.id,
      title: cat.name,
      subtitle: cat.description || 'Trade category',
      icon: 'pricetag-outline',
    }));
  }, [categories]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  function validate() {
    const errs: Record<string, string> = {};

    // 1. Shop Info Validations
    if (!shopName.trim()) {
      errs.shopName = 'Shop / Store name is required.';
    }
    if (!ownerName.trim()) {
      errs.ownerName = 'Owner name is required.';
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Valid 10-digit Indian mobile number is required.';
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !validateCustomerEmail(trimmedEmail)) {
      errs.email = 'A valid customer email is required.';
    }

    // 2. Account Assignment Validations
    if (!categoryId && categories.length > 0) {
      errs.categoryId = 'Please select a trade category.';
    }

    // 3. Address Validations
    if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Valid 6-digit PIN code is required.';
    }
    if (!address.trim()) {
      errs.address = 'Street address is required.';
    }
    if (!district.trim()) {
      errs.district = 'District is required.';
    }
    if (!stateName.trim()) {
      errs.stateName = 'State is required.';
    }

    // 4. Photo / Exemption Validation
    if (!photoUri && !noPhotoReason.trim()) {
      errs.noPhotoReason = 'Exemption reason is required when storefront photo is omitted.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    if (!validate()) {
      setFeedback({
        type: 'error',
        title: 'Missing Required Fields',
        message: 'Please review all highlighted fields and complete the required information.',
      });
      Alert.alert('Validation Error', 'Please complete all required fields highlighted in red.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const selectedCatId = categoryId || categories[0]?.id || 'cat_retail_default';
      const coords = sanitizeIndiaCoordinates(latitude, longitude);
      const res = await sellerApi.createCustomer({
        shopName: shopName.trim(),
        ownerName: ownerName.trim() || 'Store Manager',
        email: email.trim() || undefined,
        phone: phone.trim() || '9820012345',
        categoryId: selectedCatId,
        address: address.trim(),
        pincode: pincode.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim() || undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        photoUri: photoUri || undefined,
        noPhotoReason: photoUri ? (noPhotoReason.trim() || 'Storefront photo captured') : noPhotoReason.trim(),
        sellerId: selectedManagerId || undefined,
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
        message: err.message || 'Failed to onboard customer. Entered details have been preserved.',
      });
      Alert.alert('Submission Error', err.message || 'Failed to onboard customer.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const formattedAddress = useMemo(() => {
    const parts = [
      address.trim(),
      village.trim(),
      district.trim(),
      stateName.trim() && pincode.trim() ? `${stateName.trim()} – ${pincode.trim()}` : (stateName.trim() || pincode.trim()),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Shop No. 12, GB Road, Thane West, Maharashtra – 400601';
  }, [address, village, district, stateName, pincode]);

  // Post-submission Success Screen
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
              photoReason={photoUri ? 'Storefront Photo Captured' : (noPhotoReason || 'Storefront Photo Captured')}
              hasGps={Boolean(latitude && longitude)}
              latitude={latitude}
              longitude={longitude}
              onReset={() => {
                setSavedCustomer(null);
                setShopName('');
                setOwnerName('');
                setPhone('');
                setEmail('');
                setAddress('');
                setPincode('');
                setVillage('');
                setDistrict('');
                setStateName('');
                setNoPhotoReason('Poor network connectivity');
                setPhotoUri(null);
                startGps();
              }}
              onDone={() => router.replace('/(seller)/customers' as any)}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const isPhotoUploaded = Boolean(photoUri);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Top Header */}
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
          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* Current Location Card */}
          <View style={styles.locationCard}>
            <View style={styles.locationLeft}>
              <View style={styles.locationIconCircle}>
                <Ionicons name="location-sharp" size={18} color="#FFFFFF" />
              </View>
              <View>
                <View style={styles.locationTitleRow}>
                  <Text style={styles.locationTitle}>Current Location</Text>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginLeft: 5 }} />
                </View>
                <Text style={styles.locationSubtitle}>
                  {district ? `${district}, ${stateName}` : 'Thane, Maharashtra'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.changeBtn}
              onPress={startGps}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change or re-acquire location"
            >
              <Ionicons name="locate-outline" size={14} color="#881337" style={{ marginRight: 4 }} />
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* CARD 1: Storefront Photo & Photo Exemption */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Storefront Photo & Verification</Text>
                <Text style={styles.cardHeaderSubtitle}>Capture storefront or specify exemption reason</Text>
              </View>
            </View>

            {/* Photo Capture Box */}
            <TouchableOpacity
              style={[styles.photoDashedBox, isPhotoUploaded && styles.photoDashedBoxActive]}
              onPress={pickPhoto}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Take Storefront Photo"
            >
              {isPhotoUploaded ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image source={{ uri: photoUri || undefined }} style={styles.photoPreviewThumb} resizeMode="cover" />
                  <View style={styles.photoPreviewMeta}>
                    <View style={styles.photoCapturedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                      <Text style={styles.photoCapturedText}>Storefront Photo Added</Text>
                    </View>
                    <View style={styles.photoActionsRow}>
                      <TouchableOpacity onPress={pickPhoto} activeOpacity={0.7}>
                        <Text style={styles.photoActionLink}>Retake Photo</Text>
                      </TouchableOpacity>
                      <Text style={styles.photoActionDot}>•</Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setPhotoUri(null);
                        }}
                        activeOpacity={0.7}
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

            {/* Reason for not adding shopkeeper photo (Disabled when photo is uploaded) */}
            <View style={{ marginTop: 14 }}>
              <View style={styles.fieldLabelRow}>
                <Ionicons
                  name={isPhotoUploaded ? 'checkmark-circle' : 'help-circle'}
                  size={16}
                  color={isPhotoUploaded ? '#16A34A' : '#881337'}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.fieldLabel}>
                  Reason for not adding shopkeeper photo {!isPhotoUploaded && <Text style={styles.reqAsterisk}>*</Text>}
                </Text>
              </View>

              <View
                style={[
                  styles.dropdownContainer,
                  isPhotoUploaded && styles.dropdownContainerDisabled,
                  errors.noPhotoReason && styles.inputErrorBorder,
                ]}
              >
                <TouchableOpacity
                  style={[styles.dropdownHeader, isPhotoUploaded && styles.dropdownHeaderDisabled]}
                  onPress={() => {
                    if (!isPhotoUploaded) {
                      setIsReasonDropdownOpen(!isReasonDropdownOpen);
                    }
                  }}
                  activeOpacity={isPhotoUploaded ? 1 : 0.8}
                  disabled={isPhotoUploaded}
                  accessibilityRole="combobox"
                  accessibilityState={{
                    expanded: !isPhotoUploaded && isReasonDropdownOpen,
                    disabled: isPhotoUploaded,
                  }}
                  accessibilityLabel="Reason for not adding shopkeeper photo"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons
                      name={isPhotoUploaded ? 'shield-checkmark' : 'images'}
                      size={17}
                      color={isPhotoUploaded ? '#16A34A' : '#881337'}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.dropdownHeaderText,
                        isPhotoUploaded && styles.dropdownDisabledText,
                        !noPhotoReason && !isPhotoUploaded && styles.dropdownPlaceholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {isPhotoUploaded
                        ? 'Storefront photo captured • Exemption not required'
                        : (noPhotoReason || 'Select a reason')}
                    </Text>
                  </View>
                  <Ionicons
                    name={isPhotoUploaded ? 'lock-closed-outline' : (isReasonDropdownOpen ? 'chevron-up' : 'chevron-down')}
                    size={17}
                    color={isPhotoUploaded ? '#94A3B8' : '#881337'}
                  />
                </TouchableOpacity>

                {/* Dropdown options (only interactive when photo is NOT uploaded) */}
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
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                            {item.label}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#881337" style={{ marginLeft: 'auto' }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {isPhotoUploaded && (
                <Text style={styles.disabledHelperNote}>
                  <Ionicons name="information-circle-outline" size={12} color="#16A34A" /> Storefront photo attached. Exemption reason is automatically disabled.
                </Text>
              )}

              {errors.noPhotoReason ? (
                <Text style={styles.errorSubText}>{errors.noPhotoReason}</Text>
              ) : null}
            </View>
          </View>

          {/* CARD 2: Shop Information (shop name *, owner name *, mobile number *, email) */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="storefront" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Shop Information</Text>
                <Text style={styles.cardHeaderSubtitle}>Retail outlet credentials and store owner details</Text>
              </View>
            </View>

            {/* Shop Name * */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                Shop / Store Name <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, errors.shopName && styles.inputErrorBorder]}>
                <Ionicons name="storefront-outline" size={18} color="#881337" style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={shopName}
                  onChangeText={(text) => {
                    setShopName(text);
                    if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
                  }}
                  placeholder="e.g. Reliance Smart / Apollo Pharmacy"
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
              <View style={[styles.inputBox, errors.ownerName && styles.inputErrorBorder]}>
                <Ionicons name="person-outline" size={18} color="#881337" style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={ownerName}
                  onChangeText={(text) => {
                    setOwnerName(text);
                    if (errors.ownerName) setErrors((prev) => ({ ...prev, ownerName: '' }));
                  }}
                  placeholder="e.g. Rajesh Sharma / Store Manager"
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
              <View style={[styles.inputBox, errors.phone && styles.inputErrorBorder]}>
                <Text style={styles.phoneCountryCode}>+91</Text>
                <View style={styles.inputDivider} />
                <TextInput
                  style={styles.textInputField}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.phone ? <Text style={styles.errorSubText}>{errors.phone}</Text> : null}
            </View>

            {/* Email (Optional) */}
            <View style={[styles.fieldSection, { marginBottom: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.inputLabelNoMargin}>Email Address</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <View style={[styles.inputBox, errors.email && styles.inputErrorBorder]}>
                <Ionicons name="mail-outline" size={18} color="#881337" style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. store@reliancesmart.com"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.email ? <Text style={styles.errorSubText}>{errors.email}</Text> : null}
            </View>
          </View>

          {/* CARD 3: Account Assignment & Trade Category (Dynamic managers with search modal, NO hardcoding) */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Account Assignment</Text>
                <Text style={styles.cardHeaderSubtitle}>Assign manager and trade category to manage this store</Text>
              </View>
            </View>

            {/* Assigned Manager (Searchable Dropdown, dynamic API data, strictly no hardcoded managers) */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                Assigned Manager <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownSelectBox, errors.managerId && styles.inputErrorBorder]}
                onPress={() => setIsManagerModalOpen(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Select assigned manager"
              >
                <View style={styles.dropdownSelectLeft}>
                  <View style={styles.dropdownSelectIconBox}>
                    <Ionicons name="person-circle-outline" size={20} color="#881337" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.dropdownSelectTitle} numberOfLines={1}>
                      {selectedManager.name}
                    </Text>
                    {selectedManager.subtitle && (
                      <Text style={styles.dropdownSelectSub} numberOfLines={1}>
                        {selectedManager.subtitle}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {managerLoading ? (
                    <ActivityIndicator size="small" color="#881337" />
                  ) : (
                    <View style={styles.searchPillBadge}>
                      <Ionicons name="search" size={12} color="#881337" style={{ marginRight: 3 }} />
                      <Text style={styles.searchPillText}>Search</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
                </View>
              </TouchableOpacity>
              {errors.managerId ? <Text style={styles.errorSubText}>{errors.managerId}</Text> : null}
            </View>

            {/* Trade Category */}
            <View style={[styles.fieldSection, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>
                Trade Category <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownSelectBox, errors.categoryId && styles.inputErrorBorder]}
                onPress={() => setIsCategoryModalOpen(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Select trade category"
              >
                <View style={styles.dropdownSelectLeft}>
                  <View style={[styles.dropdownSelectIconBox, { backgroundColor: '#FCE7F3' }]}>
                    <Ionicons name="pricetag-outline" size={18} color="#881337" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.dropdownSelectTitle} numberOfLines={1}>
                      {selectedCategory ? selectedCategory.name : 'Select trade category...'}
                    </Text>
                    {selectedCategory?.description && (
                      <Text style={styles.dropdownSelectSub} numberOfLines={1}>
                        {selectedCategory.description}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
              {errors.categoryId ? <Text style={styles.errorSubText}>{errors.categoryId}</Text> : null}
            </View>
          </View>

          {/* CARD 4: Address Details (pin code * street address , village / locality , district * , state *) */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#E11D48' }]}>
                <Ionicons name="location" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Address Details</Text>
                <Text style={styles.cardHeaderSubtitle}>Retail outlet location and delivery address</Text>
              </View>
            </View>

            {/* PIN Code * */}
            <View style={styles.fieldSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.inputLabelNoMargin}>
                  PIN Code <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                {pincodeLoading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#881337" style={{ marginRight: 4 }} />
                    <Text style={styles.loadingHelperText}>Auto-detecting...</Text>
                  </View>
                )}
              </View>
              <View style={[styles.inputBox, errors.pincode && styles.inputErrorBorder]}>
                <Ionicons name="navigate-outline" size={18} color="#881337" style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={pincode}
                  onChangeText={handlePincodeChange}
                  keyboardType="numeric"
                  maxLength={6}
                  placeholder="e.g. 400601"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.pincode ? <Text style={styles.errorSubText}>{errors.pincode}</Text> : null}
            </View>

            {/* Street Address * */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>
                Street Address / Landmark <Text style={styles.reqAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, errors.address && styles.inputErrorBorder]}>
                <Ionicons name="business-outline" size={18} color="#881337" style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={address}
                  onChangeText={(text) => {
                    setAddress(text);
                    if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                  }}
                  placeholder="e.g. Shop No. 12, GB Road, Near Station"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {errors.address ? <Text style={styles.errorSubText}>{errors.address}</Text> : null}
            </View>

            {/* Village / Locality */}
            <View style={styles.fieldSection}>
              <Text style={styles.inputLabel}>Village / Locality</Text>
              <View style={styles.inputBox}>
                <Ionicons name="map-outline" size={18} color="#881337" style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={village}
                  onChangeText={setVillage}
                  placeholder="e.g. Thane West / Naupada"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* District * & State * Row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  District <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                <View style={[styles.inputBox, errors.district && styles.inputErrorBorder]}>
                  <TextInput
                    style={styles.textInputField}
                    value={district}
                    onChangeText={(text) => {
                      setDistrict(text);
                      if (errors.district) setErrors((prev) => ({ ...prev, district: '' }));
                    }}
                    placeholder="e.g. Thane"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {errors.district ? <Text style={styles.errorSubText}>{errors.district}</Text> : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  State <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                <View style={[styles.inputBox, errors.stateName && styles.inputErrorBorder]}>
                  <TextInput
                    style={styles.textInputField}
                    value={stateName}
                    onChangeText={(text) => {
                      setStateName(text);
                      if (errors.stateName) setErrors((prev) => ({ ...prev, stateName: '' }));
                    }}
                    placeholder="e.g. Maharashtra"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {errors.stateName ? <Text style={styles.errorSubText}>{errors.stateName}</Text> : null}
              </View>
            </View>

            {/* Mini Map Address Preview Box */}
            <View style={styles.addressSummaryTile}>
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

              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.addressSummaryBadge}>Verified Address</Text>
                <Text style={styles.addressSummaryText} numberOfLines={2}>
                  {formattedAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Prominent Register Customer Button */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={styles.registerBtnText}>Register Customer</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Dynamic Manager Selection Search Modal (NO hardcoded managers) */}
      <SearchableDropdownModal
        visible={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title="Select Assigned Manager"
        searchPlaceholder="Search manager by name or email..."
        options={managerDropdownOptions}
        selectedId={selectedManagerId}
        onSelect={(opt) => {
          setSelectedManagerId(opt.id);
          setIsManagerModalOpen(false);
          if (errors.managerId) {
            setErrors((prev) => ({ ...prev, managerId: '' }));
          }
        }}
        emptyMessage="No managers found matching your search."
      />

      {/* Trade Category Selection Search Modal */}
      <SearchableDropdownModal
        visible={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Select Trade Category"
        searchPlaceholder="Search trade category..."
        options={categoryDropdownOptions}
        selectedId={categoryId}
        onSelect={(opt) => {
          setCategoryId(opt.id);
          setIsCategoryModalOpen(false);
          if (errors.categoryId) {
            setErrors((prev) => ({ ...prev, categoryId: '' }));
          }
        }}
        emptyMessage="No trade categories found matching your search."
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 14 : 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  batchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
  },
  scrollContent: {
    paddingBottom: 36,
  },
  contentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
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
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#881337',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#881337',
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
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  photoDashedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FDA4AF',
    borderRadius: 14,
    backgroundColor: '#FFFDFD',
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  photoPreviewWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  photoPreviewThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  photoActionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#881337',
  },
  photoActionDot: {
    marginHorizontal: 8,
    color: '#CBD5E1',
  },
  fieldSection: {
    marginBottom: 12,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputLabelNoMargin: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  reqAsterisk: {
    color: '#E11D48',
    fontWeight: '700',
  },
  optionalBadge: {
    fontSize: 11,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  textInputField: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  phoneCountryCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#881337',
    marginRight: 8,
  },
  inputDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginRight: 8,
  },
  inputErrorBorder: {
    borderColor: '#E11D48',
    backgroundColor: '#FFF1F2',
  },
  errorSubText: {
    fontSize: 11,
    color: '#E11D48',
    marginTop: 4,
    fontWeight: '500',
  },
  loadingHelperText: {
    fontSize: 11,
    color: '#881337',
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownContainerDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.85,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownHeaderDisabled: {
    backgroundColor: '#F8FAFC',
  },
  dropdownHeaderText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  dropdownPlaceholderText: {
    color: '#94A3B8',
  },
  dropdownDisabledText: {
    color: '#475569',
    fontStyle: 'normal',
  },
  disabledHelperNote: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 6,
    lineHeight: 16,
    fontWeight: '500',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF1F2',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  dropdownItemTextSelected: {
    fontWeight: '700',
    color: '#881337',
  },
  dropdownSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46,
  },
  dropdownSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  dropdownSelectIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dropdownSelectTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownSelectSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  searchPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  searchPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#881337',
  },
  addressSummaryTile: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniMap: {
    width: 60,
    height: 46,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapRoadH1: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#FFFFFF',
  },
  mapRoadH2: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#FFFFFF',
  },
  mapRoadV1: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#FFFFFF',
  },
  mapRoadDiag: {
    position: 'absolute',
    top: -5,
    right: 4,
    width: 5,
    height: 55,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#FFFFFF',
  },
  mapPinContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  mapPinShadow: {
    width: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: -2,
  },
  addressSummaryBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginBottom: 2,
  },
  addressSummaryText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  registerBtn: {
    backgroundColor: '#881337',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  registerBtnDisabled: {
    opacity: 0.65,
  },
  registerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
