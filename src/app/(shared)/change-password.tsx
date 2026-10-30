import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import {
  BorderRadius,
  Colors,
  Elevation,
  Spacing,
  Typography,
} from '@/constants/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit() {
    if (isSubmitting) return;
    setError(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setSuccessMsg('Your password has been successfully updated.');
      Alert.alert('Password Changed', 'Your password has been successfully updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Change Password" subtitle="Security & Credentials" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.containerBox}>
          {/* Security Notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.light.info} />
            <Text style={styles.noticeText}>
              Choose a strong password containing at least 6 characters. Do not share your login credentials with others.
            </Text>
          </View>

          {error ? (
            <FeedbackBanner
              type="error"
              message={error}
              onDismiss={() => setError(null)}
              style={{ marginBottom: Spacing.md }}
            />
          ) : null}

          {successMsg ? (
            <FeedbackBanner
              type="success"
              message={successMsg}
              onDismiss={() => setSuccessMsg(null)}
              style={{ marginBottom: Spacing.md }}
            />
          ) : null}

          <Card style={styles.card}>
            <Input
              label="Current Password *"
              placeholder="Enter current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              isPassword
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.light.textTertiary} />}
            />

            <Input
              label="New Password *"
              placeholder="At least 6 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              isPassword
              leftIcon={<Ionicons name="key-outline" size={18} color={Colors.light.textTertiary} />}
            />

            <Input
              label="Confirm New Password *"
              placeholder="Re-type new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              error={error}
              leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color={Colors.light.textTertiary} />}
            />

            <Button
              title={isSubmitting ? 'Updating...' : 'Update Password'}
              onPress={handleSubmit}
              loading={isSubmitting}
              variant="primary"
              size="lg"
              icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    alignItems: 'center',
    paddingBottom: Spacing.huge,
  },
  containerBox: {
    width: '100%',
    maxWidth: 480,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.light.infoBg,
    borderColor: Colors.light.infoBorder,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  noticeText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.light.infoText,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
    ...Elevation.low,
  },
});
