import React from 'react';
import { SaleDetailView } from '@/app/(seller)/sales/[id]';

export default function ManagerSaleDetailScreen() {
  return <SaleDetailView salesListRoute="/(manager)/sales" />;
}
