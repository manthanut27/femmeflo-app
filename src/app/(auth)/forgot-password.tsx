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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleSend() {
    setError(null);
    setSuccessMessage(null);

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please provide a valid registered email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.forgotPassword(trimmed);
      setSuccessMessage(res.message || 'Password reset instructions have been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Unable to process reset request. Please check email address.');
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
            <Text style={styles.backButtonText}>Back to Sign In</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your registered email and we will send instructions to regain access.
            </Text>
          </View>

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color="#B4234D" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBanner} accessibilityRole="alert">
                <View style={styles.successRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Enter reset token"
                  hitSlop={HitSlop.md}
                  style={styles.resetTokenLink}
                  onPress={() => router.push('/(auth)/reset-password' as any)}
                >
                  <Text style={styles.resetTokenText}>Have a reset token? Enter it here →</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Input
                  label="Registered Email"
                  placeholder="e.g. yourname@femmeflo.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
                />

                <Button
                  title={isSubmitting ? 'Sending...' : 'Send Reset Instructions'}
                  onPress={handleSend}
                  loading={isSubmitting}
                  size="lg"
                  style={styles.submitBtn}
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
  successBanner: {
    backgroundColor: Colors.light.successBg,
    borderWidth: 1,
    borderColor: Colors.light.successBorder,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  successText: {
    ...Typography.bodySmall,
    color: Colors.light.success,
    lineHeight: 20,
    flex: 1,
  },
  resetTokenLink: {
    marginTop: Spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  resetTokenText: {
    color: BrandColors.green.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
});
