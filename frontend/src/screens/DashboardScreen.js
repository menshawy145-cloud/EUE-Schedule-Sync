import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { CourseCard } from '../components/CourseCard';
import { FriendCard } from '../components/FriendCard';
import { colors, spacing } from '../styles/theme';
import { formatTime12h } from '../utils/timeFormat';

export const DashboardScreen = ({ navigation }) => {
  const { user, logout } = useContext(AuthContext);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendFilter, setFriendFilter] = useState('ALL'); // 'ALL' | 'FREE' | 'IN_CLASS' | 'OFF_CAMPUS'

  // Time-shift state: 'NOW' | 'NEXT_BREAK' | 'TOMORROW'
  const [timeMode, setTimeMode] = useState('NOW');
  const [tomorrowTime, setTomorrowTime] = useState('10:00');

  const fetchDashboard = useCallback(async (mode = timeMode, tTime = tomorrowTime) => {
    try {
      let dayOffset = 0;
      let targetTime = null;

      if (mode === 'NEXT_BREAK') {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 90);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        targetTime = `${h}:${m}`;
      } else if (mode === 'TOMORROW') {
        dayOffset = 1;
        targetTime = tTime || '10:00';
      }

      const data = await api.dashboard.getDashboard(dayOffset, targetTime);
      setDashboardData(data);
    } catch (err) {
      console.warn("Failed to load dashboard:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeMode, tomorrowTime]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard(timeMode, tomorrowTime);
  };

  const handleTimeModeChange = (mode) => {
    setTimeMode(mode);
    setRefreshing(true);
    fetchDashboard(mode, tomorrowTime);
  };

  const handleTomorrowTimeChange = (tTime) => {
    setTomorrowTime(tTime);
    setRefreshing(true);
    fetchDashboard('TOMORROW', tTime);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const myStatus = dashboardData?.my_status;
  const myOnCampus = myStatus?.on_campus_today !== false;

  const filteredFriends = (dashboardData?.free_friends || []).filter(friend => {
    const onCampus = friend.on_campus_today !== false;
    if (friendFilter === 'FREE') return onCampus && friend.is_free;
    if (friendFilter === 'IN_CLASS') return onCampus && !friend.is_free;
    if (friendFilter === 'OFF_CAMPUS') return !onCampus;
    return true;
  });

  return (
    <ScrollView 
      style={styles.container} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.full_name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.studentBadge}>
            <Text style={styles.studentBadgeText}>ID: {user?.student_id}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={{ marginLeft: 8, backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}>
            <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '700' }}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick-Toggle Pills: Now / Next Break / Tomorrow */}
      <View style={styles.timeSwitchContainer}>
        <View style={styles.timeSwitchRow}>
          <TouchableOpacity
            style={[styles.timePill, timeMode === 'NOW' && styles.timePillActive]}
            onPress={() => handleTimeModeChange('NOW')}
          >
            <Text style={[styles.timePillText, timeMode === 'NOW' && styles.timePillTextActive]}>
              🟢 Now
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timePill, timeMode === 'NEXT_BREAK' && styles.timePillActive]}
            onPress={() => handleTimeModeChange('NEXT_BREAK')}
          >
            <Text style={[styles.timePillText, timeMode === 'NEXT_BREAK' && styles.timePillTextActive]}>
              ⏭️ Next Break (+90m)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timePill, timeMode === 'TOMORROW' && styles.timePillActive]}
            onPress={() => handleTimeModeChange('TOMORROW')}
          >
            <Text style={[styles.timePillText, timeMode === 'TOMORROW' && styles.timePillTextActive]}>
              📅 Tomorrow ({tomorrowTime})
            </Text>
          </TouchableOpacity>
        </View>

        {timeMode === 'TOMORROW' && (
          <View style={styles.tomorrowTimeRow}>
            <Text style={styles.tomorrowTimeLabel}>Target Time:</Text>
            {['08:30', '10:00', '11:30', '13:30', '15:00', '16:30'].map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[styles.subTimePill, tomorrowTime === slot && styles.subTimePillActive]}
                onPress={() => handleTomorrowTimeChange(slot)}
              >
                <Text style={[styles.subTimePillText, tomorrowTime === slot && styles.subTimePillTextActive]}>
                  {formatTime12h(slot + ':00')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Current User Status Banner */}
      <View style={[
        styles.statusBanner,
        !myOnCampus ? styles.offCampusBanner : myStatus?.in_class ? styles.inClassBanner : styles.freeBanner
      ]}>
        <View style={styles.statusBannerHeader}>
          <Text style={styles.statusBannerTitle}>
            {!myOnCampus
              ? (timeMode === 'TOMORROW' ? '🏠 Tomorrow Day Off — No Classes Scheduled' : '🏠 Day Off — You Have No Classes Today')
              : myStatus?.in_class
              ? (timeMode === 'TOMORROW' ? '🔴 Class Scheduled at Tomorrow Preview Time' : timeMode === 'NEXT_BREAK' ? '🔴 Class at Next Period' : '🔴 You are Currently in Class')
              : (timeMode === 'TOMORROW' ? '🟢 Free on Campus at Tomorrow Preview Time' : timeMode === 'NEXT_BREAK' ? '🟢 Free on Campus at Next Break' : '🟢 You are Free on Campus Right Now')}
          </Text>
          <Text style={styles.dayTimeText}>
            {dashboardData?.today_day} • {formatTime12h(dashboardData?.current_time)}
          </Text>
        </View>

        {!myOnCampus && (
          <Text style={styles.statusBannerDetail}>
            You have no scheduled classes on {dashboardData?.today_day} ({timeMode === 'TOMORROW' ? "won't be coming to campus tomorrow" : "not coming to campus today"}).
          </Text>
        )}

        {myOnCampus && myStatus?.in_class && myStatus?.current_course && (
          <Text style={styles.statusBannerDetail}>
            {myStatus.current_course.course_code} - {myStatus.current_course.course_name} (until {formatTime12h(myStatus.current_course.end_time)})
          </Text>
        )}

        {myOnCampus && !myStatus?.in_class && myStatus?.next_course && (
          <Text style={styles.statusBannerDetail}>
            Next Class: {myStatus.next_course.course_code} at {formatTime12h(myStatus.next_course.start_time)}
          </Text>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {timeMode === 'TOMORROW' ? 'My Classes Tomorrow' : 'My Classes Today'} ({dashboardData?.today_day})
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Schedule')}>
          <Text style={styles.seeAllText}>Full Week →</Text>
        </TouchableOpacity>
      </View>

      {dashboardData?.my_schedule_today?.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            🏠 Day Off! You have no classes scheduled for {dashboardData?.today_day} ({timeMode === 'TOMORROW' ? "won't be on campus tomorrow" : "not coming to campus"}).
          </Text>
        </View>
      ) : (
        dashboardData?.my_schedule_today?.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))
      )}

      <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
        <Text style={styles.sectionTitle}>Friends Campus Status</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Friends')}>
          <Text style={styles.seeAllText}>Manage ({dashboardData?.free_friends?.length || 0}) →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
        {[
          { key: 'ALL', label: 'All Friends' },
          { key: 'FREE', label: '🟢 Free on Campus' },
          { key: 'IN_CLASS', label: '🔴 In Class' },
          { key: 'OFF_CAMPUS', label: '🏠 Not Coming Today' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.chip, friendFilter === item.key && styles.activeChip]}
            onPress={() => setFriendFilter(item.key)}
          >
            <Text style={[styles.chipText, friendFilter === item.key && styles.activeChipText]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredFriends.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {friendFilter === 'ALL' 
              ? 'No friends connected yet. Search peers by Student ID in the Friends tab!' 
              : 'No friends match this filter right now.'}
          </Text>
        </View>
      ) : (
        filteredFriends.map((friend) => (
          <FriendCard
            key={friend.friend_id}
            friend={friend}
            onViewSchedule={(f) => navigation.navigate('FriendSchedule', { friendId: f.friend_id, friendName: f.full_name, studentId: f.student_id })}
          />
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  welcomeText: { fontSize: 13, color: colors.textSecondary },
  userName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  studentBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  studentBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  timeSwitchContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  timePillTextActive: {
    color: '#fff',
  },
  tomorrowTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
  },
  tomorrowTimeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginRight: 6,
  },
  subTimePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.inputBg,
    marginRight: 4,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTimePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  subTimePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subTimePillTextActive: {
    color: '#fff',
  },
  statusBanner: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  freeBanner: { backgroundColor: colors.successLight, borderColor: colors.success, borderWidth: 1 },
  inClassBanner: { backgroundColor: colors.warningLight, borderColor: colors.warning, borderWidth: 1 },
  offCampusBanner: { backgroundColor: '#F1F5F9', borderColor: '#94A3B8', borderWidth: 1 },
  statusBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  dayTimeText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  statusBannerDetail: { fontSize: 13, color: colors.textPrimary, marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  seeAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  chipsContainer: { flexDirection: 'row', marginVertical: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  activeChipText: { color: '#fff' },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
