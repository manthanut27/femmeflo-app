import Ionicons from '@expo/vector-icons/Ionicons';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  KeyboardAvoidingView,
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
import { managerApi } from '@/api/manager';
import { sellerApi } from '@/api/seller';
import type {
  AuthRole,
  BulkCustomerResponse,
  BulkCustomerRow,
  CategoryItem,
  CreateBulkCustomersPayload,
  PublicUser,
} from '@/api/types';
import { ISTClock } from '@/components/common/ISTClock';
import { SaveConfirmationCard } from '@/components/customers/SaveConfirmationCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
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
import { parseBulkCustomersCsv } from '@/utils/csvParser';

interface Props {
  role: AuthRole;
  onSuccess?: (result: BulkCustomerResponse) => void;
  onCancel?: () => void;
  onSwitchToSingle?: () => void;
}

export interface CustomerBatchRowState extends BulkCustomerRow {
  clientId: string;
}

function createEmptyBatchRow(
  defaultCategoryId = '',
  defaultState = 'Maharashtra',
  defaultDistrict = '',
  defaultVillage = '',
  defaultReason = 'Bulk field onboarding visit',
  defaultSellerId = ''
): CustomerBatchRowState {
  return {
    clientId: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    shopName: '',
    contactName: '',
    phone: '',
    categoryId: defaultCategoryId,
    pincode: '',
    village: defaultVillage,
    district: defaultDistrict,
    state: defaultState,
    shopNumber: '',
    streetName: '',
    noPhotoReason: defaultReason,
    sellerId: defaultSellerId || undefined,
  };
}

export function BatchCustomerOnboarding({
  role,
  onSuccess,
  onCancel,
  onSwitchToSingle,
}: Props) {
  // Categories & Sellers
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [sellers, setSellers] = useState<PublicUser[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Defaults Toolbar
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [defaultState, setDefaultState] = useState('Maharashtra');
  const [defaultDistrict, setDefaultDistrict] = useState('');
  const [defaultVillage, setDefaultVillage] = useState('');
  const [defaultPincode, setDefaultPincode] = useState('');
  const [defaultNoPhotoReason, setDefaultNoPhotoReason] = useState('Bulk field onboarding visit');
  const [defaultSellerId, setDefaultSellerId] = useState('');
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);

  // Rows state (1 to 100)
  const [rows, setRows] = useState<CustomerBatchRowState[]>([
    createEmptyBatchRow(),
    createEmptyBatchRow(),
    createEmptyBatchRow(),
  ]);

  // Import Modal State (Excel tab-separated / CSV paste)
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [importPreview, setImportPreview] = useState<{
    total: number;
    valid: number;
    errors: string[];
    parsedRows: BulkCustomerRow[];
  } | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [savedResult, setSavedResult] = useState<BulkCustomerResponse | null>(null);

  // 1. Load categories and sellers
  useEffect(() => {
    let active = true;
    async function loadAuxiliaryData() {
      try {
        const catRes = await categoriesApi.listCategories().catch(() => ({ items: [] }));
        if (active && catRes.items.length > 0) {
          const activeCats = catRes.items.filter((c) => c.active !== false);
          setCategories(activeCats);
          if (activeCats.length > 0) {
            setDefaultCategoryId(activeCats[0].id);
            setRows((prev) =>
              prev.map((r) => ({
                ...r,
                categoryId: r.categoryId || activeCats[0].id,
              }))
            );
          }
        }

        if (role === 'SUPER_ADMIN' || role === 'MANAGER') {
          const sRes =
            role === 'SUPER_ADMIN'
              ? await adminApi.listSellers({ pageSize: 100 }).catch(() => ({ items: [] }))
              : await managerApi.listSellers({ pageSize: 100 }).catch(() => ({ items: [] }));
          if (active && sRes.items.length > 0) {
            setSellers(sRes.items);
            setDefaultSellerId(sRes.items[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to load batch onboarding data', err);
      } finally {
        if (active) setLoadingInitial(false);
      }
    }
    loadAuxiliaryData();
    return () => {
      active = false;
    };
  }, [role]);

  // 2. Default PIN code lookup
  const handleDefaultPincodeChange = async (pin: string) => {
    setDefaultPincode(pin);
    if (pin.trim().length === 6 && /^\d{6}$/.test(pin.trim())) {
      setPincodeLookupLoading(true);
      try {
        const lookup = await sellerApi.lookupPincode(pin.trim());
        if (lookup.state) setDefaultState(lookup.state);
        if (lookup.district) setDefaultDistrict(lookup.district);
        if (lookup.village) setDefaultVillage(lookup.village);
      } catch (err) {
        console.warn('Default PIN lookup error', err);
      } finally {
        setPincodeLookupLoading(false);
      }
    }
  };

  // 3. Row-level operations
  const updateRowField = (index: number, field: keyof BulkCustomerRow, value: any) => {
    setRows((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  const handleRowPincodeChange = async (index: number, pin: string) => {
    updateRowField(index, 'pincode', pin);
    if (pin.trim().length === 6 && /^\d{6}$/.test(pin.trim())) {
      try {
        const lookup = await sellerApi.lookupPincode(pin.trim());
        setRows((prev) => {
          const copy = [...prev];
          if (copy[index]) {
            copy[index] = {
              ...copy[index],
              state: copy[index].state || lookup.state || defaultState,
              district: copy[index].district || lookup.district || defaultDistrict,
              village: copy[index].village || lookup.village || defaultVillage,
            };
          }
          return copy;
        });
      } catch (e) {
        // Fallback
      }
    }
  };

  const handleAddRow = () => {
    if (rows.length >= 100) {
      Alert.alert('Limit Reached', 'A maximum of 100 customer records can be added per batch.');
      return;
    }
    setRows((prev) => [
      ...prev,
      createEmptyBatchRow(
        defaultCategoryId,
        defaultState,
        defaultDistrict,
        defaultVillage,
        defaultNoPhotoReason,
        defaultSellerId
      ),
    ]);
  };

  const handleAddMultipleRows = (count: number) => {
    const availableSlots = 100 - rows.length;
    const toAdd = Math.min(count, availableSlots);
    if (toAdd <= 0) {
      Alert.alert('Limit Reached', 'A maximum of 100 customer records can be added per batch.');
      return;
    }
    const newItems: CustomerBatchRowState[] = [];
    for (let i = 0; i < toAdd; i++) {
      newItems.push(
        createEmptyBatchRow(
          defaultCategoryId,
          defaultState,
          defaultDistrict,
          defaultVillage,
          defaultNoPhotoReason,
          defaultSellerId
        )
      );
    }
    setRows((prev) => [...prev, ...newItems]);
  };

  const handleDeleteRow = (index: number) => {
    if (rows.length <= 1) {
      setRows([
        createEmptyBatchRow(
          defaultCategoryId,
          defaultState,
          defaultDistrict,
          defaultVillage,
          defaultNoPhotoReason,
          defaultSellerId
        ),
      ]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDuplicateRow = (index: number) => {
    if (rows.length >= 100) {
      Alert.alert('Limit Reached', 'A maximum of 100 customer records can be added per batch.');
      return;
    }
    const row = rows[index];
    if (!row) return;
    const duplicated: CustomerBatchRowState = {
      ...row,
      clientId: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      shopName: `${row.shopName} (Copy)`,
      phone: '', // Clear phone so no accidental duplicate
    };
    setRows((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicated);
      return copy;
    });
  };

  const handleApplyDefaultsToAll = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        categoryId: r.categoryId || defaultCategoryId,
        state: r.state || defaultState,
        district: r.district || defaultDistrict,
        village: r.village || defaultVillage,
        pincode: r.pincode || defaultPincode,
        noPhotoReason: r.noPhotoReason || defaultNoPhotoReason,
        sellerId: r.sellerId || defaultSellerId,
      }))
    );
    Alert.alert('Defaults Applied', 'Shared territory and category defaults updated on all rows.');
  };

  const handleClearEmptyRows = () => {
    const filled = rows.filter((r) => r.shopName.trim() || r.phone.trim() || r.contactName.trim());
    if (filled.length === 0) {
      setRows([
        createEmptyBatchRow(
          defaultCategoryId,
          defaultState,
          defaultDistrict,
          defaultVillage,
          defaultNoPhotoReason,
          defaultSellerId
        ),
      ]);
    } else {
      setRows(filled);
    }
  };

  // 4. Duplicate phone numbers detection within current batch
  const duplicatePhones = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const p = (r.phone || '').replace(/\D/g, '').slice(-10);
      if (p.length === 10) {
        counts[p] = (counts[p] || 0) + 1;
      }
    }
    const dups = new Set<string>();
    for (const [p, c] of Object.entries(counts)) {
      if (c > 1) dups.add(p);
    }
    return dups;
  }, [rows]);

  // Row validation helper
  const getRowErrors = useCallback(
    (row: CustomerBatchRowState): string[] => {
      const errs: string[] = [];
      if (!row.shopName.trim()) errs.push('Shop Name is required');
      const cleanPhone = (row.phone || '').replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        errs.push('Phone must be 10 digits starting with 6-9');
      }
      if (duplicatePhones.has(cleanPhone)) {
        errs.push(`Duplicate phone ${cleanPhone} in batch`);
      }
      const dist = row.district || defaultDistrict;
      const vill = row.village || defaultVillage;
      if (!dist) errs.push('District is required');
      if (!vill) errs.push('Village/Town is required');
      if (!row.noPhotoReason && !row.photoPath && !defaultNoPhotoReason) {
        errs.push('Photo exemption reason is required');
      }
      return errs;
    },
    [duplicatePhones, defaultDistrict, defaultVillage, defaultNoPhotoReason]
  );

  // Statistics
  const stats = useMemo(() => {
    let valid = 0;
    let incomplete = 0;
    for (const r of rows) {
      const errs = getRowErrors(r);
      if (errs.length === 0) valid++;
      else incomplete++;
    }
    return { valid, incomplete, total: rows.length };
  }, [rows, getRowErrors]);

  // 5. Excel / CSV Paste Parsing & Preview
  const handleParsePasteData = () => {
    if (!pasteContent.trim()) {
      Alert.alert('Empty Content', 'Please paste CSV or Excel table data.');
      return;
    }
    const result = parseBulkCustomersCsv(pasteContent);
    const errorStrings = result.errors.map((e) => `Row ${e.rowNumber}: ${e.reason}`);
    setImportPreview({
      total: result.totalRows,
      valid: result.validCount,
      errors: errorStrings,
      parsedRows: result.rows,
    });
  };

  const handleApplyImportedRows = (mode: 'replace' | 'append') => {
    if (!importPreview || importPreview.parsedRows.length === 0) return;

    const newRows: CustomerBatchRowState[] = importPreview.parsedRows.map((r) => ({
      ...r,
      clientId: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      categoryId: r.categoryId || defaultCategoryId,
      state: r.state || defaultState,
      district: r.district || defaultDistrict,
      village: r.village || defaultVillage,
      noPhotoReason: r.noPhotoReason || defaultNoPhotoReason,
      sellerId: r.sellerId || defaultSellerId,
    }));

    if (mode === 'replace') {
      setRows(newRows.slice(0, 100));
    } else {
      const combined = [...rows, ...newRows].slice(0, 100);
      setRows(combined);
    }

    setImportModalVisible(false);
    setPasteContent('');
    setImportPreview(null);
  };

  // 6. CSV Template Download / Share
  const handleDownloadTemplate = async () => {
    const templateContent =
      'Store / Shop Name,Contact Person,Mobile Phone (10 Digits),Village / Locality,District,PIN Code,Exemption Reason,Category,Email,Address\n' +
      'Sai Krupa General Store,Ramesh Patil,9820123456,Hadapsar,Pune,411028,Bulk field onboarding visit,,,\n' +
      'Mahalaxmi Mart,Sunita Sharma,9820654321,Shivajinagar,Pune,411005,Bulk field onboarding visit,,,\n' +
      'Om Traders,Vikram Deshmukh,9890123789,Kothrud,Pune,411038,Bulk field onboarding visit,,,\n';

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'femmeflo_customer_batch_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    // Native sharing via expo-file-system and expo-sharing
    try {
      const file = new File(Paths.cache, 'femmeflo_customer_batch_template.csv');
      await file.write(templateContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Download Customer Onboarding Template',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Template Saved', `Saved template to ${file.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not export CSV template.');
    }
  };

  // 7. Atomic Batch Submission
  const handleSubmitBatch = async () => {
    if (isSubmitting) return;
    setSubmissionFeedback(null);

    // Filter filled rows
    const filledRows = rows.filter((r) => r.shopName.trim() || r.phone.trim());
    if (filledRows.length === 0) {
      setSubmissionFeedback({
        type: 'error',
        message: 'Please add at least one customer shop name and mobile phone number.',
      });
      Alert.alert('Empty Batch', 'Please add at least one customer shop name and mobile phone number.');
      return;
    }

    if (filledRows.length > 100) {
      Alert.alert('Batch Limit', 'Maximum batch size is 100 customers. Please remove extra rows.');
      return;
    }

    // Validate each row
    for (let i = 0; i < filledRows.length; i++) {
      const row = filledRows[i];
      const errs = getRowErrors(row);
      if (errs.length > 0) {
        const msg = `Row #${i + 1} (${row.shopName || 'Untitled'}): ${errs.join('; ')}`;
        setSubmissionFeedback({ type: 'error', message: msg });
        Alert.alert('Validation Error', msg);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: CreateBulkCustomersPayload = {
        defaultCategoryId: defaultCategoryId || undefined,
        defaultSellerId: defaultSellerId || undefined,
        defaultState: defaultState || 'Maharashtra',
        defaultDistrict: defaultDistrict || undefined,
        defaultVillage: defaultVillage || undefined,
        defaultNoPhotoReason: defaultNoPhotoReason || 'Bulk field onboarding visit',
        customers: filledRows.map((r) => {
          const rawPhone = (r.phone || '').replace(/\D/g, '').slice(-10);
          const normalizedPhone = rawPhone.startsWith('+91') ? rawPhone : `+91${rawPhone}`;
          return {
            shopName: r.shopName.trim(),
            contactName: r.contactName.trim() || r.shopName.trim(),
            phone: normalizedPhone,
            email: r.email?.trim() || undefined,
            categoryId: r.categoryId || defaultCategoryId || undefined,
            sellerId: r.sellerId || defaultSellerId || undefined,
            shopNumber: r.shopNumber?.trim() || undefined,
            streetName: r.streetName?.trim() || undefined,
            pincode: r.pincode?.trim() || defaultPincode || undefined,
            district: r.district?.trim() || defaultDistrict || 'District',
            village: r.village?.trim() || defaultVillage || 'Village',
            state: r.state?.trim() || defaultState || 'Maharashtra',
            noPhotoReason: r.noPhotoReason?.trim() || defaultNoPhotoReason || 'Bulk field onboarding visit',
          };
        }),
      };

      let result: BulkCustomerResponse;
      if (role === 'SUPER_ADMIN') {
        result = await adminApi.createBulkCustomers(payload);
      } else if (role === 'MANAGER') {
        result = await managerApi.createBulkCustomers(payload);
      } else {
        result = await sellerApi.createBulkCustomers(payload);
      }

      setSavedResult(result);
      onSuccess?.(result);
    } catch (err: any) {
      const msg = err.message || 'Failed to submit batch onboarding. Please check row details.';
      setSubmissionFeedback({ type: 'error', message: msg });
      Alert.alert('Batch Submission Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If saved confirmation is active, show the confirmation screen
  if (savedResult) {
    const custs = savedResult.customers || rows;
    return (
      <View style={styles.container}>
        <Header title="Customer Onboarding" subtitle="Batch Submission Complete" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentWrapper}>
            <SaveConfirmationCard
              count={savedResult.count || custs.length}
              customers={custs}
              hasPhoto={false}
              photoReason={defaultNoPhotoReason || 'Batch Field Onboarding'}
              hasGps={false}
              onReset={() => {
                setSavedResult(null);
                setRows([
                  createEmptyBatchRow(
                    defaultCategoryId,
                    defaultState,
                    defaultDistrict,
                    defaultVillage,
                    defaultNoPhotoReason,
                    defaultSellerId
                  ),
                ]);
              }}
              onDone={() => {
                onCancel?.();
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
        title="Batch Customer Onboarding"
        subtitle="Register 1 to 100 Outlets Simultaneously"
        showBack={Boolean(onCancel)}
        onBack={onCancel}
        rightAction={
          onSwitchToSingle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch to single customer form"
              style={styles.singleSwitchBtn}
              onPress={onSwitchToSingle}
              hitSlop={HitSlop.md}
            >
              <Ionicons name="person-add-outline" size={16} color={BrandColors.pink.dark} />
              <Text style={styles.singleSwitchText}>Single</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {/* Live IST Clock Header */}
          <ISTClock />

          {/* Submission Feedback Banner */}
          {submissionFeedback && (
            <FeedbackBanner
              type={submissionFeedback.type}
              message={submissionFeedback.message}
              onDismiss={() => setSubmissionFeedback(null)}
              style={{ marginVertical: Spacing.xs }}
            />
          )}

          {/* Defaults & Territory Toolbar Card */}
          <Card style={styles.defaultsCard}>
            <View style={styles.defaultsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.defaultsTitle}>Batch Shared Defaults</Text>
                <Text style={styles.defaultsSubtitle}>
                  Set common location and category values, then apply to all rows.
                </Text>
              </View>
              <Button
                title="Apply to All"
                size="sm"
                variant="secondary"
                icon={<Ionicons name="checkmark-done" size={14} color={BrandColors.pink.dark} />}
                onPress={handleApplyDefaultsToAll}
              />
            </View>

            {/* Pincode Lookup & Territory Auto-fill */}
            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Input
                  label="Default PIN Code"
                  placeholder="e.g. 411028"
                  value={defaultPincode}
                  onChangeText={handleDefaultPincodeChange}
                  keyboardType="numeric"
                  maxLength={6}
                  leftIcon={
                    pincodeLookupLoading ? (
                      <ActivityIndicator size="small" color={BrandColors.pink.primary} />
                    ) : (
                      <Ionicons name="search-outline" size={16} color="#94A3B8" />
                    )
                  }
                />
              </View>

              <View style={{ flex: 1 }}>
                <Input
                  label="Default District *"
                  placeholder="e.g. Pune"
                  value={defaultDistrict}
                  onChangeText={setDefaultDistrict}
                />
              </View>
            </View>

            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Input
                  label="Default Village / Town *"
                  placeholder="e.g. Hadapsar"
                  value={defaultVillage}
                  onChangeText={setDefaultVillage}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Input
                  label="Default State *"
                  placeholder="Maharashtra"
                  value={defaultState}
                  onChangeText={setDefaultState}
                />
              </View>
            </View>

            <Input
              label="Default Photo Exemption Reason *"
              placeholder="e.g. Bulk field onboarding visit"
              value={defaultNoPhotoReason}
              onChangeText={setDefaultNoPhotoReason}
            />

            {/* Category Selector Chips */}
            {categories.length > 0 && (
              <View style={styles.categorySection}>
                <Text style={styles.fieldLabel}>Default Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {categories.map((cat) => {
                    const isSelected = defaultCategoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setDefaultCategoryId(cat.id)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Seller Selector for Admin / Manager */}
            {(role === 'SUPER_ADMIN' || role === 'MANAGER') && sellers.length > 0 && (
              <View style={styles.categorySection}>
                <Text style={styles.fieldLabel}>Default Assigned Seller *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {sellers.map((s) => {
                    const isSelected = defaultSellerId === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setDefaultSellerId(s.id)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </Card>

          {/* Batch Actions & Stats Bar */}
          <View style={styles.actionBar}>
            <View style={styles.statsRow}>
              <Badge
                label={`${stats.valid}/${stats.total} Ready`}
                variant={stats.incomplete === 0 ? 'CONFIRMED' : 'ACTIVE'}
                size="md"
              />
              {duplicatePhones.size > 0 && (
                <Badge
                  label={`${duplicatePhones.size} Duplicate Phone(s)`}
                  variant="danger"
                  size="md"
                  style={{ marginLeft: 6 }}
                />
              )}
            </View>

            <View style={styles.actionButtonsRow}>
              <Pressable
                onPress={() => setImportModalVisible(true)}
                style={styles.iconActionBtn}
                accessibilityRole="button"
                accessibilityLabel="Import from Excel or CSV"
              >
                <Ionicons name="document-attach-outline" size={16} color={BrandColors.pink.dark} />
                <Text style={styles.iconActionText}>Import CSV</Text>
              </Pressable>

              <Pressable
                onPress={handleDownloadTemplate}
                style={styles.iconActionBtn}
                accessibilityRole="button"
                accessibilityLabel="Download CSV Template"
              >
                <Ionicons name="download-outline" size={16} color={BrandColors.pink.dark} />
                <Text style={styles.iconActionText}>Template</Text>
              </Pressable>

              <Pressable
                onPress={handleClearEmptyRows}
                style={styles.iconActionBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear empty rows"
              >
                <Ionicons name="trash-outline" size={16} color="#64748B" />
                <Text style={[styles.iconActionText, { color: '#64748B' }]}>Clear Empty</Text>
              </Pressable>
            </View>
          </View>

          {/* List of Customer Rows */}
          {rows.map((row, idx) => {
            const errs = getRowErrors(row);
            const isValid = errs.length === 0;
            const cleanPhone = (row.phone || '').replace(/\D/g, '').slice(-10);
            const isDup = duplicatePhones.has(cleanPhone);

            return (
              <Card
                key={row.clientId}
                style={[styles.rowCard, !isValid && styles.rowCardInvalid, isDup && styles.rowCardDuplicate]}
              >
                {/* Row Header */}
                <View style={styles.rowCardHeader}>
                  <View style={styles.rowNumberPill}>
                    <Text style={styles.rowNumberText}>#{idx + 1}</Text>
                  </View>
                  <Text style={styles.rowCardTitle} numberOfLines={1}>
                    {row.shopName || 'New Retail Customer'}
                  </Text>

                  <View style={styles.rowCardActions}>
                    <Pressable
                      onPress={() => handleDuplicateRow(idx)}
                      style={styles.rowCardIconBtn}
                      hitSlop={HitSlop.sm}
                    >
                      <Ionicons name="copy-outline" size={16} color="#64748B" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteRow(idx)}
                      style={styles.rowCardIconBtn}
                      hitSlop={HitSlop.sm}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>

                {/* Inline Validation Warnings */}
                {errs.length > 0 && (
                  <View style={styles.rowWarningBox}>
                    <Ionicons name="alert-circle" size={14} color="#B91C1C" style={{ marginRight: 4 }} />
                    <Text style={styles.rowWarningText}>{errs.join(' • ')}</Text>
                  </View>
                )}

                {/* Form Fields */}
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Input
                      label="Store / Shop Name *"
                      placeholder="e.g. Shree Ganesh Kirana"
                      value={row.shopName}
                      onChangeText={(v) => updateRowField(idx, 'shopName', v)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Contact Person *"
                      placeholder="e.g. Ramesh Patel"
                      value={row.contactName}
                      onChangeText={(v) => updateRowField(idx, 'contactName', v)}
                    />
                  </View>
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Input
                      label="Mobile Number (10 Digits) *"
                      placeholder="e.g. 9876543210"
                      value={row.phone}
                      onChangeText={(v) => updateRowField(idx, 'phone', v)}
                      keyboardType="phone-pad"
                      maxLength={14}
                      error={isDup ? 'Duplicate phone in batch' : undefined}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="PIN Code (6 Digits)"
                      placeholder="e.g. 411028"
                      value={row.pincode}
                      onChangeText={(v) => handleRowPincodeChange(idx, v)}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                  </View>
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Input
                      label="Village / Town *"
                      placeholder="e.g. Hadapsar"
                      value={row.village}
                      onChangeText={(v) => updateRowField(idx, 'village', v)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="District *"
                      placeholder="e.g. Pune"
                      value={row.district}
                      onChangeText={(v) => updateRowField(idx, 'district', v)}
                    />
                  </View>
                </View>

                <Input
                  label="Photo Exemption Reason *"
                  placeholder="e.g. Remote field onboarding visit"
                  value={row.noPhotoReason}
                  onChangeText={(v) => updateRowField(idx, 'noPhotoReason', v)}
                />
              </Card>
            );
          })}

          {/* Add Rows Buttons */}
          <View style={styles.addRowsContainer}>
            <Button
              title="+ Add Row"
              variant="secondary"
              size="sm"
              onPress={handleAddRow}
              style={{ flex: 1, marginRight: Spacing.xs }}
            />
            <Button
              title="+ Add 5 Rows"
              variant="secondary"
              size="sm"
              onPress={() => handleAddMultipleRows(5)}
              style={{ flex: 1 }}
            />
          </View>

          {/* Final Submit Button */}
          <View style={styles.submitSection}>
            <Button
              title={
                isSubmitting
                  ? `Submitting ${stats.valid} Customers...`
                  : `Register ${stats.valid} Customers (Atomic Batch)`
              }
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleSubmitBatch}
            />
          </View>
        </View>
      </ScrollView>

      {/* Excel / CSV Import Modal */}
      <Modal
        visible={importModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Paste Excel or CSV Data</Text>
                <Text style={styles.modalSubtitle}>
                  Copy columns from Google Sheets/Excel and paste below.
                </Text>
              </View>
              <Pressable
                onPress={() => setImportModalVisible(false)}
                hitSlop={HitSlop.md}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <TextInput
              style={styles.pasteTextArea}
              multiline
              numberOfLines={8}
              placeholder="Paste tab-separated or comma-separated rows here..."
              value={pasteContent}
              onChangeText={setPasteContent}
              textAlignVertical="top"
            />

            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
              <Button
                title="Parse & Preview"
                variant="secondary"
                size="sm"
                onPress={handleParsePasteData}
                style={{ flex: 1 }}
              />
            </View>

            {/* Import Preview Feedback */}
            {importPreview && (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>
                  Parsed: {importPreview.valid} valid records out of {importPreview.total} rows
                </Text>
                {importPreview.errors.length > 0 && (
                  <Text style={styles.previewErrorText}>
                    Issues: {importPreview.errors.slice(0, 3).join(', ')}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                  <Button
                    title={`Append (${importPreview.valid})`}
                    variant="primary"
                    size="sm"
                    onPress={() => handleApplyImportedRows('append')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Replace Table"
                    variant="secondary"
                    size="sm"
                    onPress={() => handleApplyImportedRows('replace')}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.md,
  },
  singleSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  singleSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
    marginLeft: 4,
  },
  defaultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  defaultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  defaultsTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '800',
    color: '#0F172A',
  },
  defaultsSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: '#64748B',
  },
  rowTwoCols: {
    flexDirection: 'row',
  },
  categorySection: {
    marginTop: Spacing.xs,
  },
  fieldLabel: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 6,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: BrandColors.pink.dark,
    borderColor: BrandColors.pink.dark,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.sm,
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.dark,
    marginLeft: 4,
  },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowCardInvalid: {
    borderColor: '#FCA5A5',
  },
  rowCardDuplicate: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  rowCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  rowNumberPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  rowNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  rowCardTitle: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  rowCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rowCardIconBtn: {
    padding: 4,
  },
  rowWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 6,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  rowWarningText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
    flex: 1,
  },
  addRowsContainer: {
    flexDirection: 'row',
    marginVertical: Spacing.sm,
  },
  submitSection: {
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 500,
    ...Elevation.high,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: '#64748B',
    marginTop: 2,
  },
  pasteTextArea: {
    height: 140,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewErrorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
  },
});

