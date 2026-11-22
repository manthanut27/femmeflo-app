import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function ManagerQuickActionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const handleNewSale = () => {
    router.push('/(seller)/sales/new' as any);
  };

  const handleContactSupport = () => {
    Alert.alert(
      'FemmeFlo Field Support',
      'Contact our dedicated operational support desk for assistance with inventory, app sync, or area operations.',
      [
        {
          text: 'Call Helpline',
          onPress: () => Linking.openURL('tel:18001234567').catch(() => {}),
        },
        {
          text: 'Email Support',
          onPress: () =>
            Linking.openURL('mailto:support@femmeflo.com?subject=Territory%20Operations%20Support').catch(
              () => {}
            ),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header with Safe Area Insets & Clean Alignment */}
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 14 : 20) + 6,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quick Actions</Text>
        </View>
        <Text style={styles.headerSubtitle}>Choose what you want to do</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Top Featured Hero Card: New Sale */}
          <TouchableOpacity
            style={styles.heroActionCard}
            onPress={handleNewSale}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="New Sale: Record a new sale"
          >
            <View style={styles.heroIconBox}>
              <Ionicons name="cart" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text style={styles.heroActionTitle}>New Sale</Text>
              <Text style={styles.heroActionSubtitle}>Record a new sale</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Action Card 1: Daily Shift */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(seller)/shift' as any)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Daily Shift: Punch-In and Route"
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="time-outline" size={22} color="#881337" />
            </View>
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text style={styles.actionTitle}>Daily Shift</Text>
              <Text style={styles.actionSubtitle}>(Punch-In / Route)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Action Card 2: Check Van Stock */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(manager)/inventory' as any)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Check Inventory: View current stock"
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="cube-outline" size={22} color="#881337" />
            </View>
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text style={styles.actionTitle}>Check Inventory</Text>
              <Text style={styles.actionSubtitle}>View stock balance & transfers</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Action Card 3: Add New Shop */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(manager)/customers/new' as any)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Add New Shop: Register a new shop"
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="storefront-outline" size={22} color="#881337" />
            </View>
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text style={styles.actionTitle}>Add New Shop</Text>
              <Text style={styles.actionSubtitle}>Register a new shop</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Action Card 4: Manage Sellers */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(manager)/sellers' as any)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Manage Sellers: View and manage sellers"
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="people-outline" size={22} color="#881337" />
            </View>
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text style={styles.actionTitle}>Manage Sellers</Text>
              <Text style={styles.actionSubtitle}>View & manage sellers</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Action Card 5: All Sales */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(manager)/sales' as any)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="All Sales: Check sales history"
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="stats-chart-outline" size={22} color="#881337" />
            </View>
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text style={styles.actionTitle}>All Sales</Text>
              <Text style={styles.actionSubtitle}>Check sales history</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Need Support Section */}
          <View style={styles.supportSection}>
            <View style={styles.supportHeader}>
              <Text style={styles.supportStar}>✦</Text>
              <Text style={styles.supportHeaderText}>Need Support?</Text>
            </View>

            <TouchableOpacity
              style={styles.supportCard}
              onPress={handleContactSupport}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Contact Support: We're here to help"
            >
              <View style={styles.supportIconCircle}>
                <Ionicons name="headset-outline" size={22} color="#881337" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.supportCardTitle}>Contact Support</Text>
                <Text style={styles.supportCardSubtitle}>We're here to help</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#881337" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer City Skyline & Maroon Wave Vector Accent */}
        <View style={styles.footerSkylineContainer}>
          {/* Stylized Architectural Heritage Outline */}
          <View style={styles.monumentSkyline}>
            <View style={styles.skylinePillar} />
            <View style={styles.skylineDome} />
            <View style={styles.skylineTower} />
            <View style={styles.skylineArch} />
            <View style={styles.skylineTower} />
            <View style={styles.skylineDome} />
            <View style={styles.skylinePillar} />
          </View>

          {/* Fluid Maroon Wave Banner */}
          <View style={styles.footerWave} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF9FA',
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FBF9FA',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: 2,
    paddingRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    paddingLeft: 34,
  },
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroActionCard: {
    backgroundColor: '#881337',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroActionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF1F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  supportSection: {
    marginTop: 18,
    marginBottom: 24,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  supportStar: {
    color: '#881337',
    fontSize: 12,
    marginRight: 6,
  },
  supportHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#881337',
  },
  supportCard: {
    backgroundColor: '#FFF1F4',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#881337',
  },
  supportCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  footerSkylineContainer: {
    marginTop: 'auto',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    paddingTop: 20,
  },
  monumentSkyline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    opacity: 0.35,
    marginBottom: -4,
  },
  skylinePillar: {
    width: 8,
    height: 40,
    backgroundColor: '#FDA4AF',
    borderRadius: 2,
  },
  skylineDome: {
    width: 24,
    height: 30,
    backgroundColor: '#FDA4AF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  skylineTower: {
    width: 14,
    height: 58,
    backgroundColor: '#FDA4AF',
    borderRadius: 3,
  },
  skylineArch: {
    width: 38,
    height: 46,
    borderWidth: 3,
    borderColor: '#FDA4AF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 0,
  },
  footerWave: {
    width: '100%',
    height: 38,
    backgroundColor: '#881337',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
});
