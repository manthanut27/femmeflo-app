import { useRouter } from 'expo-router';
import React from 'react';
import { BatchCustomerOnboarding } from '@/components/customers/BatchCustomerOnboarding';

export default function AdminBulkCustomerScreen() {
  const router = useRouter();

  return (
    <BatchCustomerOnboarding
      role="SUPER_ADMIN"
      onCancel={() => router.replace('/(admin)/customers' as any)}
      onSwitchToSingle={() => router.replace('/(admin)/customers/new' as any)}
      onSuccess={() => {
        // Confirmation card handles action
      }}
    />
  );
}

