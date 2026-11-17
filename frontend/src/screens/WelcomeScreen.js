import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../styles/theme';

export const WelcomeScreen = () => {
  const { user, completeOnboarding } = useContext(AuthContext);

  const handleUploadTimetable = () => {
    completeOnboarding('Schedule');
  };

  const handleGoDashboard = () => {
    completeOnboarding('Dashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.wrapper}>
          {/* Top Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>EUE</Text>
            </View>
            <Text style={styles.welcomeTag}>🎉 ACCOUNT VERIFIED & READY</Text>
            <Text style={styles.title}>
              Welcome to EUE,{'\n'}
              <Text style={styles.titleHighlight}>{user?.full_name || 'Student'}!</Text>
            </Text>

            {user?.student_id ? (
              <View style={styles.idBadge}>
                <Text style={styles.idBadgeLabel}>STUDENT ID</Text>
                <Text style={styles.idBadgeValue}>#{user.student_id}</Text>
              </View>
            ) : null}
          </View>

          {/* Quick-Start Cards Container */}
          <View style={styles.contentCard}>
            <Text style={styles.sectionHeading}>Quick Start Guide</Text>
            <Text style={styles.sectionSubtitle}>
              Here is how to get the most out of your EUE Schedule Sync app:
            </Text>

            {/* Feature Card 1 */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <Text style={styles.iconText}>📸</Text>
              </View>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>Auto-Fill Your Timetable</Text>
                <Text style={styles.featureDesc}>
                  Upload a photo or PDF of your EUE schedule (IFP, UoL CS, or UCLan Engineering). AI scans and organizes your week in seconds.
                </Text>
              </View>
            </View>

            {/* Feature Card 2 */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                <Text style={styles.iconText}>👥</Text>
              </View>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>Sync With Friends</Text>
                <Text style={styles.featureDesc}>
                  Search classmates by their 8-digit Student ID. Timetables stay completely private until connection requests are accepted.
                </Text>
              </View>
            </View>

            {/* Feature Card 3 */}
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Text style={styles.iconText}>🟢</Text>
              </View>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>See Who's Free on Campus</Text>
                <Text style={styles.featureDesc}>
                  Live Cairo-time status shows who is Free, In Class, or Not Coming Today. Find common free periods with friends at a glance.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleUploadTimetable}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>📸 Upload My Timetable Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleGoDashboard}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Go to Dashboard →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  wrapper: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoBadge: {
    backgroundColor: colors.accent,
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  welcomeTag: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
  },
  titleHighlight: {
    color: '#60A5FA',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  idBadgeLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginRight: 6,
  },
  idBadgeValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  contentCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  iconText: {
    fontSize: 20,
  },
  featureBody: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  actionsContainer: {
    marginTop: spacing.md,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
