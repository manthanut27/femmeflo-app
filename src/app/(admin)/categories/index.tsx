import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

export default function AdminCategoriesScreen() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Category Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleCreateCategory() {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a category name.');
      return;
    }

    setIsSubmitting(true);
    try {
      await categoriesApi.createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      setModalVisible(false);
      setName('');
      setDescription('');
      loadCategories();
      Alert.alert('Success', 'Customer category created.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create category.');
    } finally {
      setIsSubmitting(false);
    }
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
        <Badge
          label={item.active ? 'ACTIVE' : 'INACTIVE'}
          variant={item.active ? 'ACTIVE' : 'INACTIVE'}
          size="sm"
        />
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Customer Categories"
        subtitle="Retail Store Classifications"
        showBack
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create customer category"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => setModalVisible(true)}
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
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>New Customer Category</Text>
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

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={isSubmitting ? 'Creating...' : 'Create Category'}
                variant="primary"
                onPress={handleCreateCategory}
                loading={isSubmitting}
                style={{ flex: 1.5 }}
              />
            </View>
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
  modalContent: {
    backgroundColor: Colors.light.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    maxWidth: 600,
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
