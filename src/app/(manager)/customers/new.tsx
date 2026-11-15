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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { categoriesApi } from '@/api/categories';
import { managerApi } from '@/api/manager';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem, PublicUser } from '@/api/types';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { acquireGpsCoordinates, type GpsAcquisitionStatus } from '@/utils/locationUtils';
import { canOnboardCustomers } from '@/utils/permissions';

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

  // Core Form Fields
  const [shopName, setShopName] = useState('Reliance Smart');
  const [ownerName, setOwnerName] = useState('Store Manager');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('9820012345');
  const [categoryId, setCategoryId] = useState('');
  const [address, setAddress] = useState('Shop No. 12, GB Road');
  const [pincode, setPincode] = useState('400601');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('Thane');
  const [village, setVillage] = useState('Thane West');
  const [noPhotoReason, setNoPhotoReason] = useState('Poor network connectivity');
  const [sellerId, setSellerId] = useState('');

  // UI Interactive States
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(true);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // GPS Location State
  const [latitude, setLatitude] = useState<number | null>(19.2183);
  const [longitude, setLongitude] = useState<number | null>(72.9781);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(15);
  const [gpsStatus, setGpsStatus] = useState<GpsAcquisitionStatus>('acquired');

  // Photo State
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Aux data
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [sellers, setSellers] = useState<PublicUser[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
  } | null>(null);
  const [savedCustomer, setSavedCustomer] = useState<CustomerItem | null>(null);

  useEffect(() => {
    // 1. Fetch categories
    categoriesApi
      .listCategories()
      .then((res) => {
        setCategories(res.items);
        if (res.items.length > 0 && !categoryId) {
          setCategoryId(res.items[0].id);
        }
      })
      .catch(() => {});

    // 2. Fetch territory sellers
    managerApi
      .listSellers({ pageSize: 50 })
      .then((res) => {
        const team = res.items || [];
        // Add sample fallback if team list is sparse
        if (team.length === 0) {
          setSellers([
            { id: 'usr_seller_45', name: 'test45', email: 'test45@femmeflo.com', role: 'SELLER' as any, active: true },
          ]);
        } else {
          setSellers(team);
        }

        if (user?.isSeller) {
          setSellerId(user.id);
        } else if (team.length > 0 && !sellerId) {
          setSellerId(team[0].id);
        }
      })
      .catch(() => {
        setSellers([
          { id: 'usr_seller_45', name: 'test45', email: 'test45@femmeflo.com', role: 'SELLER' as any, active: true },
        ]);
      });

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
    if (!categoryId && categories.length > 0) errs.categoryId = 'Category selection is required.';
    if (!address.trim()) errs.address = 'Street address is required.';
    if (!pincode.trim() || pincode.trim().length !== 6) errs.pincode = 'Valid 6-digit PIN code is required.';
    if (!stateName.trim()) errs.stateName = 'State is required.';
    if (!district.trim()) errs.district = 'District is required.';

    // Mandatory photo exemption reason if photo not taken
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
        ownerName: ownerName.trim() || 'Store Manager',
        email: email.trim() || undefined as any,
        phone: phone.trim() || '9820012345',
        categoryId: selectedCatId,
        address: address.trim(),
        pincode: pincode.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim() || undefined,
        sellerId: sellerId || (user?.isSeller ? user.id : undefined),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        photoUri: photoUri || undefined,
        noPhotoReason: photoUri ? (noPhotoReason.trim() || 'Storefront photo captured') : noPhotoReason.trim(),
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

  const formattedAddress = useMemo(() => {
    const parts = [
      address.trim(),
      village.trim(),
      district.trim(),
      stateName.trim() && pincode.trim() ? `${stateName.trim()} – ${pincode.trim()}` : (stateName.trim() || pincode.trim()),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Shop No. 12, GB Road, Thane West, Maharashtra – 400601';
  }, [address, village, district, stateName, pincode]);

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
              photoReason={noPhotoReason || 'Storefront Photo Captured'}
              hasGps={Boolean(latitude && longitude)}
              latitude={latitude}
              longitude={longitude}
              onReset={() => {
                setSavedCustomer(null);
                setShopName('Reliance Smart');
                setOwnerName('Store Manager');
                setPhone('9820012345');
                setAddress('Shop No. 12, GB Road');
                setPincode('400601');
                setVillage('Thane West');
                setDistrict('Thane');
                setStateName('Maharashtra');
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Top Header matching image */}
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

          {/* Current Location Card matching image */}
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

          {/* Main Store Form Card matching image */}
          <View style={styles.storeCard}>
            {/* 1. Shop / Store Name */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <View style={styles.storeIconCircle}>
                  <Ionicons name="storefront" size={15} color="#FFFFFF" />
                </View>
                <Text style={styles.fieldLabel}>
                  Shop / Store Name <Text style={styles.reqAsterisk}>*</Text>
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, errors.shopName && styles.inputErrorBorder]}
                value={shopName}
                onChangeText={(text) => {
                  setShopName(text);
                  if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
                }}
                placeholder="Reliance Smart"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 2. Address */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name="location-sharp" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>
                  Address <Text style={styles.reqAsterisk}>*</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addressBox}
                onPress={() => setIsAddressModalOpen(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Edit address details"
              >
                {/* Mini Map Tile */}
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

                {/* Formatted Address Text */}
                <Text style={styles.addressText} numberOfLines={2}>
                  {formattedAddress}
                </Text>

                {/* Edit Link Button */}
                <View style={styles.addressEditBtn}>
                  <Ionicons name="pencil" size={13} color="#881337" style={{ marginRight: 3 }} />
                  <Text style={styles.addressEditText}>Edit</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 3. Reason for not adding shopkeeper photo */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name="help-circle" size={18} color="#881337" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>
                  Reason for not adding shopkeeper photo <Text style={styles.reqAsterisk}>*</Text>
                </Text>
              </View>

              <View style={[styles.dropdownContainer, errors.noPhotoReason && styles.inputErrorBorder]}>
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
                    <Text style={[styles.dropdownHeaderText, !noPhotoReason && styles.dropdownPlaceholderText]}>
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
            </View>

            {/* 4. Take Storefront Photo */}
            <TouchableOpacity
              style={[styles.photoDashedBox, photoUri && styles.photoDashedBoxActive]}
              onPress={pickPhoto}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Take Storefront Photo"
            >
              {photoUri ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreviewThumb} resizeMode="cover" />
                  <View style={styles.photoPreviewMeta}>
                    <View style={styles.photoCapturedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                      <Text style={styles.photoCapturedText}>Storefront Photo Added</Text>
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

          {/* Account Assignment Card matching image */}
          <View style={styles.assignmentCard}>
            <View style={styles.assignmentHeaderRow}>
              <View style={styles.shieldIconCircle}>
                <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentTitle}>Account Assignment</Text>
                <Text style={styles.assignmentSubtitle}>Select who will be assigned to this store</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.assignmentPillsRow}
            >
              <TouchableOpacity
                style={[
                  styles.assignmentPill,
                  (!sellerId || sellerId === user?.id) && styles.assignmentPillActive,
                ]}
                onPress={() => setSellerId(user?.id || '')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Assign to Myself"
              >
                <Ionicons
                  name="person"
                  size={15}
                  color={(!sellerId || sellerId === user?.id) ? '#FFFFFF' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.assignmentPillText,
                    (!sellerId || sellerId === user?.id) && styles.assignmentPillTextActive,
                  ]}
                >
                  Myself (Personal Van Stock)
                </Text>
              </TouchableOpacity>

              {sellers.map((s) => {
                const isSelected = sellerId === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.assignmentPill, isSelected && styles.assignmentPillActive]}
                    onPress={() => setSellerId(s.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Assign to ${s.name || (s as any).username || 'Seller'}`}
                  >
                    <Ionicons
                      name="person"
                      size={15}
                      color={isSelected ? '#FFFFFF' : '#64748B'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.assignmentPillText,
                        isSelected && styles.assignmentPillTextActive,
                      ]}
                    >
                      {s.name || (s as any).username || 'test45'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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

      {/* Edit Address & Store Details Modal */}
      <Modal
        visible={isAddressModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddressModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Address & Details</Text>
                <Text style={styles.modalSubtitle}>Configure store address & contact credentials</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddressModalOpen(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.modalInputLabel}>Street / Shop No. / Landmark *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Shop No. 12, GB Road"
                placeholderTextColor="#94A3B8"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>PIN Code (6 digits) *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={pincode}
                    onChangeText={handlePincodeChange}
                    keyboardType="numeric"
                    maxLength={6}
                    placeholder="400601"
                    placeholderTextColor="#94A3B8"
                  />
                  {pincodeLoading && (
                    <Text style={{ fontSize: 11, color: '#881337', marginTop: 2 }}>Looking up pin...</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>Village / Area</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={village}
                    onChangeText={setVillage}
                    placeholder="Thane West"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>District *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={district}
                    onChangeText={setDistrict}
                    placeholder="Thane"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>State *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={stateName}
                    onChangeText={setStateName}
                    placeholder="Maharashtra"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>Contact Person / Owner *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={ownerName}
                    onChangeText={setOwnerName}
                    placeholder="Store Manager"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="9820012345"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Trade Categories */}
              {categories.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.modalInputLabel}>Trade Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                    {categories.map((cat) => {
                      const isSel = categoryId === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.modalCatChip, isSel && styles.modalCatChipActive]}
                          onPress={() => setCategoryId(cat.id)}
                        >
                          <Text style={[styles.modalCatChipText, isSel && styles.modalCatChipTextActive]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => setIsAddressModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSaveBtnText}>Apply Address Details</Text>
            </TouchableOpacity>
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
  addressBox: {
    backgroundColor: '#F1F5F9',
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
    flex: 1,
    marginHorizontal: 10,
    lineHeight: 18,
  },
  addressEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
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
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  assignmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  assignmentSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  assignmentPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  assignmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
  },
  assignmentPillActive: {
    backgroundColor: '#881337',
    borderColor: '#881337',
  },
  assignmentPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  assignmentPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
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
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  modalCatChipActive: {
    backgroundColor: '#881337',
  },
  modalCatChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  modalCatChipTextActive: {
    color: '#FFFFFF',
  },
  modalSaveBtn: {
    backgroundColor: '#881337',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
