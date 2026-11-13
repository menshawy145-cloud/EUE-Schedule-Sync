import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { api } from '../services/api';
import { colors, spacing } from '../styles/theme';

export const FriendsScreen = ({ navigation }) => {
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  // Group Free-Time states
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupSlots, setGroupSlots] = useState([]);
  const [groupError, setGroupError] = useState('');

  const loadSocialData = useCallback(async () => {
    try {
      setLoading(true);
      const [pending, friendList] = await Promise.all([
        api.friends.getPendingRequests(),
        api.friends.getAll(),
      ]);
      setPendingRequests(pending);
      setFriends(friendList);
    } catch (err) {
      console.warn("Failed to load social data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    try {
      setSearching(true);
      setSearchResult(null);
      const res = await api.users.searchByStudentId(searchId.trim());
      setSearchResult(res);
    } catch (err) {
      Alert.alert('Search Result', err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;
    try {
      const res = await api.friends.sendRequest(searchResult.student_id);
      Alert.alert('Success', res.message);
      setSearchResult(null);
      setSearchId('');
      loadSocialData();
    } catch (err) {
      Alert.alert('Request Failed', err.message);
    }
  };

  const handleRespond = async (requestId, action) => {
    try {
      const res = await api.friends.respondRequest(requestId, action);
      Alert.alert('Sync Request', res.message);
      loadSocialData();
    } catch (err) {
      Alert.alert('Action Failed', err.message);
    }
  };

  const handleRemoveFriend = (friendId, name) => {
    Alert.alert('Disconnect Peer', `Stop sharing schedules with ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.friends.removeFriend(friendId);
            loadSocialData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const toggleFriendSelection = (friendId) => {
    setSelectedFriendIds((prev) => {
      if (prev.includes(friendId)) {
        return prev.filter((id) => id !== friendId);
      } else {
        if (prev.length >= 10) {
          Alert.alert('Limit Reached', 'You can select up to 10 friends for group overlap.');
          return prev;
        }
        return [...prev, friendId];
      }
    });
  };

  const handleFindGroupFreeTime = async () => {
    if (selectedFriendIds.length < 2) {
      Alert.alert('Select Friends', 'Please check at least 2 friends to find group free time.');
      return;
    }
    setGroupModalVisible(true);
    setGroupLoading(true);
    setGroupError('');
    setGroupSlots([]);
    try {
      const slots = await api.schedules.getGroupOverlap(selectedFriendIds);
      setGroupSlots(slots || []);
    } catch (err) {
      setGroupError(err.message || 'Failed to calculate group free time.');
    } finally {
      setGroupLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: isGroupMode && selectedFriendIds.length >= 2 ? 90 : 30 }}>
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Find Peer by Student ID</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter Student ID (e.g. 2546)"
              placeholderTextColor={colors.textSecondary}
              value={searchId}
              onChangeText={setSearchId}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Search</Text>}
            </TouchableOpacity>
          </View>

          {searchResult && (
            <View style={styles.searchCard}>
              <View>
                <Text style={styles.resultName}>{searchResult.full_name}</Text>
                <Text style={styles.resultId}>Student ID: #{searchResult.student_id}</Text>
              </View>
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendRequest}>
                <Text style={styles.sendBtnText}>Send Sync Request</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Incoming Sync Requests ({pendingRequests.length})</Text>
            {pendingRequests.map((req) => (
              <View key={req.id} style={styles.requestCard}>
                <View>
                  <Text style={styles.reqName}>{req.sender?.full_name || 'EUE Student'}</Text>
                  <Text style={styles.reqId}>ID: #{req.sender?.student_id}</Text>
                </View>
                <View style={styles.reqActions}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(req.id, 'ACCEPT')}>
                    <Text style={styles.btnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRespond(req.id, 'REJECT')}>
                    <Text style={styles.rejectBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.friendsHeaderRow}>
            <Text style={styles.sectionTitle}>Connected Friends ({friends.length})</Text>
            {friends.length >= 2 && (
              <TouchableOpacity
                style={[styles.groupToggleBtn, isGroupMode && styles.groupToggleBtnActive]}
                onPress={() => {
                  const nextMode = !isGroupMode;
                  setIsGroupMode(nextMode);
                  if (!nextMode) setSelectedFriendIds([]);
                }}
              >
                <Text style={[styles.groupToggleText, isGroupMode && styles.groupToggleTextActive]}>
                  {isGroupMode ? '✕ Cancel Selection' : '👥 Group Free Time'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isGroupMode && (
            <View style={styles.groupInstructionCard}>
              <Text style={styles.groupInstructionTitle}>👥 Group Campus Overlap Mode</Text>
              <Text style={styles.groupInstructionText}>
                Check 2 or more friends below to find all campus windows when the entire group is free together (only on days where everyone has classes).
              </Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No connected friends yet. Search above to sync schedules!</Text>
            </View>
          ) : (
            friends.map((friend) => {
              const isSelected = selectedFriendIds.includes(friend.id);
              return (
                <View key={friend.id} style={[styles.friendRow, isSelected && styles.friendRowSelected]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {isGroupMode && (
                      <TouchableOpacity
                        style={[styles.checkbox, isSelected && styles.checkboxActive]}
                        onPress={() => toggleFriendSelection(friend.id)}
                      >
                        <Text style={[styles.checkboxText, isSelected && styles.checkboxTextActive]}>
                          {isSelected ? '✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ marginLeft: isGroupMode ? 8 : 0, flex: 1 }}>
                      <Text style={styles.friendName}>{friend.full_name}</Text>
                      <Text style={styles.friendId}>ID: #{friend.student_id}</Text>
                    </View>
                  </View>
                  <View style={styles.friendBtnGroup}>
                    <TouchableOpacity
                      style={styles.viewScheduleBtn}
                      onPress={() => navigation.navigate('FriendSchedule', { friendId: friend.id, friendName: friend.full_name, studentId: friend.student_id })}
                    >
                      <Text style={styles.viewScheduleText}>Timetable</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemoveFriend(friend.id, friend.full_name)}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button for Group Free Time */}
      {isGroupMode && selectedFriendIds.length >= 2 && (
        <View style={styles.floatingActionBar}>
          <TouchableOpacity style={styles.floatingActionBtn} onPress={handleFindGroupFreeTime}>
            <Text style={styles.floatingActionBtnText}>
              👥 Find Group Free Time ({selectedFriendIds.length} Friends)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Group Free Time Results Modal */}
      <Modal
        visible={groupModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>👥 Group Free Time</Text>
                <Text style={styles.modalSubtitle}>
                  You + {selectedFriendIds.length} Friends
                </Text>
              </View>
              <TouchableOpacity onPress={() => setGroupModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {groupLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.modalLoadingText}>Finding campus free-time overlap...</Text>
              </View>
            ) : groupError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>⚠️ {groupError}</Text>
                <TouchableOpacity style={styles.modalRetryBtn} onPress={handleFindGroupFreeTime}>
                  <Text style={styles.modalRetryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : groupSlots.length === 0 ? (
              <View style={styles.modalEmptyBox}>
                <Text style={styles.modalEmptyIcon}>⏳</Text>
                <Text style={styles.modalEmptyTitle}>No Mutual Campus Free Time</Text>
                <Text style={styles.modalEmptyText}>
                  We found no free time windows (30+ minutes) between 08:30 and 18:00 where every member of the group has active classes on campus at the same time.
                </Text>
                <Text style={styles.modalEmptyHint}>
                  Note: Group free times are only calculated on days when EVERY member has active campus classes.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.campusRuleBanner}>
                  <Text style={styles.campusRuleText}>
                    ✨ Only showing days when everyone in this group is coming to campus.
                  </Text>
                </View>
                {groupSlots.map((slot, index) => (
                  <View key={index} style={styles.slotCard}>
                    <View style={styles.slotHeader}>
                      <View style={styles.dayBadge}>
                        <Text style={styles.dayBadgeText}>{slot.day}</Text>
                      </View>
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationBadgeText}>{slot.duration_minutes} mins free</Text>
                      </View>
                    </View>
                    <Text style={styles.slotDisplayText}>{slot.display_text}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setGroupModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  searchSection: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  searchRow: { flexDirection: 'row' },
  searchInput: { flex: 1, backgroundColor: colors.inputBg, borderRadius: 8, padding: 10, fontSize: 14, marginRight: spacing.sm },
  searchBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  resultName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  resultId: { fontSize: 12, color: colors.textSecondary },
  sendBtn: { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  sendBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  section: { marginTop: spacing.lg },
  requestCard: { backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  reqName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  reqId: { fontSize: 12, color: colors.textSecondary },
  reqActions: { flexDirection: 'row' },
  acceptBtn: { backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rejectBtn: { backgroundColor: colors.inputBg, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  rejectBtnText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  friendRow: { backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  friendName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  friendId: { fontSize: 12, color: colors.textSecondary },
  friendBtnGroup: { flexDirection: 'row', alignItems: 'center' },
  viewScheduleBtn: { backgroundColor: colors.primaryLight, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
  viewScheduleText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  removeBtn: { padding: 6 },
  removeText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  friendsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  groupToggleBtn: { backgroundColor: colors.accentLight || '#EDE9FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.accent },
  groupToggleBtnActive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  groupToggleText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  groupToggleTextActive: { color: '#DC2626' },
  groupInstructionCard: { backgroundColor: '#F0F9FF', borderColor: '#38BDF8', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.sm },
  groupInstructionTitle: { fontSize: 13, fontWeight: '700', color: '#0369A1', marginBottom: 2 },
  groupInstructionText: { fontSize: 12, color: '#0C4A6E', lineHeight: 16 },
  friendRowSelected: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: '#FAF5FF' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxText: { fontSize: 12, color: '#fff' },
  checkboxTextActive: { color: '#fff', fontWeight: '800' },
  floatingActionBar: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  floatingActionBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  floatingActionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.card, width: '100%', maxWidth: 500, maxHeight: '85%', borderRadius: 16, padding: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: { padding: 8 },
  modalCloseText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  modalCenter: { padding: spacing.xl, alignItems: 'center' },
  modalLoadingText: { marginTop: spacing.md, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  modalErrorBox: { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: spacing.md },
  modalErrorText: { color: '#B91C1C', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  modalRetryBtn: { backgroundColor: '#EF4444', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 14, alignSelf: 'center' },
  modalRetryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalEmptyBox: { alignItems: 'center', padding: spacing.lg },
  modalEmptyIcon: { fontSize: 36, marginBottom: spacing.xs },
  modalEmptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  modalEmptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: spacing.sm },
  modalEmptyHint: { fontSize: 12, color: '#64748B', fontStyle: 'italic', textAlign: 'center', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6 },
  modalScroll: { maxHeight: 380, marginVertical: spacing.xs },
  campusRuleBanner: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: spacing.sm },
  campusRuleText: { color: '#1E40AF', fontSize: 12, fontWeight: '600' },
  slotCard: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dayBadge: { backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  dayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  durationBadge: { backgroundColor: '#DCFCE7', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#86EFAC' },
  durationBadgeText: { color: '#166534', fontSize: 11, fontWeight: '700' },
  slotDisplayText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  modalDoneBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: spacing.md },
  modalDoneBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
