import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoriesApi } from '@/api/categories';
import type { CategoryItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';

export default function AdminCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const handleBack = useDashboardBackHandler('/(admin)');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add / Edit Category Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesApi.listCategories();
      setCategories(res.items);
    } catch (err) {
      console.warn('Failed to load categories', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCategories();
  }, [loadCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setActive(true);
    setModalVisible(true);
  };

  const openEditModal = (item: CategoryItem) => {
    setEditingCategory(item);
    setName(item.name || '');
    setDescription(item.description || '');
    setActive(item.active ?? true);
    setModalVisible(true);
  };

  async function handleSaveCategory() {
    if (isSubmitting) return;
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a category name.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await categoriesApi.updateCategory(editingCategory.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          active,
        });
        Alert.alert('Success', 'Customer category updated.');
      } else {
        await categoriesApi.createCategory({
          name: name.trim(),
          description: description.trim() || undefined,
        });
        Alert.alert('Success', 'Customer category created.');
      }

      setModalVisible(false);
      setEditingCategory(null);
      setName('');
      setDescription('');
      loadCategories();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDeleteCategory(item: CategoryItem) {
    if (deletingId) return;
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              const res: any = await categoriesApi.deleteCategory(item.id);
              const wasSoftDeleted = res?.softDeleted || res?.deactivated || res?.active === false;
              setCategories((prev) =>
                wasSoftDeleted
                  ? prev.map((c) => (c.id === item.id ? { ...c, active: false } : c))
                  : prev.filter((c) => c.id !== item.id)
              );
              await loadCategories();
              Alert.alert(
                wasSoftDeleted ? 'Deactivated' : 'Deleted',
                wasSoftDeleted
                  ? `"${item.name}" is linked to existing customers, so it has been deactivated.`
                  : `"${item.name}" has been deleted.`
              );
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete category.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  const renderCategory = ({ item }: { item: CategoryItem }) => (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Category ${item.name}, ${item.description || 'No description'}, status ${item.active ? 'Active' : 'Inactive'}`}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={styles.name}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.desc}>{item.description}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Badge
            label={item.active ? 'ACTIVE' : 'INACTIVE'}
            variant={item.active ? 'ACTIVE' : 'INACTIVE'}
            size="sm"
          />
          <Pressable
            onPress={() => openEditModal(item)}
            hitSlop={HitSlop.sm}
            style={{ padding: 6, borderRadius: 8, backgroundColor: '#F1F5F9' }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Ionicons name="create-outline" size={16} color={BrandColors.green.primary} />
          </Pressable>
          <Pressable
            onPress={() => handleDeleteCategory(item)}
            disabled={deletingId === item.id}
            hitSlop={HitSlop.sm}
            style={{ padding: 6, borderRadius: 8, backgroundColor: '#FEF2F2' }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <Ionicons name="trash-outline" size={16} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Product Categories"
        subtitle="Product & Store Classifications"
        showBack
        onBack={handleBack}
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create product category"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={openCreateModal}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View style={styles.innerContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : (
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={renderCategory}
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
      </View>

      {/* Add Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {editingCategory ? 'Edit Customer Category' : 'New Customer Category'}
                </Text>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  hitSlop={HitSlop.md}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={24} color={Colors.light.textTertiary} />
                </Pressable>
              </View>
              <Text style={styles.modalSub}>
                Categories appear in the Customer Onboarding form for field officers.
              </Text>

              <Input
                label="Category Name *"
                placeholder="e.g. Chemist / Pharmacy"
                value={name}
                onChangeText={setName}
                leftIcon={<Ionicons name="pricetag-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Description (Optional)"
                placeholder="e.g. Retail medical and pharmaceutical shops"
                value={description}
                onChangeText={setDescription}
                leftIcon={<Ionicons name="document-text-outline" size={18} color={Colors.light.textTertiary} />}
              />

              {editingCategory ? (
                <Pressable
                  onPress={() => setActive((prev) => !prev)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: BorderRadius.md,
                    borderWidth: 1,
                    borderColor: Colors.light.border,
                    backgroundColor: '#F8FAFC',
                    marginBottom: Spacing.md,
                  }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: active }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>
                    Active Status
                  </Text>
                  <Badge
                    label={active ? 'ACTIVE' : 'INACTIVE'}
                    variant={active ? 'ACTIVE' : 'INACTIVE'}
                    size="sm"
                  />
                </Pressable>
              ) : null}

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setModalVisible(false)}
                  disabled={isSubmitting}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={
                    isSubmitting
                      ? editingCategory
                        ? 'Saving...'
                        : 'Creating...'
                      : editingCategory
                      ? 'Save Changes'
                      : 'Create Category'
                  }
                  variant="admin"
                  onPress={handleSaveCategory}
                  loading={isSubmitting}
                  style={{ flex: 1.5 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  addButton: {
    backgroundColor: BrandColors.pink.dark,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.low,
  },
  addButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  loadingContainer: {
    padding: Spacing.lg,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  card: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  desc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    maxWidth: 600,
    maxHeight: '90%',
    width: '100%',
    alignSelf: 'center',
    ...Elevation.high,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.light.textPrimary,
  },
  modalSub: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.lg,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
});
