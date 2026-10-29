import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, HitSlop, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleReset() {
    setError(null);

    if (!token.trim()) {
      setError('Please enter the reset token received via email.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({ token: token.trim(), newPassword });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Token may be expired or invalid.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.containerBox}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={() => router.back()}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="arrow-back" size={20} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Enter the reset token sent to your email and create a new secure password.
            </Text>
          </View>

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color="#B4234D" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {isSuccess ? (
              <View style={styles.successContainer} accessibilityRole="alert">
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-done" size={28} color="#059669" />
                </View>
                <Text style={styles.successTitle}>Password Updated!</Text>
                <Text style={styles.successDesc}>
                  Your password has been successfully reset. You can now sign in with your new credentials.
                </Text>
                <Button
                  title="Go to Sign In"
                  onPress={() => router.replace('/(auth)/login' as any)}
                  variant="primary"
                  size="lg"
                  style={{ marginTop: Spacing.md, width: '100%' }}
                />
              </View>
            ) : (
              <>
                <Input
                  label="Reset Token"
                  placeholder="Paste token from email"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                  leftIcon={<Ionicons name="key-outline" size={18} color="#94A3B8" />}
                />

                <Input
                  label="New Password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  isPassword
                  leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />}
                />

                <Input
                  label="Confirm Password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword
                  leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color="#94A3B8" />}
                />

                <Button
                  title={isSubmitting ? 'Updating...' : 'Set New Password'}
                  onPress={handleReset}
                  loading={isSubmitting}
                  size="lg"
                  style={{ marginTop: Spacing.sm }}
                />
              </>
            )}
          </View>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerBox: {
    width: '100%',
    maxWidth: 440,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    ...Typography.bodyMedium,
    color: BrandColors.pink.primary,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.display,
    fontSize: 24,
    color: Colors.light.heading,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.dangerBg,
    borderWidth: 1,
    borderColor: Colors.light.dangerBorder,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.light.danger,
    flex: 1,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.successBg,
    borderWidth: 1.5,
    borderColor: Colors.light.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  successTitle: {
    ...Typography.h2,
    color: Colors.light.success,
    marginBottom: Spacing.xs,
  },
  successDesc: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
});
