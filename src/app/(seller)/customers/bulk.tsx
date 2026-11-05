import { ShiftRequiredGate } from '@/components/common/ShiftRequiredGate';
import { BatchCustomerOnboarding } from '@/components/customers/BatchCustomerOnboarding';
import { BrandColors, Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { checkHasActiveShift } from '@/utils/shiftGuard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function SellerBulkCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);
  const [checkingShift, setCheckingShift] = useState(true);

  useEffect(() => {
    checkHasActiveShift(user?.id).then((res) => {
      setHasActiveShift(res.hasActiveShift);
      setCheckingShift(false);
    });
  }, [user?.id]);

  if (checkingShift) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.light.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={BrandColors.pink.primary} />
      </View>
    );
  }

  if (hasActiveShift === false) {
    return (
      <ShiftRequiredGate
        title="Batch Customer Onboarding"
        subtitle="Daily Duty Shift Required"
        actionName="batch onboard new retail stores"
        onGoBack={() => router.replace('/(seller)/customers' as any)}
      />
    );
  }

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
