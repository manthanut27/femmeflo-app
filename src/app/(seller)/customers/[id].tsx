import { sellerApi } from '@/api/seller';
import { StoreDetailView } from '@/components/customers/StoreDetailView';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function SellerCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <StoreDetailView
      role="seller"
      customerId={id}
      getCustomer={(cid) => sellerApi.getCustomer(cid)}
      updateCustomer={(cid, payload) => sellerApi.updateCustomer(cid, payload)}
      uploadPhoto={(cid, uri) => sellerApi.uploadCustomerPhoto(cid, uri)}
      listSales={(params) => sellerApi.listSales(params)}
      backRoute="/(seller)/customers"
      canCreateSale={true}
      salesRoutePrefix="/(seller)/sales"
    />
  );
}
