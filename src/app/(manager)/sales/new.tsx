import React from 'react';
import { NewSaleView } from '@/app/(seller)/sales/new';

export default function ManagerNewSaleScreen() {
  return <NewSaleView salesListRoute="/(manager)/sales" attendanceRoute="/(manager)/attendance" />;
}
