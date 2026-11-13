import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../services/api';
import { CourseCard } from '../components/CourseCard';
import { colors, spacing } from '../styles/theme';
import { formatTime12h } from '../utils/timeFormat';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const FriendScheduleScreen = ({ route, navigation }) => {
  const { friendId, friendName, studentId } = route.params;
  const [selectedDay, setSelectedDay] = useState('Saturday');
  const [scheduleData, setScheduleData] = useState(null);
  const [overlapData, setOverlapData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFriendData = useCallback(async () => {
    try {
      setLoading(true);
      const [friendRes, overlapRes] = await Promise.all([
        api.friends.getFriendSchedule(friendId),
        api.schedules.getFriendOverlap(friendId),
      ]);
      setScheduleData(friendRes);
      setOverlapData(overlapRes);
    } catch (err) {
      alert(err.message || 'Error fetching friend timetable');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [friendId, navigation]);

  useEffect(() => {
    fetchFriendData();
  }, [fetchFriendData]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const dayCourses = (scheduleData?.schedules || []).filter(
    (s) => s.day_of_week === selectedDay
  );
  const activeDayCourses = dayCourses.filter((s) => !s.is_cancelled);
  const isFriendComingOnDay = activeDayCourses.length > 0;

  const dayOverlapSlots = (overlapData?.common_free_slots || []).filter(
    (slot) => slot.day === selectedDay
  );

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.banner}>
        <Text style={styles.friendName}>{friendName}'s Timetable</Text>
        <Text style={styles.studentId}>Student ID: #{studentId} • Verified EUE Peer</Text>
      </View>

      {/* Day Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
        {DAYS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dayTab, selectedDay === d && styles.activeDayTab]}
            onPress={() => setSelectedDay(d)}
          >
            <Text style={[styles.dayTabText, selectedDay === d && styles.activeDayTabText]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        {/* Mutual Free Time or Not Coming Notice */}
        {!isFriendComingOnDay ? (
          <View style={styles.notComingCard}>
            <Text style={styles.notComingTitle}>🏠 Not Coming to Campus on {selectedDay}</Text>
            <Text style={styles.notComingSubtitle}>
              {friendName} has no active classes scheduled on {selectedDay} (Day Off).
            </Text>
          </View>
        ) : (
          <View style={styles.overlapCard}>
            <Text style={styles.overlapTitle}>✨ Mutual Free Times on {selectedDay}</Text>
            {dayOverlapSlots.length === 0 ? (
              <Text style={styles.overlapEmpty}>No common free windows found on this day.</Text>
            ) : (
              dayOverlapSlots.map((slot, idx) => (
                <View key={idx} style={styles.freeSlotBadge}>
                  <Text style={styles.freeSlotDot}>🟢</Text>
                  <Text style={styles.freeSlotText}>{formatTime12h(slot.start_time)} to {formatTime12h(slot.end_time)} ({slot.duration_minutes} mins free together)</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Classes List */}
        <Text style={styles.sectionTitle}>{friendName}'s Classes on {selectedDay}</Text>
        {dayCourses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>🏠 {friendName} has no classes on {selectedDay} — Not coming to campus.</Text>
          </View>
        ) : (
          dayCourses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner: { backgroundColor: colors.primary, padding: spacing.md },
  friendName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  studentId: { fontSize: 12, color: '#A0AEC0', marginTop: 2 },
  dayScroll: { maxHeight: 50, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayTab: { paddingHorizontal: 16, paddingVertical: 14 },
  activeDayTab: { borderBottomWidth: 3, borderBottomColor: colors.accent },
  dayTabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  activeDayTabText: { color: colors.primary, fontWeight: '700' },
  content: { padding: spacing.md },
  notComingCard: {
    backgroundColor: '#F1F5F9',
    borderColor: '#94A3B8',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  notComingTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 4 },
  notComingSubtitle: { fontSize: 13, color: '#475569' },
  overlapCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  overlapTitle: { fontSize: 14, fontWeight: '700', color: '#065F46', marginBottom: spacing.xs },
  overlapEmpty: { fontSize: 12, color: '#065F46', marginTop: 2 },
  freeSlotBadge: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  freeSlotDot: { fontSize: 10, marginRight: 6 },
  freeSlotText: { fontSize: 13, fontWeight: '600', color: '#047857' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyCard: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
});
