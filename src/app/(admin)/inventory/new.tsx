import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';

export default function AdminNewWarehouseScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = useCallback(() => {
    if (params?.from === 'actions') {
      try {
        (navigation as any).navigate('actions/index');
        return;
      } catch {
        // fallback
      }
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      try {
        (navigation as any).navigate('actions/index');
      } catch {
        router.replace('/(admin)/actions' as any);
      }
    }
  }, [params?.from, navigation, router]);

  useEffect(() => {
    if (params?.from === 'actions') {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [params?.from, handleBack]);

  const handleCreateWarehouse = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter warehouse / depot name.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await adminApi.createWarehouse({
        name: trimmed,
      });

      Alert.alert(
        'Warehouse Created',
        `${res.warehouse?.name || trimmed} has been added to the regional depot network.`,
        [
          {
            text: 'OK',
            onPress: () => {
              handleBack();
            },
          },
        ]
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to create warehouse.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Add Regional Warehouse"
        subtitle="Create a regional depot for buffer storage"
        showBack
        onBack={handleBack}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.innerContainer}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Ionicons name="business-outline" size={24} color={BrandColors.green.dark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Add Regional Warehouse</Text>
                  <Text style={styles.cardSubtitle}>
                    Create a regional depot for buffer storage
                  </Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color={Colors.light.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Warehouse / Depot Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>Warehouse / Depot Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Thane Regional Depot"
                  placeholderTextColor={Colors.light.textMuted}
                  autoFocus
                  autoCapitalize="words"
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={handleBack}
                  style={styles.cancelBtn}
                />
                <Button
                  title={isSubmitting ? 'Creating...' : 'Create Warehouse'}
                  variant="primary"
                  onPress={handleCreateWarehouse}
                  loading={isSubmitting}
                  disabled={!name.trim() || isSubmitting}
                  style={styles.createBtn}
                />
              </View>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  innerContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.green.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  cardSubtitle: {
    ...Typography.caption,
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.light.error,
    fontWeight: '600',
    flex: 1,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  createBtn: {
    flex: 1.4,
    backgroundColor: BrandColors.green.primary,
  },
});

