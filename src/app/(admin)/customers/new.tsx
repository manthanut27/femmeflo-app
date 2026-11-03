import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import { categoriesApi } from '@/api/categories';
import { validateCustomerEmail } from '@/api/domainRules';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem, PublicUser } from '@/api/types';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
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
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { acquireGpsCoordinates, type GpsAcquisitionStatus } from '@/utils/locationUtils';
import {
  isSpeechRecognitionSupported,
  SpeechRecognizer,
  type SupportedSpeechLanguage,
} from '@/utils/voiceUtils';

const DEFAULT_CATEGORIES: Array<{ id: string; name: string }> = [
  { id: 'cat_chemist_default', name: 'Chemist / Pharmacy' },
  { id: 'cat_general_default', name: 'General Store' },
  { id: 'cat_retail_default', name: 'Retail Store' },
  { id: 'cat_supermarket_default', name: 'Supermarket' },
  { id: 'cat_wholesale_default', name: 'Wholesale / Distributor' },
];

const PHOTO_EXEMPTION_CHIPS = [
  'Poor network connectivity',
  'Customer refused photo',
  'Shopkeeper not present / closed',
  'Camera / device malfunction',
  'Indoor shop / poor lighting',
];

function formatISTDateFull(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-IN');
  }
}

function formatISTTimeFull(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date).toLowerCase();
  } catch {
    return date.toLocaleTimeString('en-IN');
  }
}

export default function AdminAddCustomerScreen() {
  const router = useRouter();

  // Form Fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [noPhotoReason, setNoPhotoReason] = useState('');

  // GPS Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsAcquisitionStatus>('idle');
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Photo State
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Aux data
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [sellers, setSellers] = useState<PublicUser[]>([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [sellerModalVisible, setSellerModalVisible] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');

  // Live IST Clock
  const [now, setNow] = useState(() => new Date());

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

  // Voice Dictation Modal State
  const [activeVoiceField, setActiveVoiceField] = useState<{
    key: 'shopName' | 'ownerName' | 'phone' | 'unitNumber' | 'streetName' | 'village';
    label: string;
  } | null>(null);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<SupportedSpeechLanguage>('hi-IN');
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Live IST Clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Voice Recognizer pulse animation
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (isVoiceListening) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      animLoop?.stop();
    };
  }, [isVoiceListening, pulseAnim]);

  // Load Categories, Sellers, and GPS
  useEffect(() => {
    // 1. Fetch categories
    categoriesApi
      .listCategories()
      .then((res) => {
        if (res.items && res.items.length > 0) {
          setCategories(res.items);
          if (!categoryId) setCategoryId(res.items[0].id);
        } else {
          setCategories(DEFAULT_CATEGORIES as any);
          if (!categoryId) setCategoryId(DEFAULT_CATEGORIES[0].id);
        }
      })
      .catch(() => {
        setCategories(DEFAULT_CATEGORIES as any);
        if (!categoryId) setCategoryId(DEFAULT_CATEGORIES[0].id);
      });

    // 2. Fetch sellers
    adminApi
      .listSellers({ pageSize: 50 })
      .then((res) => {
        setSellers(res.items || []);
        if (res.items && res.items.length > 0 && !sellerId) {
          setSellerId(res.items[0].id);
        }
      })
      .catch(() => {});

    // 3. Acquire GPS
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

  async function handleVerifyAddressLookup() {
    const parts = [unitNumber, streetName, address, village, district, stateName, pincode]
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      Alert.alert('Address Needed', 'Please enter a PIN code, street name, or district first.');
      return;
    }
    setIsGeocoding(true);
    try {
      const query = parts.join(', ');
      const results = await Location.geocodeAsync(query);
      if (results && results.length > 0) {
        setLatitude(results[0].latitude);
        setLongitude(results[0].longitude);
        setGpsAccuracy(25);
        setGpsStatus('acquired');
        Alert.alert(
          'Address Geocoded',
          `Coordinates verified:\nLatitude: ${results[0].latitude.toFixed(5)}\nLongitude: ${results[0].longitude.toFixed(5)}`
        );
      } else {
        Alert.alert('Lookup Result', 'Could not resolve exact coordinates for this address. Please use device GPS.');
      }
    } catch {
      Alert.alert('Lookup Notice', 'Network geocoding service is unavailable. Please use "Get Current Location".');
    } finally {
      setIsGeocoding(false);
    }
  }

  async function handlePincodeChange(text: string) {
    setPincode(text);
    if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: '' }));
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
            Alert.alert('Permission Denied', 'Camera permission is required.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            const compressed = await compressImage(res.assets[0].uri);
            setPhotoUri(compressed.uri);
            if (errors.noPhotoReason) setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
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
            if (errors.noPhotoReason) setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // Voice Dictation Methods
  function openVoiceModal(
    key: 'shopName' | 'ownerName' | 'phone' | 'unitNumber' | 'streetName' | 'village',
    label: string
  ) {
    setActiveVoiceField({ key, label });
    setVoiceTranscript('');
    setVoiceError(null);
    setVoiceModalVisible(true);
    startVoiceListening(voiceLang);
  }

  function startVoiceListening(lang: SupportedSpeechLanguage = 'hi-IN') {
    if (!recognizerRef.current) {
      recognizerRef.current = new SpeechRecognizer();
    }
    const recognizer = recognizerRef.current;
    if (!recognizer.isSupported()) {
      setVoiceError('Speech recognition is not supported in this browser/device. Please type manually.');
      return;
    }

    setVoiceError(null);
    recognizer
      .start(
        {
          onStart: () => setIsVoiceListening(true),
          onResult: (res) => {
            setVoiceTranscript(res.transcript);
          },
          onError: (err) => {
            setIsVoiceListening(false);
            setVoiceError(err);
          },
          onEnd: () => setIsVoiceListening(false),
        },
        lang
      )
      .catch((e) => {
        setIsVoiceListening(false);
        setVoiceError(e?.message || 'Failed to start speech recognition.');
      });
  }

  function stopVoiceListening() {
    recognizerRef.current?.stop();
    setIsVoiceListening(false);
  }

  function applyVoiceText() {
    stopVoiceListening();
    if (!activeVoiceField) {
      setVoiceModalVisible(false);
      return;
    }

    const { key } = activeVoiceField;
    let text = voiceTranscript.trim();

    if (key === 'phone') {
      const digitWords: Record<string, string> = {
        zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
        shunya: '0', ek: '1', do: '2', teen: '3', char: '4', paanch: '5', chhah: '6', saat: '7', aath: '8', nau: '9',
        '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
      };
      let lower = text.toLowerCase();
      for (const [w, d] of Object.entries(digitWords)) {
        lower = lower.replace(new RegExp(`\\b${w}\\b`, 'g'), d);
      }
      const digits = lower.replace(/\D/g, '').slice(-10);
      setPhone(digits);
      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
    } else if (key === 'shopName') {
      setShopName(text);
      if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
    } else if (key === 'ownerName') {
      setOwnerName(text);
      if (errors.ownerName) setErrors((prev) => ({ ...prev, ownerName: '' }));
    } else if (key === 'unitNumber') {
      setUnitNumber(text);
    } else if (key === 'streetName') {
      setStreetName(text);
      if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
    } else if (key === 'village') {
      setVillage(text);
    }

    setVoiceModalVisible(false);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!shopName.trim()) errs.shopName = 'Store name is required.';
    if (!ownerName.trim()) errs.ownerName = 'Shopkeeper name is required.';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Valid 10-digit Indian contact phone starting with 6-9 is required.';
    }
    if (email.trim() && !validateCustomerEmail(email.trim())) {
      errs.email = 'Please enter a valid email address or leave blank.';
    }
    if (!categoryId) errs.categoryId = 'Category selection is required.';

    const effectiveAddress = [unitNumber.trim(), streetName.trim(), address.trim()].filter(Boolean).join(', ');
    if (!effectiveAddress) errs.address = 'Street name / address is required.';
    if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Valid 6-digit Indian PIN code is required.';
    }
    if (!stateName.trim()) errs.stateName = 'State is required.';
    if (!district.trim()) errs.district = 'District is required.';

    if (!photoUri && !noPhotoReason.trim()) {
      errs.noPhotoReason = 'Reason for not adding shopkeeper photo is mandatory when photo is omitted.';
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
    const effectiveAddress = [unitNumber.trim(), streetName.trim(), address.trim()].filter(Boolean).join(', ');

    try {
      const res = await adminApi.createCustomer({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        categoryId,
        address: effectiveAddress,
        pincode: pincode.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        photoUri: photoUri || undefined,
        sellerId: sellerId || undefined,
        noPhotoReason: photoUri
          ? noPhotoReason.trim() || 'Storefront photo captured'
          : noPhotoReason.trim(),
      });

      if (photoUri && res.customer.id) {
        try {
          const photoRes = await adminApi.uploadCustomerPhoto(res.customer.id, photoUri);
          if (photoRes?.photoUrl) {
            res.customer.photoUrl = photoRes.photoUrl;
          }
        } catch (e) {
          console.warn('Customer photo upload fallback failed', e);
        }
      }

      setSavedCustomer(res.customer);
    } catch (err: any) {
      const msg = err.message || 'Failed to register customer.';
      setFeedback({ type: 'error', title: 'Registration Failed', message: msg });
      Alert.alert('Registration Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedSeller = sellers.find((s) => s.id === sellerId);
  const formattedDate = formatISTDateFull(now);
  const formattedTime = formatISTTimeFull(now);

  if (savedCustomer) {
    return (
      <View style={styles.container}>
        <View style={styles.breadcrumbBar}>
          <Pressable
            style={styles.breadcrumbLink}
            onPress={() => router.replace('/(admin)/customers' as any)}
          >
            <Ionicons name="arrow-back" size={14} color="#9F2545" />
            <Text style={styles.breadcrumbLinkText}>Back to customers</Text>
          </Pressable>
          <Text style={styles.breadcrumbDivider}>•</Text>
          <Text style={styles.breadcrumbCurrent}>Customer onboarding</Text>
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
                setShopName('');
                setOwnerName('');
                setEmail('');
                setPhone('');
                setUnitNumber('');
                setStreetName('');
                setAddress('');
                setPincode('');
                setVillage('');
                setNoPhotoReason('');
                setPhotoUri(null);
                startGps();
              }}
              onDone={() => router.replace('/(admin)/customers' as any)}
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {/* Breadcrumb Navigation */}
          <View style={styles.breadcrumbBar}>
            <Text style={styles.breadcrumbWorkspace}>Admin workspace / Customers</Text>
            <View style={styles.breadcrumbRow}>
              <Pressable
                style={styles.breadcrumbLink}
                onPress={() => router.replace('/(admin)/customers' as any)}
              >
                <Ionicons name="arrow-back" size={13} color="#9F2545" style={{ marginRight: 4 }} />
                <Text style={styles.breadcrumbLinkText}>Back to customers</Text>
              </Pressable>
              <Text style={styles.breadcrumbDivider}>•</Text>
              <Text style={styles.breadcrumbCurrent}>Customer onboarding</Text>
            </View>
          </View>

          {/* Page Title & Subtitle */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Add customer</Text>
            <Text style={styles.pageLead}>
              Create a verified customer / shop record with category, contact, photo, and geolocation coordinates.
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <View style={[styles.tabButton, styles.tabButtonActive]}>
              <Ionicons name="storefront" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.tabTextActive}>Single Shop Form</Text>
            </View>
            <Pressable
              style={styles.tabButton}
              onPress={() => router.push('/(admin)/customers/bulk' as any)}
              accessibilityRole="button"
              accessibilityLabel="Batch Entry 1 to N"
            >
              <Ionicons name="layers-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.tabTextInactive}>Batch Entry (1 to N)</Text>
            </Pressable>
          </View>

          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: Spacing.md }}
            />
          )}

          {/* Customer Information Header & Live IST Clock */}
          <Card style={styles.istCard}>
            <View style={styles.infoHeadRow}>
              <View>
                <Text style={styles.infoTitle}>Customer information</Text>
                <Text style={styles.infoSubtitle}>
                  Complete the required fields to save this record to the database
                </Text>
              </View>
            </View>

            <View style={styles.liveClockBox}>
              <View style={styles.liveClockTopRow}>
                <View style={styles.liveDotRow}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveClockLabel}>Live Indian Standard Time (IST)</Text>
                </View>
                <View style={styles.istBadge}>
                  <Text style={styles.istBadgeText}>IST</Text>
                </View>
              </View>
              <View style={styles.clockDisplayRow}>
                <Text style={styles.clockDateText}>{formattedDate}</Text>
                <Text style={styles.clockTimeText}>{formattedTime}</Text>
              </View>
              <View style={styles.clockCalloutNote}>
                <Text style={styles.clockCalloutIcon}>⏱️</Text>
                <Text style={styles.clockCalloutText}>
                  <Text style={{ fontWeight: '700' }}>Official Onboarding Timestamp:</Text> This live date and ticking time will be permanently saved with the shop record.
                </Text>
              </View>
            </View>
          </Card>

          {/* SECTION A: Shopkeeper & Store Details */}
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionTitle}>A. Shopkeeper & Store Details</Text>
            <Text style={styles.sectionSubtitle}>
              Core retail shopkeeper credentials and category classification
            </Text>
          </View>

          <Card style={styles.card}>
            {/* Timestamp Sub-banner in Section A */}
            <View style={styles.onboardingTimestampCallout}>
              <View style={styles.timestampRow}>
                <Ionicons name="time-outline" size={15} color="#9F2545" style={{ marginRight: 6 }} />
                <Text style={styles.timestampCalloutTitle}>Onboarding Timestamp (Live IST)</Text>
                <View style={styles.timestampPill}>
                  <Text style={styles.timestampPillText}>{formattedDate} · {formattedTime} IST</Text>
                </View>
              </View>
              <Text style={styles.timestampCalloutSub}>
                Synced live with Indian Standard Time. This timestamp is officially attached upon saving.
              </Text>
            </View>

            {/* Store name */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  Store name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Pressable
                  style={styles.voiceBtn}
                  onPress={() => openVoiceModal('shopName', 'Store Name')}
                  accessibilityRole="button"
                  accessibilityLabel="Voice input for Store Name"
                >
                  <Ionicons name="mic" size={13} color="#9F2545" />
                  <Text style={styles.voiceBtnText}>Voice</Text>
                </Pressable>
              </View>
              <Input
                placeholder="e.g. Balaji Medical & General Store"
                value={shopName}
                onChangeText={(t) => {
                  setShopName(t);
                  if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
                }}
                error={errors.shopName}
              />
            </View>

            {/* Shopkeeper name */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  Shopkeeper name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Pressable
                  style={styles.voiceBtn}
                  onPress={() => openVoiceModal('ownerName', 'Shopkeeper Name')}
                  accessibilityRole="button"
                  accessibilityLabel="Voice input for Shopkeeper Name"
                >
                  <Ionicons name="mic" size={13} color="#9F2545" />
                  <Text style={styles.voiceBtnText}>Voice</Text>
                </Pressable>
              </View>
              <Input
                placeholder="e.g. Ramesh Kumar Patel"
                value={ownerName}
                onChangeText={(t) => {
                  setOwnerName(t);
                  if (errors.ownerName) setErrors((prev) => ({ ...prev, ownerName: '' }));
                }}
                error={errors.ownerName}
              />
            </View>

            {/* Contact phone */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  Contact phone <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Pressable
                  style={styles.voiceBtn}
                  onPress={() => openVoiceModal('phone', 'Contact Phone')}
                  accessibilityRole="button"
                  accessibilityLabel="Voice input for Contact Phone"
                >
                  <Ionicons name="mic" size={13} color="#9F2545" />
                  <Text style={styles.voiceBtnText}>Voice</Text>
                </Pressable>
              </View>
              <Input
                placeholder="e.g. 9826012345"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                }}
                keyboardType="phone-pad"
                maxLength={10}
                error={errors.phone}
                leftIcon={<Text style={styles.phonePrefix}>+91</Text>}
              />
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  Category <Text style={styles.requiredStar}>*</Text>
                </Text>
                {selectedCategory && (
                  <Pressable onPress={() => setCategoryModalVisible(true)}>
                    <Text style={styles.browseAllText}>Browse all ({categories.length})</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsContainer}
              >
                {categories.slice(0, 8).map((cat) => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        setCategoryId(cat.id);
                        if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: '' }));
                      }}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'pricetag-outline'}
                        size={13}
                        color={isSelected ? '#FFFFFF' : '#64748B'}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {errors.categoryId ? <Text style={styles.fieldError}>{errors.categoryId}</Text> : null}
            </View>

            {/* Email address (optional) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email address (optional)</Text>
              <Input
                placeholder="e.g. store.patel@example.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />
            </View>

            {/* Assigned Field Officer */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Assigned Field Officer <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Pressable
                style={styles.pickerSelectorBox}
                onPress={() => setSellerModalVisible(true)}
              >
                <View style={styles.sellerDisplayRow}>
                  <Ionicons name="person-outline" size={16} color="#9F2545" style={{ marginRight: 8 }} />
                  <Text style={selectedSeller ? styles.pickerValueText : styles.pickerPlaceholderText}>
                    {selectedSeller
                      ? `${selectedSeller.name} (${selectedSeller.territory || 'Field operations'})`
                      : 'Select a field seller...'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </Pressable>
            </View>
          </Card>

          {/* SECTION B: Address & Auto-Fetch by PIN Code */}
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionTitle}>B. Address & Auto-Fetch by PIN Code</Text>
            <Text style={styles.sectionSubtitle}>
              Enter 6-digit Indian PIN code to automatically retrieve State, District & Village
            </Text>
          </View>

          <Card style={styles.card}>
            {/* PIN Code */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                PIN code (6 digits) <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Input
                placeholder="e.g. 411028"
                value={pincode}
                onChangeText={handlePincodeChange}
                keyboardType="numeric"
                maxLength={6}
                error={errors.pincode}
                rightIcon={
                  pincodeLoading ? (
                    <ActivityIndicator size="small" color="#9F2545" />
                  ) : pincode.length === 6 ? (
                    <Ionicons name="checkmark-circle" size={18} color={BrandColors.green.primary} />
                  ) : null
                }
              />
            </View>

            {/* Shop / Unit number (optional) */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Shop / Unit number (optional)</Text>
                <Pressable
                  style={styles.voiceBtn}
                  onPress={() => openVoiceModal('unitNumber', 'Shop / Unit number')}
                  accessibilityRole="button"
                  accessibilityLabel="Voice input for Shop / Unit number"
                >
                  <Ionicons name="mic" size={13} color="#9F2545" />
                  <Text style={styles.voiceBtnText}>Voice</Text>
                </Pressable>
              </View>
              <Input
                placeholder="e.g. Shop No 4, Gala 12, Ground Floor"
                value={unitNumber}
                onChangeText={setUnitNumber}
              />
            </View>

            {/* Street name / landmark (optional) */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Street name / landmark (optional)</Text>
                <Pressable
                  style={styles.voiceBtn}
                  onPress={() => openVoiceModal('streetName', 'Street name / landmark')}
                  accessibilityRole="button"
                  accessibilityLabel="Voice input for Street name / landmark"
                >
                  <Ionicons name="mic" size={13} color="#9F2545" />
                  <Text style={styles.voiceBtnText}>Voice</Text>
                </Pressable>
              </View>
              <Input
                placeholder="e.g. Near Old Bus Stand, Main Market Road"
                value={streetName}
                onChangeText={(t) => {
                  setStreetName(t);
                  if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                }}
                error={errors.address}
              />
            </View>

            {/* State & District Grid */}
            <View style={styles.rowGrid}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <Text style={styles.fieldLabel}>
                  State <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Input
                  placeholder="Maharashtra"
                  value={stateName}
                  onChangeText={(t) => {
                    setStateName(t);
                    if (errors.stateName) setErrors((prev) => ({ ...prev, stateName: '' }));
                  }}
                  error={errors.stateName}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>
                  District <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Input
                  placeholder="e.g. Pune"
                  value={district}
                  onChangeText={(t) => {
                    setDistrict(t);
                    if (errors.district) setErrors((prev) => ({ ...prev, district: '' }));
                  }}
                  error={errors.district}
                />
              </View>
            </View>

            {/* Village / Locality */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  Village / locality <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Pressable
                  style={styles.voiceBtn}
                  onPress={() => openVoiceModal('village', 'Village / locality')}
                  accessibilityRole="button"
                  accessibilityLabel="Voice input for Village / locality"
                >
                  <Ionicons name="mic" size={13} color="#9F2545" />
                  <Text style={styles.voiceBtnText}>Voice</Text>
                </Pressable>
              </View>
              <Input
                placeholder="e.g. Hadapsar"
                value={village}
                onChangeText={setVillage}
              />
            </View>
          </Card>

          {/* SECTION C: Live Location & Storefront Photo */}
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionTitle}>C. Live Location & Storefront Photo</Text>
            <Text style={styles.sectionSubtitle}>
              Record real-time device GPS coordinates and attach storefront photo
            </Text>
          </View>

          <Card style={styles.card}>
            {/* Storefront Photo Box */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Upload / capture shop photo</Text>
              <Text style={styles.fieldHint}>
                JPEG, PNG, WebP, HEIC — auto-compressed &lt; 1 MB
              </Text>

              {photoUri ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                  <View style={styles.photoActionRow}>
                    <Button
                      title="Change Photo"
                      variant="secondary"
                      size="sm"
                      onPress={pickPhoto}
                      style={{ marginRight: Spacing.sm }}
                    />
                    <Button
                      title="Remove"
                      variant="ghost"
                      size="sm"
                      onPress={() => setPhotoUri(null)}
                    />
                  </View>
                </View>
              ) : (
                <Pressable style={styles.photoPlaceholder} onPress={pickPhoto}>
                  <View style={styles.cameraIconCircle}>
                    <Ionicons name="camera" size={26} color="#9F2545" />
                  </View>
                  <Text style={styles.photoPlaceholderTitle}>Take Storefront Photo</Text>
                  <Text style={styles.photoPlaceholderSub}>
                    Tap to launch camera or browse gallery
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Live GPS Location Box */}
            <View style={styles.gpsContainer}>
              <View style={styles.gpsHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={gpsStatus === 'acquired' ? 'navigate-circle' : 'location-outline'}
                    size={20}
                    color={gpsStatus === 'acquired' ? BrandColors.green.primary : '#9F2545'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.gpsHeaderTitle}>Live GPS Location</Text>
                </View>
                {gpsStatus === 'acquired' ? (
                  <View style={styles.gpsAcquiredBadge}>
                    <Text style={styles.gpsAcquiredBadgeText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              {/* Status readout */}
              <View style={styles.gpsStatusReadout}>
                {gpsStatus === 'acquired' && latitude !== null && longitude !== null ? (
                  <Text style={styles.gpsCoordinatesText}>
                    Lat: {latitude.toFixed(5)}, Lon: {longitude.toFixed(5)}
                    {gpsAccuracy ? ` (±${Math.round(gpsAccuracy)}m)` : ''}
                  </Text>
                ) : gpsStatus === 'acquiring_high' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#9F2545" style={{ marginRight: 6 }} />
                    <Text style={styles.gpsDescText}>Acquiring high-accuracy foreground location...</Text>
                  </View>
                ) : (
                  <Text style={styles.gpsDescText}>
                    Tap 'Get Current Location' to capture device GPS
                  </Text>
                )}
              </View>

              {/* GPS Actions Row */}
              <View style={styles.gpsBtnRow}>
                <Pressable
                  style={[styles.gpsActionBtn, styles.gpsPrimaryBtn]}
                  onPress={startGps}
                  accessibilityRole="button"
                  accessibilityLabel="Get Current Location"
                >
                  <Ionicons name="locate" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.gpsActionBtnText}>Get Current Location</Text>
                </Pressable>

                <Pressable
                  style={[styles.gpsActionBtn, styles.gpsSecondaryBtn]}
                  onPress={handleVerifyAddressLookup}
                  accessibilityRole="button"
                  accessibilityLabel="Verify / Lookup from Address"
                  disabled={isGeocoding}
                >
                  {isGeocoding ? (
                    <ActivityIndicator size="small" color="#9F2545" style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="map-outline" size={15} color="#9F2545" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.gpsSecondaryBtnText}>Verify / Lookup from Address</Text>
                </Pressable>
              </View>
            </View>

            {/* Mandatory Exemption Reason when photo missing */}
            {!photoUri && (
              <View style={styles.exemptionBox}>
                <View style={styles.exemptionHeaderRow}>
                  <Text style={styles.exemptionTitle}>
                    Reason for not adding shopkeeper photo <Text style={styles.requiredStar}>*</Text> (Mandatory)
                  </Text>
                  <View style={styles.mandatoryBadge}>
                    <Text style={styles.mandatoryBadgeText}>Required when photo missing</Text>
                  </View>
                </View>

                <Text style={styles.exemptionNotice}>
                  Since no shopkeeper/storefront photo is attached, please state why (e.g., poor network connectivity, customer declined photo, shop closed).
                </Text>

                {/* 5 Quick Selectable Chips */}
                <View style={styles.chipsWrap}>
                  {PHOTO_EXEMPTION_CHIPS.map((chip) => {
                    const isSelected = noPhotoReason === chip;
                    return (
                      <Pressable
                        key={chip}
                        onPress={() => {
                          setNoPhotoReason(chip);
                          if (errors.noPhotoReason) setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
                        }}
                        style={[styles.reasonChip, isSelected && styles.reasonChipSelected]}
                        accessibilityRole="button"
                        accessibilityLabel={chip}
                      >
                        <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextSelected]}>
                          {chip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ marginTop: Spacing.sm }}>
                  <Input
                    placeholder="Or type custom reason (e.g. Remote kiosk, Owner in hospital)"
                    value={noPhotoReason}
                    onChangeText={(t) => {
                      setNoPhotoReason(t);
                      if (errors.noPhotoReason) setErrors((prev) => ({ ...prev, noPhotoReason: '' }));
                    }}
                    error={errors.noPhotoReason}
                  />
                </View>
              </View>
            )}
          </Card>

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Button
              title="Save customer"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={styles.submitButton}
            />
          </View>
        </View>
      </ScrollView>

      {/* Voice Dictation Modal */}
      <Modal
        visible={voiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          stopVoiceListening();
          setVoiceModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.voiceModalCard}>
            <View style={styles.voiceModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mic" size={18} color="#9F2545" style={{ marginRight: 6 }} />
                <Text style={styles.voiceModalTitle}>
                  Voice Input: {activeVoiceField?.label}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  stopVoiceListening();
                  setVoiceModalVisible(false);
                }}
                hitSlop={HitSlop.md}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Language Toggle */}
            <View style={styles.langToggleRow}>
              <Pressable
                style={[styles.langPill, voiceLang === 'hi-IN' && styles.langPillActive]}
                onPress={() => {
                  setVoiceLang('hi-IN');
                  if (isVoiceListening) {
                    stopVoiceListening();
                    startVoiceListening('hi-IN');
                  }
                }}
              >
                <Text style={[styles.langPillText, voiceLang === 'hi-IN' && styles.langPillTextActive]}>
                  Hindi (हिंदी / Hinglish)
                </Text>
              </Pressable>
              <Pressable
                style={[styles.langPill, voiceLang === 'en-IN' && styles.langPillActive]}
                onPress={() => {
                  setVoiceLang('en-IN');
                  if (isVoiceListening) {
                    stopVoiceListening();
                    startVoiceListening('en-IN');
                  }
                }}
              >
                <Text style={[styles.langPillText, voiceLang === 'en-IN' && styles.langPillTextActive]}>
                  English (India)
                </Text>
              </Pressable>
            </View>

            {/* Pulsing Mic Center */}
            <View style={styles.micCenterContainer}>
              <Animated.View
                style={[
                  styles.pulseCircle,
                  {
                    transform: [{ scale: pulseAnim }],
                    backgroundColor: isVoiceListening ? '#FFE4E6' : '#F1F5F9',
                  },
                ]}
              >
                <Pressable
                  style={[
                    styles.micActionButton,
                    { backgroundColor: isVoiceListening ? '#9F2545' : '#64748B' },
                  ]}
                  onPress={() => {
                    if (isVoiceListening) stopVoiceListening();
                    else startVoiceListening(voiceLang);
                  }}
                >
                  <Ionicons name={isVoiceListening ? 'mic' : 'mic-off'} size={28} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
              <Text style={styles.voiceStatusText}>
                {isVoiceListening ? 'Listening... Speak naturally' : 'Tap mic to start speaking'}
              </Text>
            </View>

            {/* Transcript Preview */}
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Spoken Transcript:</Text>
              <Text style={styles.transcriptText}>
                {voiceTranscript || (isVoiceListening ? '...' : 'No speech recorded yet.')}
              </Text>
            </View>

            {voiceError ? (
              <Text style={styles.voiceErrorText}>{voiceError}</Text>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.voiceModalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                size="md"
                onPress={() => {
                  stopVoiceListening();
                  setVoiceModalVisible(false);
                }}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Apply Spoken Text"
                variant="primary"
                size="md"
                disabled={!voiceTranscript.trim()}
                onPress={applyVoiceText}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectionModalCard}>
            <View style={styles.selectionModalHeader}>
              <Text style={styles.selectionModalTitle}>Select Store Category</Text>
              <Pressable onPress={() => setCategoryModalVisible(false)} hitSlop={HitSlop.md}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.selectionRow, isSelected && styles.selectionRowSelected]}
                    onPress={() => {
                      setCategoryId(cat.id);
                      if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: '' }));
                      setCategoryModalVisible(false);
                    }}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#9F2545' : '#94A3B8'}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.selectionRowText, isSelected && styles.selectionRowTextSelected]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Field Officer Selection Modal */}
      <Modal
        visible={sellerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSellerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectionModalCard}>
            <View style={styles.selectionModalHeader}>
              <Text style={styles.selectionModalTitle}>Select Assigned Field Officer</Text>
              <Pressable onPress={() => setSellerModalVisible(false)} hitSlop={HitSlop.md}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {/* Search */}
            <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.sm }}>
              <TextInput
                placeholder="Search field seller or territory..."
                value={sellerSearch}
                onChangeText={setSellerSearch}
                style={styles.modalSearchInput}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {/* Unassigned option */}
              <Pressable
                style={[styles.selectionRow, !sellerId && styles.selectionRowSelected]}
                onPress={() => {
                  setSellerId('');
                  setSellerModalVisible(false);
                }}
              >
                <Ionicons
                  name={!sellerId ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={!sellerId ? '#9F2545' : '#94A3B8'}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.selectionRowText, !sellerId && styles.selectionRowTextSelected]}>
                  Select a field seller... (Unassigned)
                </Text>
              </Pressable>

              {sellers
                .filter(
                  (s) =>
                    !sellerSearch.trim() ||
                    s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
                    (s.territory && s.territory.toLowerCase().includes(sellerSearch.toLowerCase()))
                )
                .map((seller) => {
                  const isSelected = sellerId === seller.id;
                  return (
                    <Pressable
                      key={seller.id}
                      style={[styles.selectionRow, isSelected && styles.selectionRowSelected]}
                      onPress={() => {
                        setSellerId(seller.id);
                        setSellerModalVisible(false);
                      }}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? '#9F2545' : '#94A3B8'}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.selectionRowText, isSelected && styles.selectionRowTextSelected]}>
                          {seller.name}
                        </Text>
                        <Text style={styles.selectionSubText}>
                          {seller.territory ? `${seller.territory} • ` : 'Field operations • '}
                          {seller.email || 'Officer'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl * 3,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Breadcrumbs
  breadcrumbBar: {
    marginBottom: Spacing.sm,
  },
  breadcrumbWorkspace: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F2545',
  },
  breadcrumbDivider: {
    marginHorizontal: 8,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  breadcrumbCurrent: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },

  // Page Header
  pageHeader: {
    marginBottom: Spacing.md,
  },
  pageTitle: {
    fontSize: Typography.titleLarge.fontSize,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  pageLead: {
    fontSize: Typography.bodySmall.fontSize,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: '#9F2545',
    ...Shadows.sm,
  },
  tabTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabTextInactive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // Information & IST Clock Card
  istCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderColor: '#E2E8F0',
  },
  infoHeadRow: {
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  liveClockBox: {
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  liveClockTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  liveDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E61C5D',
    marginRight: 6,
  },
  liveClockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9F1239',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  istBadge: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  istBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9F1239',
  },
  clockDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  clockDateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4C0519',
  },
  clockTimeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9F1239',
    fontVariant: ['tabular-nums'],
  },
  clockCalloutNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xs + 4,
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: '#FECDD3',
  },
  clockCalloutIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  clockCalloutText: {
    fontSize: 11,
    color: '#881337',
    flex: 1,
    lineHeight: 16,
  },

  // Sections
  sectionHeaderBox: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderColor: '#E2E8F0',
  },

  // Section A Timestamp Callout
  onboardingTimestampCallout: {
    backgroundColor: '#FFF5F7',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  timestampCalloutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9F2545',
    marginRight: 6,
  },
  timestampPill: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  timestampPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9F1239',
    fontVariant: ['tabular-nums'],
  },
  timestampCalloutSub: {
    fontSize: 11,
    color: '#881337',
  },

  // Fields
  fieldGroup: {
    marginBottom: Spacing.sm + 4,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  requiredStar: {
    color: '#E61C5D',
    fontWeight: '800',
  },
  fieldHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  fieldError: {
    fontSize: 11,
    color: '#E61C5D',
    fontWeight: '600',
    marginTop: 4,
  },
  phonePrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginRight: 4,
  },
  rowGrid: {
    flexDirection: 'row',
  },

  // Voice Button
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  voiceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9F2545',
    marginLeft: 3,
  },

  // Category Selector Chips
  categoryChipsContainer: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#9F2545',
    borderColor: '#9F2545',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  browseAllText: {
    fontSize: 12,
    color: '#9F2545',
    fontWeight: '700',
  },

  // Picker Box
  pickerSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  sellerDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  pickerPlaceholderText: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
  },

  // Store Photograph
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#9F2545',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    backgroundColor: '#FFF5F7',
  },
  cameraIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    ...Shadows.sm,
  },
  photoPlaceholderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F2545',
  },
  photoPlaceholderSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  photoPreviewWrapper: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  photoActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },

  // GPS Location Card
  gpsContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gpsHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  gpsAcquiredBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  gpsAcquiredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  gpsStatusReadout: {
    marginVertical: 4,
  },
  gpsCoordinatesText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  gpsDescText: {
    fontSize: 12,
    color: '#64748B',
  },
  gpsBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  gpsActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  gpsPrimaryBtn: {
    backgroundColor: '#9F2545',
  },
  gpsSecondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  gpsActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gpsSecondaryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9F2545',
  },

  // Photo Exemption Section
  exemptionBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  exemptionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  exemptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    flex: 1,
  },
  mandatoryBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
  },
  exemptionNotice: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFFFF',
  },
  reasonChipSelected: {
    backgroundColor: '#9F2545',
    borderColor: '#9F2545',
  },
  reasonChipText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '600',
  },
  reasonChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Submit Section
  submitSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  submitButton: {
    backgroundColor: '#9F2545',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  voiceModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  voiceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  voiceModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  langToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.sm,
    padding: 3,
    marginBottom: Spacing.md,
  },
  langPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: Radius.xs,
  },
  langPillActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  langPillTextActive: {
    color: '#9F2545',
    fontWeight: '700',
  },
  micCenterContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  micActionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  voiceStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  transcriptBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 70,
    marginBottom: Spacing.sm,
  },
  transcriptLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
  },
  voiceErrorText: {
    fontSize: 11,
    color: '#E61C5D',
    marginBottom: Spacing.sm,
  },
  voiceModalActions: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },

  // Selection Modal
  selectionModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    ...Shadows.md,
  },
  selectionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: Spacing.xs,
  },
  selectionModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSearchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#0F172A',
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  selectionRowSelected: {
    backgroundColor: '#FFF1F5',
  },
  selectionRowText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  selectionRowTextSelected: {
    color: '#9F2545',
    fontWeight: '700',
  },
  selectionSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
