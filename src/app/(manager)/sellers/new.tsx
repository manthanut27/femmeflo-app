import { Ionicons } from '@expo/vector-icons';
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
import { managerApi } from '@/api/manager';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, MaxContentWidth, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function OnboardSellerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Full name is required.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Valid email is required.';
    }
    if (!phone.trim() || phone.trim().length < 10) errs.phone = '10-digit mobile number is required.';
    if (password && password.length < 6) errs.password = 'Initial password must be at least 6 characters.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await managerApi.createSeller({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: password || undefined,
        district: user?.district || undefined,
        state: user?.state || undefined,
      });

      Alert.alert(
        'Seller Onboarded',
        `${name} has been added to your supervised field force.`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(manager)/sellers/' as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Onboarding Failed', err.message || 'Unable to create seller.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Onboard Field Officer" subtitle="Add Seller to Territory" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          <Text style={styles.sectionHeading}>Officer Details</Text>
          <Card style={styles.card}>
            <Input
              label="Full Name *"
              placeholder="e.g. Anand Sharma"
              value={name}
              onChangeText={setName}
              error={errors.name}
              leftIcon={<Ionicons name="person-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Email Address *"
              placeholder="e.g. anand@femmeflo.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Mobile Number *"
              placeholder="e.g. 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone}
              leftIcon={<Ionicons name="call-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Initial Password (Optional)"
              placeholder="Default generated if blank"
              value={password}
              onChangeText={setPassword}
              isPassword
              error={errors.password}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />}
            />
          </Card>

          <Card variant="flat" style={styles.territoryNotice}>
            <View style={styles.noticeRow}>
              <Ionicons name="location-outline" size={20} color={BrandColors.green.primary} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Automatic Territory Assignment</Text>
                <Text style={styles.noticeDesc}>
                  This seller will be assigned to your territory ({user?.district || 'General Area'}, {user?.state || 'India'}).
                </Text>
              </View>
            </View>
          </Card>

          <Button
            title={isSubmitting ? 'Onboarding...' : 'Create Field Officer'}
            onPress={handleSubmit}
            loading={isSubmitting}
            variant="secondary"
            size="lg"
            icon={<Ionicons name="person-add-outline" size={20} color="#FFFFFF" />}
            style={{ marginTop: Spacing.md, marginBottom: Spacing.xl }}
          />
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
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.md,
  },
  territoryNotice: {
    backgroundColor: Colors.light.successBg,
    borderColor: Colors.light.successBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.success,
    marginBottom: 2,
  },
  noticeDesc: {
    ...Typography.caption,
    color: Colors.light.success,
    lineHeight: 16,
  },
});
