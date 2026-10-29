import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
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
import type { CategoryItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

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
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');

  // GPS Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'acquired' | 'denied' | 'failed'>('idle');

  // Photo State
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Categories
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // 1. Fetch categories
    categoriesApi
      .listCategories()
      .then((res) => {
        setCategories(res.items);
        if (res.items.length > 0) {
          setCategoryId(res.items[0].id);
        }
      })
      .catch(() => {});

    // 2. Automatically request foreground location
    acquireLocation();
  }, []);

  async function acquireLocation() {
    setGpsStatus('acquiring');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setGpsStatus('acquired');
    } catch {
      setGpsStatus('failed');
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
          const res = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!res.canceled && res.assets[0]?.uri) {
            setPhotoUri(res.assets[0].uri);
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
          const res = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!res.canceled && res.assets[0]?.uri) {
            setPhotoUri(res.assets[0].uri);
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
    if (!email.trim() || !validateCustomerEmail(email)) {
      errs.email = 'A valid customer email is required.';
    }
    if (!phone.trim() || phone.trim().length < 10) errs.phone = 'A valid 10-digit mobile number is required.';
    if (!categoryId) errs.categoryId = 'Please select a customer category.';
    if (!address.trim()) errs.address = 'Street address is required.';
    if (!pincode.trim() || pincode.trim().length !== 6) errs.pincode = 'A valid 6-digit PIN code is required.';
    if (!stateName.trim()) errs.stateName = 'State is required.';
    if (!district.trim()) errs.district = 'District is required.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!validate()) {
      Alert.alert('Validation Error', 'Please complete all required fields highlighted in red.');
      return;
    }

    setIsSubmitting(true);
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

      Alert.alert('Customer Onboarded', `${shopName} has been successfully registered.`, [
        {
          text: 'OK',
          onPress: () => router.replace('/(seller)/customers' as any),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Failed to save customer. Your entered details have been preserved.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Onboard Customer" subtitle="Register New Retail Outlet" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
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
                {gpsStatus === 'acquiring' ? (
                  <Text style={styles.gpsDesc}>Acquiring high-accuracy foreground location...</Text>
                ) : gpsStatus === 'acquired' ? (
                  <Text style={[styles.gpsDesc, { color: BrandColors.green.primary, fontWeight: '600' }]}>
                    Lat: {latitude?.toFixed(5)}, Lon: {longitude?.toFixed(5)}
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
                onPress={acquireLocation}
                disabled={gpsStatus === 'acquiring'}
                accessibilityRole="button"
                accessibilityLabel="Retry acquiring GPS location"
                hitSlop={HitSlop.md}
                style={({ pressed }) => [styles.gpsRetryBtn, pressed && styles.gpsRetryBtnPressed]}
              >
                {gpsStatus === 'acquiring' ? (
                  <ActivityIndicator size="small" color={BrandColors.pink.primary} />
                ) : (
                  <Ionicons name="refresh" size={20} color={BrandColors.pink.primary} />
                )}
              </Pressable>
            </View>
          </Card>

          {/* Store Information */}
          <Text style={styles.sectionHeading}>Business Details</Text>
          <Card style={styles.formCard}>
            <Input
              label="Shop / Business Name *"
              placeholder="e.g. Balaji Medical & General Store"
              value={shopName}
              onChangeText={setShopName}
              error={errors.shopName}
              leftIcon={<Ionicons name="storefront-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Proprietor / Owner Name *"
              placeholder="e.g. Ramesh Patel"
              value={ownerName}
              onChangeText={setOwnerName}
              error={errors.ownerName}
              leftIcon={<Ionicons name="person-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Customer Email Address * (Mandatory)"
              placeholder="e.g. balajimedical@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              helperText="Required for invoicing and sales confirmation notifications"
              leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Primary Contact Mobile *"
              placeholder="e.g. 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone}
              leftIcon={<Ionicons name="call-outline" size={18} color="#94A3B8" />}
            />

            {/* Category Picker */}
            <Text style={styles.pickerLabel}>Customer Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${cat.name} category`}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {errors.categoryId ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#B4234D" style={{ marginRight: 4 }} />
                <Text style={styles.errorText}>{errors.categoryId}</Text>
              </View>
            ) : null}
          </Card>

          {/* Address Information */}
          <Text style={styles.sectionHeading}>Geographic Location</Text>
          <Card style={styles.formCard}>
            <Input
              label="PIN Code *"
              placeholder="e.g. 380001"
              value={pincode}
              onChangeText={handlePincodeChange}
              keyboardType="number-pad"
              maxLength={6}
              error={errors.pincode}
              leftIcon={<Ionicons name="navigate-outline" size={18} color="#94A3B8" />}
              rightIcon={
                pincodeLoading ? (
                  <ActivityIndicator size="small" color={BrandColors.pink.primary} />
                ) : null
              }
            />

            <Input
              label="State *"
              placeholder="e.g. Gujarat"
              value={stateName}
              onChangeText={setStateName}
              error={errors.stateName}
            />

            <Input
              label="District *"
              placeholder="e.g. Ahmedabad"
              value={district}
              onChangeText={setDistrict}
              error={errors.district}
            />

            <Input
              label="Village / Ward / Area (Optional)"
              placeholder="e.g. Navrangpura"
              value={village}
              onChangeText={setVillage}
            />

            <Input
              label="Shop Address / Landmark *"
              placeholder="Shop No. 4, Opposite Bus Stand..."
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              error={errors.address}
            />
          </Card>

          {/* Storefront Photograph (Optional) */}
          <Text style={styles.sectionHeading}>Storefront Photo (Optional)</Text>
          <Card style={styles.formCard}>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change storefront photograph"
                  style={styles.changePhotoBtn}
                  onPress={pickPhoto}
                  hitSlop={HitSlop.md}
                >
                  <Ionicons name="camera-reverse-outline" size={16} color={BrandColors.pink.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Capture or upload store photo"
                style={({ pressed }) => [styles.photoUploadBox, pressed && styles.photoUploadBoxPressed]}
                onPress={pickPhoto}
              >
                <View style={styles.photoIconCircle}>
                  <Ionicons name="camera-outline" size={28} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.photoUploadText}>Tap to Capture or Upload Store Photo</Text>
                <Text style={styles.photoUploadHint}>Camera capture or gallery selection</Text>
              </Pressable>
            )}
          </Card>

          {/* Submit Button */}
          <Button
            title={isSubmitting ? 'Registering Customer...' : 'Save & Onboard Customer'}
            onPress={handleSubmit}
            loading={isSubmitting}
            size="lg"
            icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
            style={styles.submitBtn}
          />
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
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  gpsCard: {
    backgroundColor: Colors.light.surfaceMuted,
    borderColor: Colors.light.border,
    marginBottom: Spacing.md,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpsInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  gpsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  gpsTitle: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  gpsDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  gpsRetryBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  gpsRetryBtnPressed: {
    backgroundColor: Colors.light.backgroundElement,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  formCard: {
    marginBottom: Spacing.md,
  },
  pickerLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Radius.full,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  categoryChipActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  categoryChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.light.danger,
    fontWeight: '600',
  },
  photoPreviewContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.primary,
  },
  changePhotoText: {
    ...Typography.bodySmall,
    color: BrandColors.pink.primary,
    fontWeight: '600',
  },
  photoUploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceMuted,
  },
  photoUploadBoxPressed: {
    backgroundColor: Colors.light.backgroundElement,
  },
  photoIconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  photoUploadText: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
    marginBottom: 2,
  },
  photoUploadHint: {
    ...Typography.caption,
    color: Colors.light.textMuted,
  },
  submitBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
});
