import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, SaleItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageTransition } from '@/components/ui/PageTransition';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import { requireActiveShift } from '@/utils/shiftGuard';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [customer, setCustomer] = useState<CustomerItem | null>(null);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      sellerApi.getCustomer(id).catch(() => ({ customer: null as any })),
      sellerApi.listSales({ customerId: id, pageSize: 10 }).catch(() => ({ items: [] })),
    ])
      .then(([custRes, salesRes]) => {
        if (custRes.customer) setCustomer(custRes.customer);
        if (salesRes.items) setSales(salesRes.items);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const shopPhotoUri = customer?.photoUrl || (customer as any)?.photoPath || null;

  async function handleUpdatePhoto() {
    if (!customer?.id || uploadingPhoto) return;

    const hasShift = await requireActiveShift(user?.id, 'capture or update store storefront photos', () => {
      router.push('/(seller)' as any);
    });
    if (!hasShift) return;

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
            await uploadPhoto(res.assets[0].uri);
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
            await uploadPhoto(res.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function uploadPhoto(uri: string) {
    if (!customer?.id) return;
    try {
      setUploadingPhoto(true);
      const compressed = await compressImage(uri);
      const res = await sellerApi.uploadCustomerPhoto(customer.id, compressed.uri);
      const newUrl = res.photoUrl || compressed.uri;
      setCustomer((prev) => (prev ? { ...prev, photoUrl: newUrl, photoPath: newUrl } : null));
      Alert.alert('Success', 'Storefront photo updated successfully.');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to upload storefront photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

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

  if (loading) {
    return <LoadingState message="Loading store profile & ledger..." />;
  }

  if (!customer) {
    return (
      <View style={styles.container}>
        <Header title="Customer Details" showBack />
        <View style={styles.centerContainer}>
          <EmptyState
            icon="storefront-outline"
            title="Customer Not Found"
            description="The requested retailer outlet record could not be found."
            actionTitle="Back to Customers"
            onAction={() => router.replace('/(seller)/customers' as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={customer.shopName} subtitle="Store Ledger & Profile" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          {/* Profile Card */}
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.shopTitle}>{customer.shopName}</Text>
                <Text style={styles.ownerSubtitle}>Proprietor: {customer.ownerName}</Text>
              </View>
              <Badge label={customer.category?.name || 'Retail'} variant="info" size="md" />
            </View>

            {/* Storefront Photograph / Photo Action Banner */}
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

            {/* Quick Contact Buttons */}
            <View style={styles.contactRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Call ${customer.phone}`}
                style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                onPress={handleCall}
                hitSlop={HitSlop.md}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Call</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Email ${customer.email}`}
                style={({ pressed }) => [styles.actionPill, styles.emailPill, pressed && styles.actionPillPressed]}
                onPress={handleEmail}
                hitSlop={HitSlop.md}
              >
                <Ionicons name="mail" size={16} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Email</Text>
              </Pressable>

              {customer.latitude && customer.longitude ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open store location in Maps"
                  style={({ pressed }) => [styles.actionPill, styles.mapsPill, pressed && styles.actionPillPressed]}
                  onPress={handleOpenMaps}
                  hitSlop={HitSlop.md}
                >
                  <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  <Text style={styles.actionPillText}>Navigate</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.divider} />

            {/* Contact Details */}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Email Address</Text>
              <Text style={styles.detailValue}>{customer.email}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Mobile Number</Text>
              <Text style={styles.detailValue}>{customer.phone}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Full Address</Text>
              <Text style={styles.detailValue}>{customer.address}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Location Area</Text>
              <Text style={styles.detailValue}>
                {[customer.village, customer.district, customer.state, customer.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
          </Card>

          {/* Action: Create Sale for this customer */}
          <Button
            title={`Create New Sale for ${customer.shopName.split(' ')[0]}`}
            variant="primary"
            size="lg"
            onPress={async () => {
              const hasShift = await requireActiveShift(user?.id, 'create new store sales', () => {
                router.push('/(seller)' as any);
              });
              if (!hasShift) return;
              router.push({
                pathname: '/(seller)/sales/new' as any,
                params: { customerId: customer.id, customerName: customer.shopName },
              });
            }}
            icon={<Ionicons name="cart-outline" size={20} color="#FFFFFF" />}
            style={{ marginBottom: Spacing.xl }}
          />

          {/* Order History */}
          <Text style={styles.sectionHeading}>Order History</Text>
          {sales.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No Orders Recorded"
              description="No past orders found for this customer. Create their first POS sale now."
              actionTitle="New Store Sale"
              onAction={async () => {
                const hasShift = await requireActiveShift(user?.id, 'create new store sales', () => {
                  router.push('/(seller)' as any);
                });
                if (!hasShift) return;
                router.push({
                  pathname: '/(seller)/sales/new' as any,
                  params: { customerId: customer.id, customerName: customer.shopName },
                });
              }}
            />
          ) : (
            sales.map((sale) => (
              <Card
                key={sale.id}
                onPress={() => router.push(`/(seller)/sales/${sale.id}` as any)}
                accessibilityLabel={`Order ${sale.saleNumber || sale.id.slice(0, 8)}, ${formatRupees(sale.totalAmountPaise)}, status ${sale.status}`}
                accessibilityHint="Tap to view order details and invoice"
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
                  <Badge label={sale.status} variant={sale.status} />
                </View>

                <View style={styles.saleFooter}>
                  <Text style={styles.packetCount}>{sale.packetCount ?? (sale as any).quantity ?? 0} packets</Text>
                  <Text style={styles.saleAmount}>{formatRupees(sale.totalAmountPaise ?? (sale as any).totalPaise ?? 0)}</Text>
                </View>
              </Card>
            ))
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
              <Image
                source={{ uri: shopPhotoUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
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
  errorText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    marginTop: Spacing.lg,
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  shopTitle: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  ownerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
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
    marginVertical: Spacing.xs,
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
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderSubtle,
    marginVertical: Spacing.md,
  },
  detailItem: {
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    ...Typography.bodySmall,
    color: Colors.light.text,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  emptyCard: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.light.textMuted,
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
