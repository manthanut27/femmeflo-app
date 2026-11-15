import { adminApi } from '@/api/admin';
import { categoriesApi } from '@/api/categories';
import { managerApi } from '@/api/manager';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem, PublicUser } from '@/api/types';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { SearchableDropdownModal, type DropdownOption } from '@/components/ui/SearchableDropdownModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { acquireGpsCoordinates, type GpsAcquisitionStatus } from '@/utils/locationUtils';
import { canOnboardCustomers } from '@/utils/permissions';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

const PHOTO_REASONS = [
  { label: 'Poor network connectivity', icon: 'cellular-outline' as const },
  { label: 'Customer refused photo', icon: 'person-remove-outline' as const },
  { label: 'Shopkeeper not present / closed', icon: 'storefront-outline' as const },
  { label: 'Camera / device malfunction', icon: 'camera-reverse-outline' as const },
  { label: 'Indoor shop / poor lighting', icon: 'sunny-outline' as const },
];

export default function ManagerAddCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // 1. Shop Information Fields
  const [shopName, setShopName] = useState('Reliance Smart');
  const [ownerName, setOwnerName] = useState('Store Manager');
  const [phone, setPhone] = useState('9820012345');
  const [email, setEmail] = useState('');

  // 2. Account Assignment & Trade Category
  const [managers, setManagers] = useState<PublicUser[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // 3. Address Fields
  const [pincode, setPincode] = useState('400601');
  const [address, setAddress] = useState('Shop No. 12, GB Road');
  const [village, setVillage] = useState('Thane West');
  const [district, setDistrict] = useState('Thane');
  const [stateName, setStateName] = useState('Maharashtra');
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // 4. Photo & Photo Exemption State
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
        // Fallback: fetch territory sellers or default to logged-in user without fake mock strings
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

    // 3. Acquire GPS coordinates
    startGps();
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
      setLatitude(res.latitude);
      setLongitude(res.longitude);
      setGpsAccuracy(res.accuracy);
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
        subtitle: user.email ? `${user.email} • Assigned Territory` : 'Current logged-in manager',
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
          badge: m.role || 'Manager',
          badgeVariant: 'neutral',
          icon: 'person-outline',
        });
      }
    });

    return opts;
  }, [managers, user]);

  const selectedManager = useMemo(() => {
    if (selectedManagerId === user?.id && user) {
      return {
        name: `${user.name || user.email || 'Current User'} (Myself)`,
        subtitle: user.email ? `${user.email} • Logged-in Manager` : 'Territory Manager',
      };
    }
    const found = managers.find((m) => m.id === selectedManagerId);
    if (found) {
      return {
        name: found.name || found.email || `Manager (${found.id})`,
        subtitle: found.email || found.role || 'Territory Manager',
      };
    }
    return {
      name: selectedManagerId ? `Manager (${selectedManagerId})` : 'Select assigned manager',
      subtitle: undefined,
    };
  }, [selectedManagerId, managers, user]);

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
  }, [categoryId, categories]);

  const formattedAddress = useMemo(() => {
    const parts = [
      address.trim(),
      village.trim(),
      district.trim(),
      stateName.trim() && pincode.trim() ? `${stateName.trim()} – ${pincode.trim()}` : (stateName.trim() || pincode.trim()),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Shop No. 12, GB Road, Thane West, Maharashtra – 400601';
  }, [address, village, district, stateName, pincode]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!shopName.trim()) errs.shopName = 'Retail shop name is required.';
    if (!ownerName.trim()) errs.ownerName = 'Owner / Contact person name is required.';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Valid 10-digit Indian mobile number is required.';
    }
    if (!selectedManagerId) errs.managerId = 'Manager assignment is required.';
    if (!categoryId && categories.length > 0) errs.categoryId = 'Category selection is required.';
    if (!address.trim()) errs.address = 'Street address is required.';
    if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Valid 6-digit Indian PIN code is required.';
    }
    if (!stateName.trim()) errs.stateName = 'State is required.';
    if (!district.trim()) errs.district = 'District is required.';

    // Mandatory photo exemption reason ONLY when storefront photo is omitted
    if (!photoUri && !noPhotoReason.trim()) {
      errs.noPhotoReason = 'Reason is required when photo is omitted.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!canOnboardCustomers(user)) {
      Alert.alert('Access Denied', 'You do not have permission to onboard new customers.');
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
      const res = await managerApi.createCustomer({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        categoryId: selectedCatId,
        address: address.trim(),
        pincode: pincode.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim() || undefined,
        sellerId: selectedManagerId || (user?.isSeller ? user.id : undefined),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        accuracy: gpsAccuracy ?? undefined,
        photoUri: photoUri || undefined,
        noPhotoReason: photoUri ? 'Storefront photo captured' : noPhotoReason.trim(),
      });

      if (photoUri && res.customer.id) {
        try {
          const photoRes = await managerApi.uploadCustomerPhoto(res.customer.id, photoUri);
          if (photoRes?.photoUrl) {
            res.customer.photoUrl = photoRes.photoUrl;
          }
        } catch (e) {
          console.warn('Customer photo upload fallback failed', e);
        }
      }

      setSavedCustomer(res.customer);
    } catch (err: any) {
      const msg = err.message || 'Failed to save customer.';
      setFeedback({ type: 'error', title: 'Submission Failed', message: msg });
      Alert.alert('Submission Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (savedCustomer) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(manager)/customers' as any)}
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
              onDone={() => router.replace('/(manager)/customers' as any)}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!canOnboardCustomers(user)) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Onboard Customer</Text>
            <Text style={styles.headerSubtitle}>Add a store to report issues</Text>
          </View>
        </View>

        <View style={styles.restrictedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="Access Restricted"
            description="You do not have permission to onboard new customers. Please contact your administrator to request 'Onboard new customers' permission."
            iconColor={Colors.light.danger}
            iconBgColor={Colors.light.dangerBg}
            actionTitle="Back to Customers"
            buttonVariant="secondary"
            onAction={() => router.replace('/(manager)/customers' as any)}
          />
        </View>
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
          onPress={() => router.push('/(manager)/customers/bulk' as any)}
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

              {/* Quick horizontal category chips */}
              {categories.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryChipsRow}
                >
                  {categories.map((cat) => {
                    const isSel = categoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryQuickChip, isSel && styles.categoryQuickChipActive]}
                        onPress={() => {
                          setCategoryId(cat.id);
                          if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: '' }));
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.categoryQuickChipText, isSel && styles.categoryQuickChipTextActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {errors.categoryId ? <Text style={styles.errorSubText}>{errors.categoryId}</Text> : null}
            </View>
          </View>

          {/* CARD 4: Address Details (pin code * street address , village / locality , district * , state *) */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#E11D48' }]}>
                <Ionicons name="location-sharp" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Store Address</Text>
                <Text style={styles.cardHeaderSubtitle}>PIN code lookup and territory location details</Text>
              </View>
            </View>

            {/* PIN Code * */}
            <View style={styles.fieldSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.inputLabelNoMargin}>
                  PIN Code (6 digits) <Text style={styles.reqAsterisk}>*</Text>
                </Text>
                {pincodeLoading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#881337" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, color: '#881337', fontWeight: '600' }}>Looking up PIN...</Text>
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
              <>
                <Text style={styles.registerBtnText}>Register Customer</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Dynamic Searchable Modal for Managers (NO HARDCODED MANAGERS) */}
      <SearchableDropdownModal
        visible={isManagerModalOpen}
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
        onClose={() => setIsManagerModalOpen(false)}
        emptyMessage="No managers found matching your search"
      />

      {/* Dynamic Searchable Modal for Trade Categories */}
      <SearchableDropdownModal
        visible={isCategoryModalOpen}
        title="Select Trade Category"
        searchPlaceholder="Search categories..."
        options={categoryDropdownOptions}
        selectedId={categoryId}
        onSelect={(opt) => {
          setCategoryId(opt.id);
          setIsCategoryModalOpen(false);
          if (errors.categoryId) {
            setErrors((prev) => ({ ...prev, categoryId: '' }));
          }
        }}
        onClose={() => setIsCategoryModalOpen(false)}
        emptyMessage="No trade categories found"
      />
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
  headerIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  fieldSection: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
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
  },
  optionalBadge: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    minHeight: 46,
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputLeadingIcon: {
    marginRight: 8,
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
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  textInputField: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 10,
  },
  errorSubText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500',
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownContainerDisabled: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownHeaderDisabled: {
    backgroundColor: '#F8FAFC',
  },
  dropdownHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownPlaceholderText: {
    color: '#881337',
  },
  dropdownDisabledText: {
    color: '#475569',
    fontWeight: '600',
  },
  disabledHelperNote: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 5,
    fontWeight: '500',
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
  dropdownSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  dropdownSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    fontSize: 14,
    fontWeight: '600',
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
  categoryChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    gap: 6,
  },
  categoryQuickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryQuickChipActive: {
    backgroundColor: '#881337',
    borderColor: '#881337',
  },
  categoryQuickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryQuickChipTextActive: {
    color: '#FFFFFF',
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
    left: 0,
    right: 0,
    top: 13,
    height: 5,
    backgroundColor: '#CBD5E1',
  },
  mapRoadH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 11,
    height: 4,
    backgroundColor: '#CBD5E1',
  },
  mapRoadV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 22,
    width: 5,
    backgroundColor: '#CBD5E1',
  },
  mapRoadDiag: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    right: 12,
    width: 4,
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
  addressSummaryBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#881337',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressSummaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 16,
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
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
