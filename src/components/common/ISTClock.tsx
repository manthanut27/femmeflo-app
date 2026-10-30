import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateIST, formatTimeIST } from '@/utils/dateUtils';
import { BorderRadius, BrandColors, Colors, Spacing, Typography } from '@/constants/theme';

interface ISTClockProps {
  showBadge?: boolean;
  style?: object;
}

export function ISTClock({ showBadge = true, style }: ISTClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateString = formatDateIST(now, 'medium');
  const timeString = formatTimeIST(now, true);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <Ionicons name="time-outline" size={16} color={BrandColors.pink.dark} style={{ marginRight: 6 }} />
        <Text style={styles.timeText}>{timeString}</Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.dateText}>{dateString}</Text>
      </View>
      {showBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>IST (UTC+5:30)</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    marginVertical: Spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  timeText: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: '#881337',
    fontVariant: ['tabular-nums'],
  },
  separator: {
    marginHorizontal: 6,
    color: '#FDA4AF',
    fontWeight: '600',
  },
  dateText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: '#4C0519',
  },
  badge: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9F1239',
    letterSpacing: 0.3,
  },
});

