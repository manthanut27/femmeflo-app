import { categoriesApi } from '@/api/categories';
import type { CategoryItem, CustomerItem, SaleItem, UpdateCustomerPayload } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { DropdownOption, SearchableDropdownModal } from '@/components/ui/SearchableDropdownModal';
import {
  BrandColors,
  Colors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface StoreDetailViewProps {
  role: 'seller' | 'manager' | 'admin';
  customerId?: string;
  getCustomer: (id: string) => Promise<{ customer: CustomerItem }>;
  updateCustomer: (id: string, payload: UpdateCustomerPayload) => Promise<{ customer: CustomerItem }>;
  uploadPhoto: (id: string, fileUri: string) => Promise<{ photoUrl: string }>;
  listSales?: (params: { customerId: string; pageSize?: number }) => Promise<{ items: SaleItem[] }>;
  backRoute: string;
  canCreateSale?: boolean;
  salesRoutePrefix?: string;
}

interface CustomerFormData {
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  categoryId: string;
}

export function StoreDetailView({
  role,
  customerId: propCustomerId,
  getCustomer,
  updateCustomer,
  uploadPhoto,
  listSales,
  backRoute,
  canCreateSale = false,
  salesRoutePrefix = '/(seller)/sales',
}: StoreDetailViewProps) {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ id?: string }>();
  const customerId = propCustomerId || searchParams.id;

  const [customer, setCustomer] = useState<CustomerItem | null>(null);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Categories for dropdown
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Form state for in-place editing
  const [formData, setFormData] = useState<CustomerFormData>({
    shopName: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    village: '',
    district: '',
    state: '',
    pincode: '',
    categoryId: '',
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});

  // Initialize form data from customer object
  const initForm = useCallback((cust: CustomerItem) => {
    setFormData({
      shopName: cust.shopName || '',
      ownerName: cust.ownerName || cust.contactName || '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      village: cust.village || '',
      district: cust.district || '',
      state: cust.state || '',
      pincode: cust.pincode || '',
      categoryId: cust.categoryId || cust.category?.id || '',
    });
    setFormErrors({});
  }, []);

  // Load customer and sales dynamically
  const loadCustomerData = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [custRes, salesRes] = await Promise.all([
        getCustomer(customerId).catch((err) => {
          console.warn('[StoreDetailView] Failed to fetch customer:', err);
          return { customer: null as unknown as CustomerItem };
        }),
        listSales
          ? listSales({ customerId, pageSize: 10 }).catch((err) => {
              console.warn('[StoreDetailView] Failed to fetch sales:', err);
              return { items: [] };
            })
          : Promise.resolve({ items: [] }),
      ]);

      if (custRes?.customer) {
        setCustomer(custRes.customer);
        initForm(custRes.customer);
      }
      if (salesRes?.items) {
        setSales(salesRes.items);
      }
    } finally {
      setLoading(false);
    }
  }, [customerId, getCustomer, listSales, initForm]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Load categories lazily or when entering edit mode
  const ensureCategories = useCallback(async () => {
    if (categories.length > 0) return;
    try {
      const res = await categoriesApi.listCategories();
      if (res?.items) {
        setCategories(res.items);
      }
    } catch (err) {
      console.warn('[StoreDetailView] Failed to load trade categories:', err);
    }
  }, [categories.length]);

  const handleStartEditing = () => {
    if (!customer) return;
    initForm(customer);
    setSuccessBanner(null);
    setIsEditing(true);
    ensureCategories();
  };

  const handleCancelEditing = () => {
    if (!customer) return;
    initForm(customer);
    setIsEditing(false);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CustomerFormData, string>> = {};

    if (!formData.shopName.trim()) {
      errors.shopName = 'Store / Shop name is mandatory.';
    } else if (formData.shopName.trim().length < 2) {
      errors.shopName = 'Store name must be at least 2 characters.';
    }

    if (!formData.ownerName.trim()) {
      errors.ownerName = 'Owner / Proprietor name is mandatory.';
    } else if (formData.ownerName.trim().length < 2) {
      errors.ownerName = 'Owner name must be at least 2 characters.';
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!cleanPhone) {
      errors.phone = 'Mobile number is mandatory.';
    } else if (cleanPhone.length < 10) {
      errors.phone = 'Please enter a valid 10-digit mobile number.';
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    if (!formData.address.trim()) {
      errors.address = 'Street address is mandatory.';
    }

    const cleanPin = formData.pincode.replace(/\D/g, '');
    if (!cleanPin) {
      errors.pincode = 'PIN Code is mandatory.';
    } else if (cleanPin.length !== 6) {
      errors.pincode = 'PIN Code must be exactly 6 digits.';
    }

    if (!formData.district.trim()) {
      errors.district = 'District is mandatory.';
    }

    if (!formData.state.trim()) {
      errors.state = 'State is mandatory.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveChanges = async () => {
    if (!customer || !customerId) return;
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please complete all required fields correctly before saving.');
      return;
    }

    try {
      setSaving(true);
      const cleanPhone = formData.phone.trim();
      const formattedPhone = cleanPhone.startsWith('+')
        ? cleanPhone
        : `+91${cleanPhone.replace(/^0+/, '').slice(-10)}`;

      const payload: UpdateCustomerPayload = {
        shopName: formData.shopName.trim(),
        ownerName: formData.ownerName.trim(),
        phone: formattedPhone,
        email: formData.email.trim() || undefined,
        address: formData.address.trim(),
        village: formData.village.trim() || undefined,
        district: formData.district.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        categoryId: formData.categoryId || undefined,
      };

      const res = await updateCustomer(customerId, payload);
      const selectedCategory = categories.find((c) => c.id === formData.categoryId);

      const updatedCustomer: CustomerItem = {
        ...(res?.customer || customer),
        shopName: payload.shopName || customer.shopName,
        ownerName: payload.ownerName || customer.ownerName,
        phone: payload.phone || customer.phone,
        email: payload.email || customer.email,
        address: payload.address || customer.address,
        village: payload.village !== undefined ? payload.village : customer.village,
        district: payload.district || customer.district,
        state: payload.state || customer.state,
        pincode: payload.pincode || customer.pincode,
        categoryId: payload.categoryId || customer.categoryId,
        category: selectedCategory || (res?.customer?.category ?? customer.category),
      };

      setCustomer(updatedCustomer);
      initForm(updatedCustomer);
      setIsEditing(false);
      setSuccessBanner('Store details successfully updated.');
      Alert.alert('Success', 'Store profile details updated successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Unable to update store details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Image upload handling
  async function handleUpdatePhoto() {
    if (!customer?.id || uploadingPhoto) return;

    Alert.alert('Store Photograph', 'Select photo source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required to capture store photo.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            await doUploadPhoto(res.assets[0].uri);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery permission is required to select store photo.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            await doUploadPhoto(res.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function doUploadPhoto(uri: string) {
    if (!customer?.id) return;
    try {
      setUploadingPhoto(true);
      const compressed = await compressImage(uri);
      const res = await uploadPhoto(customer.id, compressed.uri);
      const newUrl = res.photoUrl || compressed.uri;
      setCustomer((prev) => (prev ? { ...prev, photoUrl: newUrl, photoPath: newUrl } : null));
      Alert.alert('Success', 'Storefront photo updated successfully.');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to upload storefront photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Quick actions
  function handleCall() {
    if (!customer?.phone) return;
    Linking.openURL(`tel:${customer.phone}`).catch(() => {
      Alert.alert('Unable to Call', `Phone dialer could not be opened for ${customer.phone}`);
    });
  }

  function handleEmail() {
    if (!customer?.email) return;
    Linking.openURL(`mailto:${customer.email}`).catch(() => {
      Alert.alert('Unable to Email', `Mail app could not be opened for ${customer.email}`);
    });
  }

  function handleOpenMaps() {
    if (customer?.latitude && customer?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Unable to Open Maps', 'Maps application could not be opened.');
      });
    }
  }

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const categoryDropdownOptions: DropdownOption[] = useMemo(() => {
    return categories.map((cat) => ({
      id: cat.id,
      title: cat.name,
      subtitle: cat.description || 'Trade category',
    }));
  }, [categories]);

  const selectedCategoryName = useMemo(() => {
    const matched = categories.find((c) => c.id === formData.categoryId);
    return matched?.name || customer?.category?.name || 'Retail';
  }, [categories, formData.categoryId, customer?.category?.name]);

  const shopPhotoUri = customer?.photoUrl || (customer as any)?.photoPath || null;

  if (loading) {
    return <LoadingState message="Loading store profile & ledger..." />;
  }

  if (!customer) {
    return (
      <View style={styles.container}>
        <Header title="Customer Details" showBack onBack={() => router.replace(backRoute as any)} />
        <View style={styles.centerContainer}>
          <EmptyState
            icon="storefront-outline"
            title="Customer Not Found"
            description="The requested retailer outlet record could not be found."
            actionTitle="Back to Stores"
            onAction={() => router.replace(backRoute as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={customer.shopName}
        subtitle={isEditing ? 'Editing Store Details' : 'Store Ledger & Profile'}
        showBack
        onBack={() => {
          if (isEditing) {
            Alert.alert('Discard Edits?', 'You have unsaved edits. Are you sure you want to cancel?', [
              { text: 'Keep Editing', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: handleCancelEditing },
            ]);
          } else {
            router.back();
          }
        }}
        rightAction={
          !isEditing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Details"
              style={({ pressed }) => [styles.headerEditBtn, pressed && styles.headerBtnPressed]}
              onPress={handleStartEditing}
              hitSlop={HitSlop.md}
            >
              <Ionicons name="pencil" size={16} color={BrandColors.pink.primary} />
              <Text style={styles.headerEditBtnText}>Edit</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
              style={({ pressed }) => [styles.headerCancelBtn, pressed && styles.headerBtnPressed]}
              onPress={handleCancelEditing}
              hitSlop={HitSlop.md}
            >
              <Text style={styles.headerCancelBtnText}>Cancel</Text>
            </Pressable>
          )
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {/* Success Banner */}
          {successBanner ? (
            <FeedbackBanner
              type="success"
              message={successBanner}
              onDismiss={() => setSuccessBanner(null)}
              style={styles.bannerSpacing}
            />
          ) : null}

          {/* Edit Mode Notice Strip */}
          {isEditing && (
            <View style={styles.editModeNotice}>
              <Ionicons name="information-circle" size={18} color="#0284C7" />
              <View style={{ flex: 1 }}>
                <Text style={styles.editModeNoticeTitle}>Edit Mode Active</Text>
                <Text style={styles.editModeNoticeSub}>
                  Modify store information below and tap Save Changes.
                </Text>
              </View>
            </View>
          )}

          {/* Storefront Photograph / Photo Action Banner */}
          <Card style={styles.cardSection}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="camera-outline" size={18} color={BrandColors.pink.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeading}>Storefront Photo</Text>
                <Text style={styles.cardSubheading}>Visual verification of physical retail outlet</Text>
              </View>
            </View>

            {shopPhotoUri ? (
              <View style={styles.photoContainer}>
                <Pressable
                  onPress={() => setPreviewModalVisible(true)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`View full storefront photograph for ${customer.shopName}`}
                >
                  <Image
                    source={{ uri: shopPhotoUri }}
                    style={styles.customerPhoto}
                    resizeMode="cover"
                  />
                  <View style={styles.photoOverlayBadge}>
                    <Ionicons name="storefront" size={13} color="#FFFFFF" />
                    <Text style={styles.photoOverlayText}>Storefront Photo</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.updatePhotoBtn}
                  onPress={handleUpdatePhoto}
                  disabled={uploadingPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Update Storefront Photo"
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={13} color="#FFFFFF" />
                      <Text style={styles.updatePhotoText}>Update Photo</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.noPhotoBanner}>
                <View style={styles.noPhotoIconCircle}>
                  <Ionicons name="storefront-outline" size={24} color={BrandColors.pink.primary} />
                </View>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.noPhotoTitle}>No Storefront Photo</Text>
                  <Text style={styles.noPhotoSubtitle} numberOfLines={2}>
                    {customer.noPhotoReason
                      ? `Exemption: ${customer.noPhotoReason}`
                      : 'Capture a storefront photo to verify this outlet.'}
                  </Text>
                </View>
                <Pressable
                  style={styles.addPhotoBtn}
                  onPress={handleUpdatePhoto}
                  disabled={uploadingPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Add Storefront Photo"
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={14} color="#FFFFFF" />
                      <Text style={styles.addPhotoBtnText}>Add Photo</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* Quick Contact Buttons (View Mode) */}
            {!isEditing && (
              <View style={styles.contactRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${customer.phone}`}
                  style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                  onPress={handleCall}
                  hitSlop={HitSlop.md}
                >
                  <Ionicons name="call" size={15} color="#FFFFFF" />
                  <Text style={styles.actionPillText}>Call</Text>
                </Pressable>

                {customer.email ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Email ${customer.email}`}
                    style={({ pressed }) => [styles.actionPill, styles.emailPill, pressed && styles.actionPillPressed]}
                    onPress={handleEmail}
                    hitSlop={HitSlop.md}
                  >
                    <Ionicons name="mail" size={15} color="#FFFFFF" />
                    <Text style={styles.actionPillText}>Email</Text>
                  </Pressable>
                ) : null}

                {customer.latitude && customer.longitude ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open store location in Maps"
                    style={({ pressed }) => [styles.actionPill, styles.mapsPill, pressed && styles.actionPillPressed]}
                    onPress={handleOpenMaps}
                    hitSlop={HitSlop.md}
                  >
                    <Ionicons name="navigate" size={15} color="#FFFFFF" />
                    <Text style={styles.actionPillText}>Navigate</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Card>

          {/* Card 1: Shop Information Card */}
          <Card style={styles.cardSection}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="business-outline" size={18} color={BrandColors.pink.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeading}>Shop Information</Text>
                <Text style={styles.cardSubheading}>Basic enterprise and proprietor identifiers</Text>
              </View>
              {!isEditing && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit Shop Information"
                  onPress={handleStartEditing}
                  hitSlop={HitSlop.sm}
                  style={styles.cardActionIconBtn}
                >
                  <Ionicons name="pencil-outline" size={16} color={BrandColors.pink.primary} />
                </Pressable>
              )}
            </View>

            {isEditing ? (
              <View style={styles.formContainer}>
                <Input
                  label="Shop Name *"
                  value={formData.shopName}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, shopName: val }));
                    if (formErrors.shopName) setFormErrors((prev) => ({ ...prev, shopName: undefined }));
                  }}
                  placeholder="Enter store / shop name"
                  error={formErrors.shopName}
                  leftIcon={<Ionicons name="storefront-outline" size={18} color="#64748B" />}
                />

                <Input
                  label="Owner / Proprietor Name *"
                  value={formData.ownerName}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, ownerName: val }));
                    if (formErrors.ownerName) setFormErrors((prev) => ({ ...prev, ownerName: undefined }));
                  }}
                  placeholder="Enter proprietor full name"
                  error={formErrors.ownerName}
                  leftIcon={<Ionicons name="person-outline" size={18} color="#64748B" />}
                />

                <Input
                  label="Mobile Number *"
                  value={formData.phone}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, phone: val }));
                    if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  maxLength={15}
                  error={formErrors.phone}
                  leftIcon={<Ionicons name="call-outline" size={18} color="#64748B" />}
                />

                <Input
                  label="Email Address"
                  value={formData.email}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, email: val }));
                    if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="name@example.com (optional)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={formErrors.email}
                  leftIcon={<Ionicons name="mail-outline" size={18} color="#64748B" />}
                />
              </View>
            ) : (
              <View style={styles.viewDetailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Shop Name</Text>
                  <Text style={styles.detailValueBold}>{customer.shopName}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Owner / Proprietor Name</Text>
                  <Text style={styles.detailValue}>{customer.ownerName || customer.contactName || 'Not specified'}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Mobile Number</Text>
                  <Text style={styles.detailValue}>{customer.phone || 'Not specified'}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Email Address</Text>
                  <Text style={styles.detailValue}>{customer.email || 'Not provided'}</Text>
                </View>
              </View>
            )}
          </Card>

          {/* Card 2: Location & Address Card */}
          <Card style={styles.cardSection}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="location-outline" size={18} color={BrandColors.pink.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeading}>Location & Address</Text>
                <Text style={styles.cardSubheading}>Physical address, territory, and geo-coordinates</Text>
              </View>
              {!isEditing && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit Location Details"
                  onPress={handleStartEditing}
                  hitSlop={HitSlop.sm}
                  style={styles.cardActionIconBtn}
                >
                  <Ionicons name="pencil-outline" size={16} color={BrandColors.pink.primary} />
                </Pressable>
              )}
            </View>

            {isEditing ? (
              <View style={styles.formContainer}>
                <Input
                  label="Street Address *"
                  value={formData.address}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, address: val }));
                    if (formErrors.address) setFormErrors((prev) => ({ ...prev, address: undefined }));
                  }}
                  placeholder="Building, street, landmark"
                  multiline
                  numberOfLines={2}
                  error={formErrors.address}
                  leftIcon={<Ionicons name="home-outline" size={18} color="#64748B" />}
                />

                <Input
                  label="PIN Code *"
                  value={formData.pincode}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, pincode: val }));
                    if (formErrors.pincode) setFormErrors((prev) => ({ ...prev, pincode: undefined }));
                  }}
                  placeholder="6-digit PIN code"
                  keyboardType="numeric"
                  maxLength={6}
                  error={formErrors.pincode}
                  leftIcon={<Ionicons name="pin-outline" size={18} color="#64748B" />}
                />

                <Input
                  label="Village / Locality"
                  value={formData.village}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, village: val }))}
                  placeholder="Village or locality area (optional)"
                  leftIcon={<Ionicons name="navigate-outline" size={18} color="#64748B" />}
                />

                <Input
                  label="District *"
                  value={formData.district}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, district: val }));
                    if (formErrors.district) setFormErrors((prev) => ({ ...prev, district: undefined }));
                  }}
                  placeholder="District"
                  error={formErrors.district}
                  leftIcon={<Ionicons name="map-outline" size={18} color="#64748B" />}
                />

                <Input
                  label="State *"
                  value={formData.state}
                  onChangeText={(val) => {
                    setFormData((prev) => ({ ...prev, state: val }));
                    if (formErrors.state) setFormErrors((prev) => ({ ...prev, state: undefined }));
                  }}
                  placeholder="State"
                  error={formErrors.state}
                  leftIcon={<Ionicons name="earth-outline" size={18} color="#64748B" />}
                />

                <View style={styles.gpsReadonlyBox}>
                  <Ionicons name="navigate-circle-outline" size={20} color="#64748B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gpsReadonlyTitle}>GPS Coordinates</Text>
                    <Text style={styles.gpsReadonlyValue}>
                      {customer.latitude && customer.longitude
                        ? `${customer.latitude.toFixed(6)}, ${customer.longitude.toFixed(6)}`
                        : 'No GPS coordinates recorded'}
                    </Text>
                    <Text style={styles.gpsReadonlyHint}>
                      GPS coordinates are locked to original onboarding location for audit integrity.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.viewDetailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Street Address</Text>
                  <Text style={styles.detailValue}>{customer.address || 'Not specified'}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Village / Locality</Text>
                  <Text style={styles.detailValue}>{customer.village || 'Not specified'}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>District & State</Text>
                  <Text style={styles.detailValue}>
                    {[customer.district, customer.state].filter(Boolean).join(', ') || 'Not specified'}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>PIN Code</Text>
                  <Text style={styles.detailValue}>{customer.pincode || 'Not specified'}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>GPS Coordinates</Text>
                  <Text style={styles.detailValue}>
                    {customer.latitude && customer.longitude
                      ? `${customer.latitude.toFixed(6)}, ${customer.longitude.toFixed(6)}`
                      : 'Coordinates not recorded'}
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {/* Card 3: Account Assignment & Trade Category Card */}
          <Card style={styles.cardSection}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="pricetag-outline" size={18} color={BrandColors.pink.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeading}>Account Assignment & Category</Text>
                <Text style={styles.cardSubheading}>Assigned sales officer and commercial trade category</Text>
              </View>
              {!isEditing && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit Trade Category"
                  onPress={handleStartEditing}
                  hitSlop={HitSlop.sm}
                  style={styles.cardActionIconBtn}
                >
                  <Ionicons name="pencil-outline" size={16} color={BrandColors.pink.primary} />
                </Pressable>
              )}
            </View>

            {isEditing ? (
              <View style={styles.formContainer}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Assigned Seller / Officer</Text>
                  <View style={styles.assignedUserBadge}>
                    <Ionicons name="person-circle-outline" size={20} color={BrandColors.pink.primary} />
                    <Text style={styles.assignedUserText}>
                      {customer.seller?.name || 'Assigned Officer'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.inputLabelCustom}>Trade Category *</Text>
                  <Pressable
                    style={styles.dropdownSelectorBox}
                    onPress={() => {
                      ensureCategories();
                      setIsCategoryModalOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Select Trade Category"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropdownSelectorText}>{selectedCategoryName}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </Pressable>
                  <Text style={styles.dropdownHelperText}>
                    Tap to change commercial trade classification
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.viewDetailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Assigned Seller / Officer</Text>
                  <View style={styles.badgeRow}>
                    <Ionicons name="person-outline" size={14} color="#64748B" />
                    <Text style={styles.detailValueBold}>
                      {customer.seller?.name || 'Assigned Officer'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Trade Category</Text>
                  <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                    <Badge
                      label={customer.category?.name || 'Retail Store'}
                      variant="info"
                      size="md"
                    />
                  </View>
                </View>
              </View>
            )}
          </Card>

          {/* In-Place Edit Action Buttons (Sticky/Card) */}
          {isEditing && (
            <Card style={styles.editActionsCard}>
              <Text style={styles.editActionsHeading}>Confirm or Discard Edits</Text>
              <Text style={styles.editActionsSubheading}>
                Review details before saving. All changes will be saved to the database.
              </Text>
              <View style={styles.editButtonsRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="md"
                  onPress={handleCancelEditing}
                  disabled={saving}
                  style={styles.actionBtnFlex}
                />
                <Button
                  title={saving ? 'Saving...' : 'Save Changes'}
                  variant="primary"
                  size="md"
                  onPress={handleSaveChanges}
                  loading={saving}
                  disabled={saving}
                  icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
                  style={styles.actionBtnFlex}
                />
              </View>
            </Card>
          )}

          {/* Action: Create New Sale for this customer */}
          {!isEditing && canCreateSale && (
            <Button
              title={`Create New Sale for ${customer.shopName.split(' ')[0]}`}
              variant="primary"
              size="lg"
              onPress={() => {
                router.push({
                  pathname: '/(seller)/sales/new' as any,
                  params: { customerId: customer.id, customerName: customer.shopName },
                });
              }}
              icon={<Ionicons name="cart-outline" size={20} color="#FFFFFF" />}
              style={{ marginBottom: Spacing.xl }}
            />
          )}

          {/* Recent Store Ledger / Orders Section */}
          {!isEditing && (
            <View style={styles.ledgerSection}>
              <View style={styles.ledgerHeaderRow}>
                <View>
                  <Text style={styles.sectionHeading}>Recent Store Ledger</Text>
                  <Text style={styles.sectionSubheading}>Past transactions & recorded invoices</Text>
                </View>
                <Badge label={`${sales.length} orders`} variant="neutral" size="sm" />
              </View>

              {sales.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title="No Orders Recorded"
                  description="No past orders found for this customer. Tap below to create their first sale."
                  actionTitle={canCreateSale ? 'New Store Sale' : undefined}
                  onAction={
                    canCreateSale
                      ? () => {
                          router.push({
                            pathname: '/(seller)/sales/new' as any,
                            params: { customerId: customer.id, customerName: customer.shopName },
                          });
                        }
                      : undefined
                  }
                />
              ) : (
                sales.map((sale) => (
                  <Card
                    key={sale.id}
                    onPress={() => {
                      if (role === 'seller') {
                        router.push(`${salesRoutePrefix}/${sale.id}` as any);
                      }
                    }}
                    accessibilityLabel={`Order ${sale.saleNumber || sale.id.slice(0, 8)}, ${formatRupees(sale.totalAmountPaise)}, status ${sale.status}`}
                    accessibilityHint="Tap to view order details"
                    style={styles.saleCard}
                  >
                    <View style={styles.saleHeader}>
                      <View>
                        <Text style={styles.saleNumber}>
                          {sale.saleNumber || `Order #${sale.id.slice(0, 8)}`}
                        </Text>
                        <Text style={styles.saleDate}>
                          {new Date(sale.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Badge label={sale.status} variant={sale.status as any} />
                    </View>

                    <View style={styles.saleFooter}>
                      <Text style={styles.packetCount}>
                        {sale.packetCount ?? (sale as any).quantity ?? 0} packets
                      </Text>
                      <Text style={styles.saleAmount}>
                        {formatRupees(sale.totalAmountPaise ?? (sale as any).totalPaise ?? 0)}
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fullscreen Photo Preview Modal */}
      {shopPhotoUri ? (
        <Modal
          visible={previewModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {customer.shopName}
                </Text>
                <Text style={styles.modalSub}>Storefront Photograph</Text>
              </View>
              <Pressable
                onPress={() => setPreviewModalVisible(false)}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close photo preview"
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={styles.modalImageContainer}>
              <Image source={{ uri: shopPhotoUri }} style={styles.modalImage} resizeMode="contain" />
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Trade Category Selection Search Modal */}
      <SearchableDropdownModal
        visible={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Select Trade Category"
        searchPlaceholder="Search trade category..."
        options={categoryDropdownOptions}
        selectedId={formData.categoryId}
        onSelect={(opt) => {
          setFormData((prev) => ({ ...prev, categoryId: opt.id }));
          setIsCategoryModalOpen(false);
          if (formErrors.categoryId) {
            setFormErrors((prev) => ({ ...prev, categoryId: undefined }));
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
    backgroundColor: Colors.light.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  bannerSpacing: {
    marginBottom: Spacing.md,
  },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BrandColors.pink.tint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  headerEditBtnText: {
    color: BrandColors.pink.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  headerCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
  },
  headerCancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
  headerBtnPressed: {
    opacity: 0.7,
  },
  editModeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  editModeNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  editModeNoticeSub: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 1,
  },
  cardSection: {
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  cardSubheading: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  cardActionIconBtn: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.tint,
  },
  formContainer: {
    gap: Spacing.sm,
  },
  viewDetailsGrid: {
    gap: Spacing.md,
  },
  detailItem: {
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 10,
    color: Colors.light.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  detailValueBold: {
    fontSize: 15,
    color: Colors.light.heading,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  assignedUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignedUserText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  inputLabelCustom: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  dropdownSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  dropdownSelectorText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
  },
  dropdownHelperText: {
    fontSize: 11,
    color: Colors.light.textMuted,
    marginTop: 4,
  },
  gpsReadonlyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  gpsReadonlyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  gpsReadonlyValue: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.pink.primary,
    marginTop: 2,
  },
  gpsReadonlyHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  customerPhoto: {
    width: '100%',
    height: 190,
    borderRadius: Radius.md,
  },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  photoOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  updatePhotoBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(233, 30, 99, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    ...Shadows.sm,
  },
  updatePhotoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  noPhotoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.tint,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  noPhotoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  noPhotoTitle: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  noPhotoSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BrandColors.pink.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  addPhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.full,
    gap: 6,
    ...Shadows.sm,
  },
  actionPillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  emailPill: {
    backgroundColor: Colors.light.info,
  },
  mapsPill: {
    backgroundColor: BrandColors.green.primary,
  },
  actionPillText: {
    color: '#FFFFFF',
    ...Typography.caption,
    fontWeight: '700',
  },
  editActionsCard: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  editActionsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9F1239',
  },
  editActionsSubheading: {
    fontSize: 12,
    color: '#BE123C',
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  editButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtnFlex: {
    flex: 1,
  },
  ledgerSection: {
    marginTop: Spacing.xs,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  sectionSubheading: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  saleCard: {
    marginBottom: Spacing.sm,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  saleNumber: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  saleDate: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  packetCount: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  saleAmount: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.pink.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    marginTop: 40,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
  },
});
