import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { BrandColors, Colors, Spacing } from '@/constants/theme';

export default function EmptyStateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    description?: string;
    icon?: string;
    actionTitle?: string;
    actionRoute?: string;
  }>();

  const title = params.title || 'No Records Found';
  const description =
    params.description ||
    'There are currently no items, records, or active tasks to display in this view.';
  const icon = (params.icon as keyof typeof Ionicons.glyphMap) || 'file-tray-outline';
  const actionTitle = params.actionTitle || 'Return to Dashboard';

  function handleAction() {
    if (params.actionRoute) {
      router.push(params.actionRoute as any);
    } else {
      router.back();
    }
  }

  return (
    <View style={styles.container}>
      <Header title="Overview" subtitle="Empty State View" showBack />
      <View style={styles.content}>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          actionTitle={actionTitle}
          onAction={handleAction}
          iconColor={BrandColors.pink.primary}
          iconBgColor={BrandColors.pink.subtle}
          iconBorderColor={BrandColors.pink.tint}
          buttonVariant="primary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
});

