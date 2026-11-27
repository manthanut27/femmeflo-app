import { categoriesApi } from '@/api/categories';
import { validateCustomerEmail } from '@/api/domainRules';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem } from '@/api/types';
import { CustomerOnboardingForm } from '@/components/customers/CustomerOnboardingForm';
import type { FeedbackType } from '@/components/ui/FeedbackBanner';
import type { DropdownOption } from '@/components/ui/SearchableDropdownModal';
import { useAuth } from '@/context/AuthContext';
import { useShopLocationAddress } from '@/hooks/useShopLocationAddress';
import { draftStorage } from '@/utils/draftStorage';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { isWithinIndiaBounds, sanitizeIndiaCoordinates } from '@/utils/locationUtils';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

export default function AddCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // 1. Shop Details Fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // 2. Trade Category (Seller is strictly assigned to themselves per backend rules)
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

    draftStorage.clearCustomerDraft().catch(() => {});
  }, []);

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
  }, [categories, categoryId]);

  function validate() {
    const errs: Record<string, string> = {};

    if (!shopName.trim()) {
      errs.shopName = 'Please enter shop name.';
    }
    if (!ownerName.trim()) {
      errs.ownerName = "Please enter owner's name.";
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Enter valid 10-digit mobile number.';
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !validateCustomerEmail(trimmedEmail)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!categoryId && categories.length > 0) {
      errs.categoryId = 'Please select shop category.';
    }
    if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Enter 6-digit PIN code.';
    }
    if (!address.trim()) {
      errs.address = 'Please enter shop address.';
    }
    if (locationMode === 'MANUAL' && !streetName.trim()) {
      errs.streetName = 'Please enter street or road name.';
    }
    if (!district.trim()) {
      errs.district = 'Please enter district.';
    }
    if (!stateName.trim()) {
      errs.stateName = 'Please enter state.';
    }
    if (!photoUri && !noPhotoReason.trim()) {
      errs.noPhotoReason = 'Please select why photo is not added.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;

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

      const res = await sellerApi.createCustomer({
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
        latitude: effectiveLat,
        longitude: effectiveLng,
        accuracy: resolvedCoords.accuracy ?? (gpsAccuracy ?? undefined),
        photoUri: photoUri || undefined,
        noPhotoReason: photoUri
          ? noPhotoReason.trim() || 'Storefront photo captured'
          : noPhotoReason.trim(),
        sellerId: user?.id || undefined,
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
      const msg = err.message || 'Could not save shop. Please try again.';
      setFeedback({
        type: 'error',
        title: 'Could Not Save',
        message: msg,
      });
      Alert.alert('Could Not Save', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CustomerOnboardingForm
      role="SELLER"
      onBack={() => router.back()}
      onOpenBatchEntry={() => router.push('/(seller)/customers/bulk' as any)}
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
      selectedManagerName={user?.name ? `${user.name} (You)` : 'Your Account'}
      canPickAssignee={false}
      managerLoading={false}
      isManagerModalOpen={false}
      onOpenManagerModal={() => {}}
      onCloseManagerModal={() => {}}
      managerDropdownOptions={[]}
      selectedManagerId={user?.id || ''}
      onSelectManager={() => {}}
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
      onDoneAfterSave={() => router.replace('/(seller)/customers' as any)}
    />
  );
}
