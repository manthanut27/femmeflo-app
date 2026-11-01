import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, type BadgeVariant } from './Badge';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';

export interface DropdownOption {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: BadgeVariant;
  metadata?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

interface SearchableDropdownModalProps {
  visible: boolean;
  title: string;
  searchPlaceholder?: string;
  options: DropdownOption[];
  selectedId?: string;
  onSelect: (option: DropdownOption) => void;
  onClose: () => void;
  emptyMessage?: string;
}

export function SearchableDropdownModal({
  visible,
  title,
  searchPlaceholder = 'Search options...',
  options,
  selectedId,
  onSelect,
  onClose,
  emptyMessage = 'No matching options found',
}: SearchableDropdownModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const matchTitle = opt.title.toLowerCase().includes(q);
      const matchSubtitle = opt.subtitle ? opt.subtitle.toLowerCase().includes(q) : false;
      const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(q) : false;
      const matchMeta = opt.metadata ? opt.metadata.toLowerCase().includes(q) : false;
      return matchTitle || matchSubtitle || matchBadge || matchMeta;
    });
  }, [options, searchQuery]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const handleSelect = (item: DropdownOption) => {
    setSearchQuery('');
    onSelect(item);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={styles.backdropDismiss} onPress={handleClose} />

        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>
                {options.length} {options.length === 1 ? 'option' : 'options'} available
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close selection modal"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={Colors.light.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={18} color={Colors.light.textTertiary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.light.textPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Options List */}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                    item.disabled && styles.optionItemDisabled,
                  ]}
                  onPress={() => !item.disabled && handleSelect(item)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: item.disabled }}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.optionIconBox,
                        isSelected && styles.optionIconBoxSelected,
                      ]}
                    >
                      <Ionicons
                        name={item.icon || 'layers-outline'}
                        size={18}
                        color={isSelected ? '#FFFFFF' : BrandColors.pink.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.optionTitle,
                            isSelected && styles.optionTitleSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {item.badge ? (
                          <Badge
                            label={item.badge}
                            variant={item.badgeVariant || (isSelected ? 'ACTIVE' : 'neutral')}
                            size="sm"
                          />
                        ) : null}
                      </View>
                      {item.subtitle ? (
                        <Text
                          style={[
                            styles.optionSubtitle,
                            isSelected && styles.optionSubtitleSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={BrandColors.pink.primary} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={36} color={Colors.light.textTertiary} />
                <Text style={styles.emptyTitle}>{emptyMessage}</Text>
                <Text style={styles.emptySub}>Try searching with different keywords</Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface DropdownTriggerProps {
  label: string;
  required?: boolean;
  value?: string;
  subtitle?: string;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: string;
  onPress: () => void;
  error?: string;
}

export function DropdownTrigger({
  label,
  required,
  value,
  subtitle,
  placeholder = 'Tap to select...',
  icon = 'chevron-down-circle-outline',
  badge,
  onPress,
  error,
}: DropdownTriggerProps) {
  const hasValue = Boolean(value);

  return (
    <View style={styles.triggerWrapper}>
      <Text style={styles.triggerLabel}>
        {label} {required ? <Text style={styles.requiredStar}>*</Text> : null}
      </Text>

      <TouchableOpacity
        style={[
          styles.triggerBox,
          hasValue && styles.triggerBoxFilled,
          Boolean(error) && styles.triggerBoxError,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
      >
        <View style={styles.triggerLeft}>
          <View style={[styles.triggerIconBox, hasValue && styles.triggerIconBoxFilled]}>
            <Ionicons
              name={icon}
              size={18}
              color={hasValue ? BrandColors.pink.primary : Colors.light.textTertiary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={[styles.triggerValueText, !hasValue && styles.triggerPlaceholderText]}
                numberOfLines={1}
              >
                {value || placeholder}
              </Text>
              {badge ? <Badge label={badge} variant="ACTIVE" size="sm" /> : null}
            </View>
            {subtitle ? (
              <Text style={styles.triggerSubText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.chevronBox}>
          <Ionicons name="chevron-down" size={18} color={Colors.light.textSecondary} />
        </View>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    minHeight: '45%',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Shadows.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sheetTitle: {
    ...Typography.titleMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  sheetSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
    color: Colors.light.textPrimary,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginVertical: 4,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  optionItemSelected: {
    backgroundColor: BrandColors.pink.surface,
    borderColor: BrandColors.pink.border,
  },
  optionItemDisabled: {
    opacity: 0.5,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionIconBoxSelected: {
    backgroundColor: BrandColors.pink.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  optionTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    fontSize: 14,
  },
  optionTitleSelected: {
    color: BrandColors.pink.dark,
    fontWeight: '700',
  },
  optionSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  optionSubtitleSelected: {
    color: BrandColors.pink.dark,
  },
  checkBadge: {
    marginLeft: Spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginTop: Spacing.sm,
  },
  emptySub: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  // Trigger Styles
  triggerWrapper: {
    marginBottom: Spacing.md,
  },
  triggerLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    marginBottom: 6,
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: '700',
  },
  triggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 52,
    ...Shadows.sm,
  },
  triggerBoxFilled: {
    borderColor: BrandColors.pink.border,
    backgroundColor: BrandColors.pink.surface,
  },
  triggerBoxError: {
    borderColor: '#DC2626',
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  triggerIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  triggerIconBoxFilled: {
    backgroundColor: BrandColors.pink.subtle,
  },
  triggerValueText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  triggerPlaceholderText: {
    color: Colors.light.textPlaceholder,
    fontWeight: '400',
  },
  triggerSubText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  chevronBox: {
    paddingLeft: 4,
  },
  errorText: {
    ...Typography.caption,
    color: '#DC2626',
    marginTop: 4,
  },
});
