import { managerApi } from '@/api/manager';
import { StoreDetailView } from '@/components/customers/StoreDetailView';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function ManagerCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <StoreDetailView
      role="manager"
      customerId={id}
      getCustomer={(cid) => managerApi.getCustomer(cid)}
      updateCustomer={(cid, payload) => managerApi.updateCustomer(cid, payload)}
      uploadPhoto={(cid, uri) => managerApi.uploadCustomerPhoto(cid, uri)}
      listSales={(params) => managerApi.listSales(params as any)}
      backRoute="/(manager)/customers"
      canCreateSale={false}
      salesRoutePrefix="/(manager)/sales"
    />
  );
}
