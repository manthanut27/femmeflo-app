import { useRouter } from 'expo-router';
import React from 'react';
import { BatchCustomerOnboarding } from '@/components/customers/BatchCustomerOnboarding';

export default function SellerBulkCustomerScreen() {
  const router = useRouter();

  return (
    <BatchCustomerOnboarding
      role="SELLER"
      onCancel={() => router.replace('/(seller)/customers' as any)}
      onSwitchToSingle={() => router.replace('/(seller)/customers/new' as any)}
      onSuccess={() => {
        // Confirmation card handles action
      }}
    />
  );
}

