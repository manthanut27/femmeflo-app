import { useRouter } from 'expo-router';
import React from 'react';
import { BatchCustomerOnboarding } from '@/components/customers/BatchCustomerOnboarding';

export default function ManagerBulkCustomerScreen() {
  const router = useRouter();

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

