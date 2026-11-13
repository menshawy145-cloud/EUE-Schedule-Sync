import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../styles/theme';
import { formatTime12h } from '../utils/timeFormat';

export const CourseCard = ({ course, onEdit, onDelete, onToggleCancel }) => {
  const isCancelled = course.is_cancelled;

  return (
    <View style={[styles.card, isCancelled && styles.cardCancelled]}>
      <View style={[styles.leftBar, isCancelled && styles.leftBarCancelled]} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.courseCode, isCancelled && styles.textStrikethrough]}>
              {course.course_code}
            </Text>
            {isCancelled && (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
              </View>
            )}
          </View>
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{formatTime12h(course.start_time)} - {formatTime12h(course.end_time)}</Text>
          </View>
        </View>
        
        <Text style={[styles.courseName, isCancelled && styles.textStrikethrough]}>
          {course.course_name}
        </Text>
        
        <View style={styles.footerRow}>
          <Text style={styles.roomText}>📍 {course.room_number || 'TBA'}</Text>
          
          <View style={styles.actions}>
            {onToggleCancel && (
              <TouchableOpacity onPress={() => onToggleCancel(course.id)} style={styles.actionBtn}>
                <Text style={isCancelled ? styles.restoreBtnText : styles.cancelBtnText}>
                  {isCancelled ? 'Restore' : 'Cancel this week'}
                </Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={() => onDelete(course.id)} style={styles.actionBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginVertical: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardCancelled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.8,
  },
  leftBar: {
    width: 6,
    backgroundColor: colors.primary,
  },
  leftBarCancelled: {
    backgroundColor: '#94A3B8',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  courseCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  cancelledBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  cancelledBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '800',
  },
  timeBadge: {
    backgroundColor: colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  courseName: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    marginLeft: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cancelBtnText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },
  restoreBtnText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  deleteBtnText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
});
