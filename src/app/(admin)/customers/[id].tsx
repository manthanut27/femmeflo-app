import { adminApi } from '@/api/admin';
import { StoreDetailView } from '@/components/customers/StoreDetailView';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function AdminCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <StoreDetailView
      role="admin"
      customerId={id}
      getCustomer={(cid) => adminApi.getCustomer(cid)}
      updateCustomer={(cid, payload) => adminApi.updateCustomer(cid, payload)}
      uploadPhoto={(cid, uri) => adminApi.uploadCustomerPhoto(cid, uri)}
      listSales={(params) => adminApi.listSales(params as any)}
      backRoute="/(admin)/customers"
      canCreateSale={false}
      salesRoutePrefix="/(seller)/sales"
    />
  );
}
