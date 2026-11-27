import { categoriesApi } from '@/api/categories';
import { validateCustomerEmail } from '@/api/domainRules';
import { managerApi } from '@/api/manager';
import type { CategoryItem, CustomerItem, PublicUser } from '@/api/types';
import { CustomerOnboardingForm } from '@/components/customers/CustomerOnboardingForm';
import { EmptyState } from '@/components/ui/EmptyState';
import type { FeedbackType } from '@/components/ui/FeedbackBanner';
import type { DropdownOption } from '@/components/ui/SearchableDropdownModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useShopLocationAddress } from '@/hooks/useShopLocationAddress';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { isWithinIndiaBounds, sanitizeIndiaCoordinates } from '@/utils/locationUtils';
import { canOnboardCustomers } from '@/utils/permissions';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ManagerAddCustomerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // 1. Shop Details Fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // 2. Assignee (Manager + assigned sellers) & Trade Category
  const [teamSellers, setTeamSellers] = useState<PublicUser[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>(user?.id || '');
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // 3. Shop Photo & Exemption
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [noPhotoReason, setNoPhotoReason] = useState('');
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);

  // 4. Submission & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
  } | null>(null);
  const [savedCustomer, setSavedCustomer] = useState<CustomerItem | null>(null);

  // 5. Shared Location & Manual Address Controller
  const shopLoc = useShopLocationAddress({
    initialDistrict: user?.district || '',
    initialState: user?.state || 'Maharashtra',
    autoFetchOnMount: true,
    onNotice: (notice) =>
      setFeedback(
        notice.message.includes('Emulator')
          ? {
              ...notice,
              message: 'Emulator / overseas location detected; using default Indian territory coordinates.',
            }
          : notice
      ),
  });

  const {
    locationMode,
    pincode,
    pincodeStatus,
    address,
    streetName,
    landmark,
    village,
    district,
    stateName,
    latitude,
    longitude,
    gpsAccuracy,
    gpsStatus,
    isGeocodingManual,
    combinedFullAddress,
    formattedAddress,
  } = shopLoc;

  useEffect(() => {
    setCategoryLoading(true);
    categoriesApi
      .listCategories()
      .then((res) => {
        const list = res.items || [];
        setCategories(list);
        if (list.length > 0) {
          setCategoryId((prev) => prev || list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setCategoryLoading(false));

    // Fetch only this Manager's authorized team sellers (Manager is always first option)
    setManagerLoading(true);
    const currentUserId = user?.id;
    managerApi
      .listSellers({ pageSize: 50 })
      .then((res) => {
        const activeSellers = (res.items || []).filter((s) => s && s.active !== false);
        setTeamSellers(activeSellers);
        if (currentUserId) {
          setSelectedManagerId(currentUserId);
        } else if (activeSellers.length > 0) {
          setSelectedManagerId(activeSellers[0].id);
        }
      })
      .catch(() => {
        if (currentUserId) {
          setSelectedManagerId(currentUserId);
        }
      })
      .finally(() => setManagerLoading(false));
  }, [user?.id]);

  async function pickPhoto() {
    Alert.alert('Take Shop Photo', 'Choose Camera or Gallery', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera Needed', 'Please allow camera access in phone settings.');
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
            Alert.alert('Gallery Needed', 'Please allow photo access in phone settings.');
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

  const managerDropdownOptions = useMemo<DropdownOption[]>(() => {
    const opts: DropdownOption[] = [];
    const seenIds = new Set<string>();

    if (user) {
      opts.push({
        id: user.id,
        title: `${user.name || 'Manager'} (Myself)`,
        subtitle: user.district ? `Area: ${user.district}` : 'Your account',
        badge: 'Myself',
        badgeVariant: 'info',
        icon: 'person-circle-outline',
      });
      seenIds.add(user.id);
    }

    teamSellers.forEach((s) => {
      if (s && s.id && !seenIds.has(s.id)) {
        seenIds.add(s.id);
        opts.push({
          id: s.id,
          title: s.name || s.phone || 'Team Seller',
          subtitle: s.phone ? `${s.phone}${s.district ? ` · ${s.district}` : ''}` : s.district || 'Team Seller',
          badge: 'Seller',
          badgeVariant: 'neutral',
          icon: 'person-outline',
        });
      }
    });

    return opts;
  }, [teamSellers, user]);

  const selectedManager = useMemo(() => {
    if (selectedManagerId === user?.id && user) {
      return {
        name: `${user.name || 'Manager'} (Myself)`,
        subtitle: user.district ? `Area: ${user.district}` : 'Assigned to your account',
      };
    }
    const found = teamSellers.find((s) => s.id === selectedManagerId);
    if (found) {
      return {
        name: found.name || 'Team Seller',
        subtitle: found.phone || found.district || 'Assigned seller',
      };
    }
    return {
      name: user?.name ? `${user.name} (Myself)` : 'Select manager or seller',
      subtitle: undefined,
    };
  }, [selectedManagerId, teamSellers, user]);

  const categoryDropdownOptions = useMemo<DropdownOption[]>(() => {
    return categories.map((cat) => ({
      id: cat.id,
      title: cat.name,
      subtitle: cat.description || undefined,
      icon: 'pricetag-outline',
    }));
  }, [categories]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categoryId, categories]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!shopName.trim()) errs.shopName = 'Please enter shop name.';
    if (!ownerName.trim()) errs.ownerName = "Please enter owner's name.";
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Enter valid 10-digit mobile number.';
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !validateCustomerEmail(trimmedEmail)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!selectedManagerId) errs.managerId = 'Please select manager or seller.';
    if (!categoryId && categories.length > 0) errs.categoryId = 'Please select shop category.';
    if (!address.trim()) errs.address = 'Please enter shop address.';
    if (locationMode === 'MANUAL' && !streetName.trim()) {
      errs.streetName = 'Please enter street or road name.';
    }
    if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Enter 6-digit PIN code.';
    }
    if (!stateName.trim()) errs.stateName = 'Please enter state.';
    if (!district.trim()) errs.district = 'Please enter district.';

    if (!photoUri && !noPhotoReason.trim()) {
      errs.noPhotoReason = 'Please select why photo is not added.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!canOnboardCustomers(user)) {
      Alert.alert('Not Allowed', 'You do not have permission to add new shops.');
      return;
    }
    if (!validate()) {
      setFeedback({
        type: 'error',
        title: 'Please Check',
        message: 'Fill all required fields marked in red.',
      });
      Alert.alert('Please Check', 'Fill all required fields marked in red.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const selectedCatId = categoryId || categories[0]?.id || 'cat_retail_default';
      const resolvedCoords = await shopLoc.resolveCoordinatesForSubmit();
      const coords = sanitizeIndiaCoordinates(latitude, longitude);
      const effectiveLat =
        resolvedCoords.latitude ??
        (locationMode === 'CURRENT' && latitude != null && isWithinIndiaBounds(latitude, longitude ?? 0)
          ? coords.latitude
          : undefined);
      const effectiveLng =
        resolvedCoords.longitude ??
        (locationMode === 'CURRENT' && longitude != null && isWithinIndiaBounds(latitude ?? 0, longitude)
          ? coords.longitude
          : undefined);

      const res = await managerApi.createCustomer({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        categoryId: selectedCatId,
        streetName: streetName.trim() || undefined,
        address: combinedFullAddress || address.trim(),
        pincode: pincode.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim() || undefined,
        sellerId: selectedManagerId || (user?.isSeller ? user.id : undefined),
        latitude: effectiveLat,
        longitude: effectiveLng,
        accuracy: resolvedCoords.accuracy ?? (gpsAccuracy ?? undefined),
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
      const msg = err.message || 'Could not save shop. Please try again.';
      setFeedback({ type: 'error', title: 'Could Not Save', message: msg });
      Alert.alert('Could Not Save', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canOnboardCustomers(user)) {
    const headerTop = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 16) + 4;
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: headerTop }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Add New Shop</Text>
          </View>
        </View>

        <View style={styles.restrictedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="Access Restricted"
            description="You do not have permission to add new shops. Ask your Admin for access."
            iconColor={Colors.light.danger}
            iconBgColor={Colors.light.dangerBg}
            actionTitle="Back to Shops"
            buttonVariant="secondary"
            onAction={() => router.replace('/(manager)/customers' as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <CustomerOnboardingForm
      role="MANAGER"
      onBack={() => router.back()}
      onOpenBatchEntry={() => router.push('/(manager)/customers/bulk' as any)}
      locationMode={locationMode}
      onSelectCurrentLocation={() => {
        setFeedback(null);
        shopLoc.fetchCurrentLocation(true);
      }}
      onSelectManualAddress={() => {
        setFeedback(null);
        shopLoc.switchToManualMode();
      }}
      onClearManualAddress={() => {
        shopLoc.clearManualAddressFields();
        setErrors((prev) => ({
          ...prev,
          address: '',
          streetName: '',
          pincode: '',
          district: '',
          stateName: '',
        }));
      }}
      isGeocodingManual={isGeocodingManual}
      onLookupManualCoordinates={() => shopLoc.lookupManualCoordinates()}
      gpsStatus={gpsStatus}
      onRefreshLocation={() => shopLoc.fetchCurrentLocation(true)}
      latitude={latitude}
      longitude={longitude}
      photoUri={photoUri}
      onPickPhoto={pickPhoto}
      onRemovePhoto={() => setPhotoUri(null)}
      noPhotoReason={noPhotoReason}
      onSelectNoPhotoReason={(reason) => {
        setNoPhotoReason(reason);
        setIsReasonDropdownOpen(false);
        if (errors.noPhotoReason) setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
      }}
      isReasonDropdownOpen={isReasonDropdownOpen}
      onToggleReasonDropdown={() => setIsReasonDropdownOpen((prev) => !prev)}
      shopName={shopName}
      onChangeShopName={(text) => {
        setShopName(text);
        if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
      }}
      ownerName={ownerName}
      onChangeOwnerName={(text) => {
        setOwnerName(text);
        if (errors.ownerName) setErrors((prev) => ({ ...prev, ownerName: '' }));
      }}
      phone={phone}
      onChangePhone={(text) => {
        setPhone(text.replace(/[^0-9]/g, ''));
        if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
      }}
      email={email}
      onChangeEmail={(text) => {
        setEmail(text);
        if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
      }}
      selectedManagerName={selectedManager.name}
      selectedManagerSub={selectedManager.subtitle}
      canPickAssignee={managerDropdownOptions.length > 1}
      managerLoading={managerLoading}
      isManagerModalOpen={isManagerModalOpen}
      onOpenManagerModal={() => setIsManagerModalOpen(true)}
      onCloseManagerModal={() => setIsManagerModalOpen(false)}
      managerDropdownOptions={managerDropdownOptions}
      selectedManagerId={selectedManagerId}
      onSelectManager={(opt) => {
        setSelectedManagerId(opt.id);
        setIsManagerModalOpen(false);
        if (errors.managerId) setErrors((prev) => ({ ...prev, managerId: '' }));
      }}
      selectedCategory={selectedCategory}
      categoryLoading={categoryLoading}
      isCategoryModalOpen={isCategoryModalOpen}
      onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
      onCloseCategoryModal={() => setIsCategoryModalOpen(false)}
      categoryDropdownOptions={categoryDropdownOptions}
      categoryId={categoryId}
      onSelectCategory={(opt) => {
        setCategoryId(opt.id);
        setIsCategoryModalOpen(false);
        if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: '' }));
      }}
      pincode={pincode}
      onChangePincode={(text) => {
        if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: '' }));
        shopLoc.handlePincodeChange(text);
      }}
      pincodeStatus={pincodeStatus}
      address={address}
      onChangeAddress={(text) => {
        shopLoc.setAddress(text);
        if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
        shopLoc.scheduleManualGeocode({ address: text });
      }}
      streetName={streetName}
      onChangeStreetName={(text) => {
        shopLoc.setStreetName(text);
        if (errors.streetName) setErrors((prev) => ({ ...prev, streetName: '' }));
        shopLoc.scheduleManualGeocode({ streetName: text });
      }}
      landmark={landmark}
      onChangeLandmark={(text) => {
        shopLoc.setLandmark(text);
        shopLoc.scheduleManualGeocode({ landmark: text });
      }}
      village={village}
      onChangeVillage={(text) => {
        shopLoc.setVillage(text);
        shopLoc.scheduleManualGeocode({ village: text });
      }}
      district={district}
      onChangeDistrict={(text) => {
        shopLoc.setDistrict(text);
        if (errors.district) setErrors((prev) => ({ ...prev, district: '' }));
        shopLoc.scheduleManualGeocode({ district: text });
      }}
      stateName={stateName}
      onChangeStateName={(text) => {
        shopLoc.setStateName(text);
        if (errors.stateName) setErrors((prev) => ({ ...prev, stateName: '' }));
        shopLoc.scheduleManualGeocode({ state: text });
      }}
      formattedAddress={formattedAddress}
      errors={errors}
      feedback={feedback}
      onDismissFeedback={() => setFeedback(null)}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      savedCustomer={savedCustomer}
      onResetForm={() => {
        setSavedCustomer(null);
        setShopName('');
        setOwnerName('');
        setPhone('');
        setEmail('');
        shopLoc.resetFields(user?.district || '', user?.state || 'Maharashtra');
        setNoPhotoReason('');
        setPhotoUri(null);
        setErrors({});
        shopLoc.fetchCurrentLocation(false);
      }}
      onDoneAfterSave={() => router.replace('/(manager)/customers' as any)}
    />
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
    paddingHorizontal: 16,
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
