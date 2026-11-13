import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../styles/theme';

export const FriendCard = ({ friend, onViewSchedule }) => {
  const onCampus = friend.on_campus_today !== false;
  const isFree = friend.is_free && onCampus;

  let badgeBg = colors.warningLight;
  let dotColor = colors.warning;
  let badgeText = 'IN CLASS';

  if (!onCampus) {
    badgeBg = '#E2E8F0';
    dotColor = '#64748B';
    badgeText = 'NOT COMING TODAY';
  } else if (isFree) {
    badgeBg = colors.successLight;
    dotColor = colors.success;
    badgeText = 'FREE ON CAMPUS';
  }

  return (
    <View style={[styles.card, !onCampus && styles.cardOffCampus]}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.name}>{friend.full_name}</Text>
          <Text style={styles.studentId}>ID: #{friend.student_id}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.statusBadgeText, { color: dotColor }]}>
            {badgeText}
          </Text>
        </View>
      </View>

      <Text style={styles.statusDetail}>{friend.status_text}</Text>

      {onViewSchedule && (
        <TouchableOpacity style={styles.viewScheduleBtn} onPress={() => onViewSchedule(friend)}>
          <Text style={styles.viewScheduleText}>View Timetable & Free Slots →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardOffCampus: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  studentId: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginVertical: spacing.xs,
  },
  viewScheduleBtn: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewScheduleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
