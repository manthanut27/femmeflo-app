import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BatchCustomerOnboarding } from '@/components/customers/BatchCustomerOnboarding';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { canOnboardCustomers } from '@/utils/permissions';

export default function ManagerBulkCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  if (!canOnboardCustomers(user)) {
    return (
      <View style={styles.container}>
        <Header title="Batch Customer Onboarding" subtitle="Bulk Registration" showBack />
        <View style={styles.restrictedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="Access Restricted"
            description="You do not have permission to onboard customers in bulk. Please contact your administrator to request 'Onboard new customers' permission."
            iconColor={Colors.light.danger}
            iconBgColor={Colors.light.dangerBg}
            actionTitle="Back to Customers"
            buttonVariant="secondary"
            onAction={() => router.replace('/(manager)/customers' as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <BatchCustomerOnboarding
      role="MANAGER"
      onCancel={() => router.replace('/(manager)/customers' as any)}
      onSwitchToSingle={() => router.replace('/(manager)/customers/new' as any)}
      onSuccess={() => {
        // Confirmation card handles action
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
