import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { BrandColors, Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { FaceVerificationModal, type FaceVerificationResult } from './FaceVerificationModal';

interface FaceVerificationGateProps {
  children: React.ReactNode;
}

export function FaceVerificationGate({ children }: FaceVerificationGateProps) {
  const { user, state, logout } = useAuth();
  const [isFaceVerified, setIsFaceVerified] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(true);

  const isAuthenticated = state === 'AUTHENTICATED' || state === 'OFFLINE_AUTHENTICATED';
  const requiresGate = Boolean(
    isAuthenticated &&
      user &&
      (user.role === 'SELLER' || user.role === 'MANAGER' || user.isSeller)
  );

  // Reset face verification when logged out or session expires
  useEffect(() => {
    if (!isAuthenticated) {
      setIsFaceVerified(false);
      setModalVisible(true);
    }
  }, [isAuthenticated, user?.id]);

  if (!requiresGate || isFaceVerified) {
    return <>{children}</>;
  }

  const handleVerified = (result: FaceVerificationResult) => {
    if (result.faceVerified) {
      setIsFaceVerified(true);
      setModalVisible(false);
    }
  };

  const roleLabel =
    user?.role === 'MANAGER'
      ? user.isSeller
        ? 'Territory Manager & Sales Officer'
        : 'Territory Manager'
      : 'Field Sales Officer';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.cardContainer}>
        {/* Brand & Security Header */}
        <View style={styles.shieldIconWrapper}>
          <Ionicons name="shield-checkmark" size={48} color={BrandColors.pink.primary} />
        </View>

        <Text style={styles.title}>Biometric Face Verification</Text>
        <Text style={styles.subtitle}>
          Mandatory identity security check before app access
        </Text>

        {/* User Card */}
        <View style={styles.userInfoBox}>
          <Ionicons name="person-circle-outline" size={24} color={BrandColors.pink.dark} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.userName}>{user?.name || 'Field Officer'}</Text>
            <Text style={styles.userRole}>{roleLabel}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Pending</Text>
          </View>
        </View>

        {/* Explanation info */}
        <View style={styles.infoBanner}>
          <Ionicons name="camera-outline" size={20} color="#0369A1" style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={styles.infoText}>
            For field compliance and transaction safety, live camera face verification is required every time the app opens before navigating to any screen.
          </Text>
        </View>

        {/* Open Camera Verification Trigger */}
        <Button
          title="Verify Live Face (Open Camera)"
          variant="primary"
          size="lg"
          icon={<Ionicons name="camera" size={20} color="#FFFFFF" />}
          onPress={() => setModalVisible(true)}
          style={styles.verifyBtn}
        />

        {/* Switch Account Option */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => logout()}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={16} color="#64748B" />
          <Text style={styles.signOutText}>Switch Account / Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Face Verification Modal (requires explicit selfie or device biometric) */}
      <FaceVerificationModal
        visible={modalVisible}
        mode="APP_OPEN"
        userName={user?.name || 'Officer'}
        userRole={roleLabel}
        autoLaunch={false}
        onClose={() => setModalVisible(false)}
        onVerified={handleVerified}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.md,
  },
  shieldIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  title: {
    ...Typography.headingMedium,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  userInfoBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    marginBottom: Spacing.md,
  },
  userName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#0F172A',
  },
  userRole: {
    ...Typography.caption,
    color: BrandColors.pink.dark,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  infoBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: Spacing.lg,
  },
  infoText: {
    ...Typography.caption,
    color: '#0369A1',
    flex: 1,
    lineHeight: 18,
  },
  verifyBtn: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  signOutText: {
    ...Typography.bodySmall,
    color: '#64748B',
    fontWeight: '600',
  },
});
