import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { categoriesApi } from '@/api/categories';
import { validateCustomerEmail } from '@/api/domainRules';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem } from '@/api/types';
import { ISTClock } from '@/components/common/ISTClock';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
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
import { draftStorage } from '@/utils/draftStorage';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { acquireGpsCoordinates, type GpsAcquisitionStatus } from '@/utils/locationUtils';

export default function AddCustomerScreen() {
  const router = useRouter();

  // Form Fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [noPhotoReason, setNoPhotoReason] = useState('');

  // GPS Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsAcquisitionStatus>('idle');

  // Photo State
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Categories
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  // Submission & Confirmation State
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

    // 2. Automatically request foreground location with high accuracy & fallback
    startGpsAcquisition();

    // 3. Restore customer draft if present
    draftStorage.getCustomerDraft().then((draft) => {
      if (draft && !shopName) {
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
        if (draft.noPhotoReason) setNoPhotoReason(draft.noPhotoReason);
        if (draft.photoUri) setPhotoUri(draft.photoUri);
      }
    });
  }, []);

  // Auto-save form draft on meaningful edits
  useEffect(() => {
    if (shopName || phone || ownerName) {
      const timer = setTimeout(() => {
        draftStorage.saveCustomerDraft(undefined, {
          shopName,
          ownerName,
          email,
          phone,
          categoryId,
          address,
          pincode,
          state: stateName,
          district,
          village,
          noPhotoReason,
          photoUri: photoUri || undefined,
          updatedAt: new Date().toISOString(),
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [shopName, ownerName, email, phone, categoryId, address, pincode, stateName, district, village, noPhotoReason, photoUri]);

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

  // Handle 6-digit pincode lookup
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
            Alert.alert('Permission Denied', 'Camera permission is required to capture store photo.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            const compressed = await compressImage(res.assets[0].uri);
            setPhotoUri(compressed.uri);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery access is required to choose a photo.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            const compressed = await compressImage(res.assets[0].uri);
            setPhotoUri(compressed.uri);
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
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !validateCustomerEmail(trimmedEmail)) {
      errs.email = 'A valid customer email is required.';
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'A valid 10-digit Indian mobile number is required.';
    }
    if (!categoryId) errs.categoryId = 'Please select a customer category.';
    if (!address.trim()) errs.address = 'Street address is required.';
    if (!pincode.trim() || pincode.trim().length !== 6) errs.pincode = 'A valid 6-digit PIN code is required.';
    if (!stateName.trim()) errs.stateName = 'State is required.';
    if (!district.trim()) errs.district = 'District is required.';

    // Business Rule: Photo Exemption Reason is mandatory if storefront photo is not uploaded
    if (!photoUri && !noPhotoReason.trim()) {
      errs.noPhotoReason = 'Photo exemption reason is mandatory when storefront photo is omitted.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
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
      const res = await sellerApi.createCustomer({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        categoryId,
        address: address.trim(),
        pincode: pincode.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        noPhotoReason: photoUri ? undefined : noPhotoReason.trim(),
      });

      const customerId = res.customer.id;

      // Upload photo if chosen (non-blocking fallback)
      if (photoUri && customerId) {
        try {
          await sellerApi.uploadCustomerPhoto(customerId, photoUri);
        } catch (photoErr) {
          console.warn('Customer photo upload failed, record preserved', photoErr);
        }
      }

      // Clear draft on success
      await draftStorage.clearCustomerDraft();
      setSavedCustomer(res.customer);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Failed to save customer. Your entered details have been preserved.',
      });
      Alert.alert('Submission Error', err.message || 'Failed to save customer. Your entered details have been preserved.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // If saved confirmation is active, show the confirmation screen
  if (savedCustomer) {
    return (
      <View style={styles.container}>
        <Header title="Customer Onboarding" subtitle="Retail Outlet Registered" />
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
                setShopName('');
                setOwnerName('');
                setEmail('');
                setPhone('');
                setAddress('');
                setPincode('');
                setVillage('');
                setNoPhotoReason('');
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Onboard Customer"
        subtitle="Register New Retail Outlet"
        showBack
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to batch customer onboarding"
            style={styles.batchSwitchBtn}
            onPress={() => router.push('/(seller)/customers/bulk' as any)}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="layers-outline" size={16} color={BrandColors.pink.dark} />
            <Text style={styles.batchSwitchText}>Batch Entry</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {/* Live IST Clock Header */}
          <ISTClock />

          {feedback ? (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              actionLabel={feedback.actionLabel}
              onAction={feedback.onAction}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: Spacing.md }}
            />
          ) : null}

          {/* GPS Location Status Banner */}
          <Card variant="outlined" style={styles.gpsCard}>
            <View style={styles.gpsRow}>
              <View style={styles.gpsInfo}>
                <View style={styles.gpsTitleRow}>
                  <Ionicons
                    name={gpsStatus === 'acquired' ? 'location' : 'location-outline'}
                    size={18}
                    color={gpsStatus === 'acquired' ? BrandColors.green.primary : BrandColors.pink.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.gpsTitle}>Retail GPS Coordinates</Text>
                </View>
                {gpsStatus === 'acquiring_high' ? (
                  <Text style={styles.gpsDesc}>Acquiring high-accuracy foreground location...</Text>
                ) : gpsStatus === 'acquiring_fallback' ? (
                  <Text style={styles.gpsDesc}>Refining position with balanced accuracy...</Text>
                ) : gpsStatus === 'acquired' ? (
                  <Text style={[styles.gpsDesc, { color: BrandColors.green.primary, fontWeight: '600' }]}>
                    Lat: {latitude?.toFixed(5)}, Lon: {longitude?.toFixed(5)}
                    {gpsAccuracy ? ` (±${Math.round(gpsAccuracy)}m)` : ''}
                  </Text>
                ) : gpsStatus === 'denied' ? (
                  <Text style={[styles.gpsDesc, { color: '#B4234D' }]}>
                    Location permission denied. Enter location details manually below.
                  </Text>
                ) : (
                  <Text style={styles.gpsDesc}>GPS coordinates unavailable. Tap refresh to retry.</Text>
                )}
              </View>

              <Pressable
                onPress={startGpsAcquisition}
                style={({ pressed }) => [styles.gpsRetryBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Retry GPS location acquisition"
              >
                <Ionicons name="refresh" size={18} color={BrandColors.pink.primary} />
              </Pressable>
            </View>
          </Card>

          {/* Storefront Photograph */}
          <Text style={styles.sectionHeading}>Store Photograph</Text>
          <Card style={styles.card}>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                <View style={styles.photoActions}>
                  <Button
                    title="Change Photo"
                    variant="secondary"
                    size="sm"
                    onPress={pickPhoto}
                    icon={<Ionicons name="camera-outline" size={16} color={BrandColors.pink.primary} />}
                  />
                  <Button
                    title="Remove"
                    variant="ghost"
                    size="sm"
                    onPress={() => setPhotoUri(null)}
                    icon={<Ionicons name="trash-outline" size={16} color={Colors.light.danger} />}
                  />
                </View>
              </View>
            ) : (
              <Pressable
                style={styles.photoPlaceholder}
                onPress={pickPhoto}
                accessibilityRole="button"
                accessibilityLabel="Take or upload storefront photo"
              >
                <View style={styles.cameraIconCircle}>
                  <Ionicons name="camera" size={28} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.photoPlaceholderTitle}>Take Storefront Photo</Text>
                <Text style={styles.photoPlaceholderSub}>
                  Upload store entrance/signboard or provide mandatory exemption reason below.
                </Text>
              </Pressable>
            )}

            {/* Mandatory Exemption Reason if Photo is missing */}
            {!photoUri && (
              <View style={styles.exemptionBox}>
                <Input
                  label="Mandatory Photo Exemption Reason *"
                  placeholder="e.g. Remote rural location, Owner unavailable, Device camera error"
                  value={noPhotoReason}
                  onChangeText={setNoPhotoReason}
                  error={errors.noPhotoReason}
                  leftIcon={<Ionicons name="document-text-outline" size={18} color="#94A3B8" />}
                />
                <Text style={styles.exemptionHint}>
                  Required by company policy whenever a storefront photograph is not attached.
                </Text>
              </View>
            )}
          </Card>

          {/* Outlet Business Details */}
          <Text style={styles.sectionHeading}>Outlet Information</Text>
          <Card style={styles.card}>
            <Input
              label="Shop / Store Name *"
              placeholder="e.g. Shree Ganesh General Stores"
              value={shopName}
              onChangeText={setShopName}
              error={errors.shopName}
              leftIcon={<Ionicons name="storefront-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Contact Person / Owner Name *"
              placeholder="e.g. Ramesh Patel"
              value={ownerName}
              onChangeText={setOwnerName}
              error={errors.ownerName}
              leftIcon={<Ionicons name="person-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Mobile Number *"
              placeholder="e.g. 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone}
              leftIcon={<Ionicons name="call-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Customer Email Address *"
              placeholder="e.g. ramesh@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
            />
          </Card>

          {/* Category Selection */}
          <Text style={styles.sectionHeading}>Trade Category</Text>
          <Card style={styles.card}>
            <Text style={styles.inputLabel}>Select Category *</Text>
            {errors.categoryId ? <Text style={styles.errorText}>{errors.categoryId}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoryId(cat.id)}
                    style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                  >
                    <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>

          {/* Location & Address */}
          <Text style={styles.sectionHeading}>Address & Territory</Text>
          <Card style={styles.card}>
            <Input
              label="PIN Code *"
              placeholder="e.g. 452001"
              value={pincode}
              onChangeText={handlePincodeChange}
              keyboardType="numeric"
              maxLength={6}
              error={errors.pincode}
              leftIcon={
                pincodeLoading ? (
                  <ActivityIndicator size="small" color={BrandColors.pink.primary} />
                ) : (
                  <Ionicons name="search-outline" size={18} color="#94A3B8" />
                )
              }
            />

            <Input
              label="Street Address / Shop No. *"
              placeholder="e.g. Shop 4, Main Market Road"
              value={address}
              onChangeText={setAddress}
              error={errors.address}
              leftIcon={<Ionicons name="home-outline" size={18} color="#94A3B8" />}
            />

            <View style={styles.twoColumn}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Input
                  label="Village / Ward"
                  placeholder="e.g. Rau"
                  value={village}
                  onChangeText={setVillage}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="District *"
                  placeholder="e.g. Indore"
                  value={district}
                  onChangeText={setDistrict}
                  error={errors.district}
                />
              </View>
            </View>

            <Input
              label="State *"
              placeholder="e.g. Madhya Pradesh"
              value={stateName}
              onChangeText={setStateName}
              error={errors.stateName}
            />
          </Card>

          {/* Submit Action */}
          <View style={styles.submitContainer}>
            <Button
              title="Register Customer"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleSubmit}
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
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl * 2,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
  },
  batchSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  batchSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
    marginLeft: 4,
  },
  sectionHeading: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  gpsCard: {
    padding: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.light.card,
    borderColor: Colors.light.border,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpsInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  gpsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gpsTitle: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  gpsDesc: {
    fontSize: Typography.caption.fontSize,
    color: Colors.light.textSecondary,
  },
  gpsRetryBtn: {
    padding: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.tint,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: BrandColors.pink.primary,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    backgroundColor: BrandColors.pink.tint,
  },
  cameraIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    ...Shadows.sm,
  },
  photoPlaceholderTitle: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  photoPlaceholderSub: {
    fontSize: Typography.caption.fontSize,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  photoPreviewContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  photoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  exemptionBox: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  exemptionHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontStyle: 'italic',
  },
  inputLabel: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    marginBottom: Spacing.xs,
  },
  errorText: {
    fontSize: Typography.caption.fontSize,
    color: Colors.light.danger,
    marginBottom: Spacing.xs,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    marginRight: Spacing.xs,
  },
  categoryChipSelected: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  categoryChipText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.light.textPrimary,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  twoColumn: {
    flexDirection: 'row',
  },
  submitContainer: {
    marginTop: Spacing.md,
  },
});
