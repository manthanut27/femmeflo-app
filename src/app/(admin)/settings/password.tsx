import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

export default function AdminChangePasswordScreen() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isMinLength = newPassword.length >= 12;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isByteLimitOk = new TextEncoder().encode(newPassword).length <= 72;
  const canSubmit = Boolean(currentPassword) && isMinLength && isMatch && isByteLimitOk && !isSubmitting;

  async function handleSubmit() {
    if (!currentPassword) {
      setFeedback({ type: 'error', message: 'Please enter your current password.' });
      return;
    }
    if (!isMinLength) {
      setFeedback({ type: 'error', message: 'New password must be at least 12 characters.' });
      return;
    }
    if (!isByteLimitOk) {
      setFeedback({ type: 'error', message: 'New password must not exceed 72 bytes.' });
      return;
    }
    if (!isMatch) {
      setFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Password Changed Successfully',
        'Your Super Admin master credentials have been updated.',
        [
          {
            text: 'Return to Settings',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      const msg = err.message || 'Failed to change password. Please check your current password.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Change Password"
        subtitle="Super Admin Master Security"
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
            onPress={() => router.back()}
            hitSlop={HitSlop.md}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.headerBackText}>Settings</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: Spacing.md }}
            />
          )}

          {/* Security Notice Card */}
          <Card style={styles.card}>
            <View style={styles.securityHeaderRow}>
              <View style={styles.securityIconCircle}>
                <Ionicons name="shield-checkmark" size={22} color={BrandColors.pink.dark} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.securityCardTitle}>Super Admin Master Credentials</Text>
                <Text style={styles.securityCardSubtitle}>
                  This credential secures full executive administrative access over FemmeFlo inventory, approvals, and payroll.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Inputs */}
            <Input
              label="Current Password *"
              placeholder="Enter your current master password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.light.textTertiary} />}
              rightIcon={
                <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)} hitSlop={HitSlop.md}>
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.light.textTertiary}
                  />
                </Pressable>
              }
            />

            <Input
              label="New Master Password *"
              placeholder="Minimum 12 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              helperText={
                newPassword.length > 0 && !isMinLength
                  ? 'Password must be at least 12 characters'
                  : 'Requires 12 to 72 characters'
              }
              leftIcon={<Ionicons name="key-outline" size={18} color={Colors.light.textTertiary} />}
              rightIcon={
                <Pressable onPress={() => setShowNewPassword(!showNewPassword)} hitSlop={HitSlop.md}>
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.light.textTertiary}
                  />
                </Pressable>
              }
            />

            <Input
              label="Confirm New Password *"
              placeholder="Re-enter new master password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              helperText={
                confirmPassword.length > 0 && !isMatch
                  ? 'Passwords do not match'
                  : undefined
              }
              leftIcon={<Ionicons name="checkmark-done-outline" size={18} color={Colors.light.textTertiary} />}
              rightIcon={
                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={HitSlop.md}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.light.textTertiary}
                  />
                </Pressable>
              }
            />

            {/* Requirements Checklist */}
            <View style={styles.checklist}>
              <Text style={styles.checklistHeading}>Password Policy Checklist:</Text>
              <View style={styles.checkItem}>
                <Ionicons
                  name={isMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={isMinLength ? BrandColors.green.primary : Colors.light.textTertiary}
                />
                <Text style={[styles.checkText, isMinLength && styles.checkTextDone]}>
                  At least 12 characters in length
                </Text>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={isMatch ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={isMatch ? BrandColors.green.primary : Colors.light.textTertiary}
                />
                <Text style={[styles.checkText, isMatch && styles.checkTextDone]}>
                  New passwords match identically
                </Text>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={currentPassword.length > 0 ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={currentPassword.length > 0 ? BrandColors.green.primary : Colors.light.textTertiary}
                />
                <Text style={[styles.checkText, currentPassword.length > 0 && styles.checkTextDone]}>
                  Current password verified
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="lg"
                style={{ flex: 1, marginRight: Spacing.sm }}
                onPress={() => router.back()}
                disabled={isSubmitting}
              />
              <Button
                title={isSubmitting ? 'Updating...' : 'Update Password'}
                variant="admin"
                size="lg"
                style={{ flex: 1.5 }}
                loading={isSubmitting}
                disabled={!canSubmit}
                onPress={handleSubmit}
                icon={<Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />}
              />
            </View>
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
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerBackText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  securityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  securityIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityCardTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  securityCardSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: Spacing.md,
  },
  checklist: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: Spacing.md,
    gap: Spacing.xs,
  },
  checklistHeading: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
  },
  checkTextDone: {
    color: Colors.light.textPrimary,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
});

