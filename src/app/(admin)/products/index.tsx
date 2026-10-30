import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { ProductItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

export default function AdminProductsScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBasePrice, setFormBasePrice] = useState('');
  const [formMinPrice, setFormMinPrice] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await adminApi.listProducts();
      setProducts(res.items || []);
    } catch (err: any) {
      console.warn('Failed to load products', err);
      Alert.alert('Error', err?.message || 'Failed to load products from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeTab === 'active' && !p.active) return false;
      if (activeTab === 'inactive' && p.active) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
        return matchesName || matchesSku;
      }
      return true;
    });
  }, [products, activeTab, search]);

  const generateSkuFromName = () => {
    const raw = formName.trim();
    if (!raw) {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setFormSku(`FF-PRD-${randomSuffix}`);
      return;
    }
    const words = raw
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const code = words
      .map((w) => w.slice(0, 3).toUpperCase())
      .slice(0, 3)
      .join('-');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setFormSku(`FF-${code || 'PRD'}-${randomSuffix}`);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku('');
    setFormBasePrice('');
    setFormMinPrice('');
    setFormError('');
    setModalVisible(true);
  };

  const openEditModal = (product: ProductItem) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormSku(product.sku || '');
    setFormBasePrice(((product.basePricePaise || 0) / 100).toString());
    setFormMinPrice(((product.minimumPricePaise || product.basePricePaise || 0) / 100).toString());
    setFormError('');
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (submitting) return;

    const name = formName.trim();
    if (!name) {
      setFormError('Product name is required.');
      return;
    }

    const basePriceNum = parseFloat(formBasePrice);
    if (isNaN(basePriceNum) || basePriceNum <= 0) {
      setFormError('Please enter a valid base price greater than 0.');
      return;
    }

    const minPriceNum = formMinPrice.trim() ? parseFloat(formMinPrice) : basePriceNum;
    if (isNaN(minPriceNum) || minPriceNum <= 0) {
      setFormError('Please enter a valid minimum floor price greater than 0.');
      return;
    }

    if (minPriceNum > basePriceNum) {
      setFormError('Minimum price cannot exceed base price.');
      return;
    }

    const basePricePaise = Math.round(basePriceNum * 100);
    const minimumPricePaise = Math.round(minPriceNum * 100);

    setSubmitting(true);
    setFormError('');

    try {
      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, {
          name,
          sku: formSku.trim() || null,
          basePricePaise,
          minimumPricePaise,
        });
        Alert.alert('Success', `Product "${name}" updated successfully.`);
      } else {
        await adminApi.createProduct({
          name,
          sku: formSku.trim() || undefined,
          basePricePaise,
          minimumPricePaise,
        });
        Alert.alert('Success', `Product "${name}" created successfully.`);
      }
      setModalVisible(false);
      await fetchProducts();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = (product: ProductItem) => {
    const action = product.active ? 'deactivate' : 'activate';
    Alert.alert(
      `Confirm ${product.active ? 'Deactivation' : 'Activation'}`,
      `Are you sure you want to ${action} "${product.name}"? ${
        product.active
          ? 'Field officers will no longer be able to select this SKU in POS carts.'
          : 'Field officers will be able to select and sell this SKU.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Yes, ${action}`,
          style: product.active ? 'destructive' : 'default',
          onPress: async () => {
            setTogglingId(product.id);
            try {
              await adminApi.toggleProductActive(product.id);
              await fetchProducts();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to toggle product status.');
            } finally {
              setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  const renderProductItem = ({ item }: { item: ProductItem }) => {
    const isToggling = togglingId === item.id;
    return (
      <Card style={styles.productCard}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productSku}>{item.sku ? `SKU: ${item.sku}` : 'No SKU assigned'}</Text>
          </View>
          <Badge
            label={item.active ? 'ACTIVE' : 'INACTIVE'}
            variant={item.active ? 'ACTIVE' : 'INACTIVE'}
            size="sm"
          />
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>Base Price</Text>
            <Text style={styles.priceValue}>₹{((item.basePricePaise || 0) / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>Floor Minimum</Text>
            <Text style={[styles.priceValue, { color: BrandColors.pink.dark }]}>
              ₹{((item.minimumPricePaise || item.basePricePaise || 0) / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => openEditModal(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Ionicons name="create-outline" size={16} color="#0F172A" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, item.active ? styles.toggleBtnInactive : styles.toggleBtnActive]}
            onPress={() => handleToggleActive(item)}
            disabled={isToggling}
            accessibilityRole="button"
            accessibilityLabel={`Toggle ${item.name}`}
          >
            {isToggling ? (
              <ActivityIndicator size="small" color={item.active ? Colors.light.error : BrandColors.green.primary} />
            ) : (
              <>
                <Ionicons
                  name={item.active ? 'power' : 'checkmark-circle-outline'}
                  size={16}
                  color={item.active ? Colors.light.error : BrandColors.green.primary}
                />
                <Text
                  style={[
                    styles.toggleBtnText,
                    { color: item.active ? Colors.light.error : BrandColors.green.primary },
                  ]}
                >
                  {item.active ? 'Deactivate' : 'Activate'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Product Catalog"
        subtitle="Manage national SKUs, base prices and approval floors"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={() => router.back()}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
          </Pressable>
        }
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add new product"
            style={styles.headerAddBtn}
            onPress={openCreateModal}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View style={styles.searchSection}>
        <View style={styles.searchInner}>
          <Input
            placeholder="Search products by name or SKU..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'active', 'inactive'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingPadding}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No Products Found"
          description={
            search.trim()
              ? 'No products matching your search term.'
              : activeTab !== 'all'
              ? `No ${activeTab} products in catalog.`
              : 'Product catalog is currently empty.'
          }
          actionTitle="Add First Product"
          onAction={openCreateModal}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[BrandColors.pink.dark]}
            />
          }
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {formError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={Colors.light.error} />
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Product Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. FemmeFlo Anion Wings Ultra 280mm"
                value={formName}
                onChangeText={setFormName}
              />

              <View style={styles.skuRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.inputLabel}>SKU Code</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. FF-WNG-280"
                    value={formSku}
                    onChangeText={setFormSku}
                    autoCapitalize="characters"
                  />
                </View>
                <TouchableOpacity
                  style={styles.skuGenBtn}
                  onPress={generateSkuFromName}
                  accessibilityRole="button"
                  accessibilityLabel="Auto-generate SKU"
                >
                  <Ionicons name="sparkles" size={16} color={BrandColors.pink.dark} />
                  <Text style={styles.skuGenBtnText}>Auto SKU</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Base Selling Price (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 35.00"
                value={formBasePrice}
                onChangeText={(val) => {
                  setFormBasePrice(val);
                  if (!editingProduct && !formMinPrice) {
                    setFormMinPrice(val);
                  }
                }}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Minimum Floor Price (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 25.00"
                value={formMinPrice}
                onChangeText={setFormMinPrice}
                keyboardType="numeric"
              />
              <Text style={styles.inputHelper}>
                Sales entered below this threshold require Super Admin authorization in the Price Approvals Queue.
              </Text>

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                  variant="admin"
                  onPress={handleSaveProduct}
                  loading={submitting}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  headerAddBtn: {
    backgroundColor: BrandColors.pink.primary,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  searchInner: {
    padding: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.light.surfaceSecondary,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.sm,
  },
  tabItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  tabItemActive: {
    backgroundColor: BrandColors.pink.primary,
  },
  tabText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  loadingPadding: {
    padding: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  productCard: {
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    ...Typography.subtitle,
    color: Colors.light.text,
    fontWeight: '700',
  },
  productSku: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  priceBlock: {
    flex: 1,
    alignItems: 'center',
  },
  priceDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  priceLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  priceValue: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  editBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: '#0F172A',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: BrandColors.green.subtle,
    borderColor: BrandColors.green.primary,
  },
  toggleBtnInactive: {
    backgroundColor: Colors.light.errorBg,
    borderColor: Colors.light.error,
  },
  toggleBtnText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.errorBg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    ...Typography.caption,
    color: Colors.light.error,
    fontWeight: '600',
    flex: 1,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  inputHelper: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  skuGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.pink.subtle,
    backgroundColor: '#FFF1F2',
    marginBottom: 2,
  },
  skuGenBtnText: {
    ...Typography.caption,
    color: BrandColors.pink.dark,
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
});

