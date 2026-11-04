import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import {
  BrandColors,
  Colors,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';

export interface ShiftRequiredGateProps {
  title?: string;
  subtitle?: string;
  actionName?: string;
  onStartShift?: () => void;
  onGoBack?: () => void;
}

export function ShiftRequiredGate({
  title = 'Duty Shift Required',
  subtitle = 'Field Operations Policy',
  actionName = 'onboard new retailers or access store sales',
  onStartShift,
  onGoBack,
}: ShiftRequiredGateProps) {
  const router = useRouter();

  function handleStartShift() {
    if (onStartShift) {
      onStartShift();
    } else {
      router.push('/(seller)/shift' as any);
    }
  }

  function handleGoBack() {
    if (onGoBack) {
      onGoBack();
    } else {
      router.replace('/(seller)' as any);
    }
  }

  return (
    <View style={styles.container}>
      <Header
        title={title}
        subtitle={subtitle}
        showBack
        onBack={handleGoBack}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.contentWrapper}>
          <Card style={styles.gateCard} variant="elevated">
            <View style={styles.iconCircle}>
              <Ionicons name="camera-outline" size={32} color="#FFFFFF" />
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusBadgeText}>ATTENDANCE REQUIRED</Text>
              </View>
            </View>

            <Text style={styles.title}>Start Your Duty Shift First</Text>
            <Text style={styles.description}>
              To {actionName}, you must first start your daily duty shift with your vehicle odometer reading and selfie attendance verification.
            </Text>

            <View style={styles.checklist}>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={18} color={BrandColors.green.primary} />
                <Text style={styles.checkText}>Face ID biometric selfie verification</Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={18} color={BrandColors.green.primary} />
                <Text style={styles.checkText}>Initial vehicle odometer KM logging</Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={18} color={BrandColors.green.primary} />
                <Text style={styles.checkText}>Automatic GPS location lock & timestamp</Text>
              </View>
            </View>

            <View style={styles.buttonGroup}>
              <Button
                title="Start Duty Shift with Selfie"
                variant="secondary"
                size="lg"
                icon={<Ionicons name="play-circle-outline" size={20} color="#FFFFFF" />}
                onPress={handleStartShift}
                style={styles.primaryBtn}
              />
              <Button
                title="Return to Home Dashboard"
                variant="ghost"
                size="md"
                onPress={handleGoBack}
                style={styles.secondaryBtn}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  gateCard: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    ...Shadows.md,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: BrandColors.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  badgeRow: {
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    marginRight: 6,
  },
  statusBadgeText: {
    ...Typography.caption,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  title: {
    ...Typography.h2,
    color: Colors.light.heading,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  description: {
    ...Typography.bodyMedium,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  checklist: {
    width: '100%',
    backgroundColor: Colors.light.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkText: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.light.text,
    fontWeight: '600',
  },
  buttonGroup: {
    width: '100%',
    gap: Spacing.sm,
  },
  primaryBtn: {
    width: '100%',
  },
  secondaryBtn: {
    width: '100%',
  },
});
