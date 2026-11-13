import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import { colors, spacing } from '../styles/theme';

export const FriendsScreen = ({ navigation }) => {
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <ScrollView style={styles.container}>
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
        <Text style={styles.sectionTitle}>Connected Friends ({friends.length})</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No connected friends yet. Search above to sync schedules!</Text>
          </View>
        ) : (
          friends.map((friend) => (
            <View key={friend.id} style={styles.friendRow}>
              <View>
                <Text style={styles.friendName}>{friend.full_name}</Text>
                <Text style={styles.friendId}>ID: #{friend.student_id}</Text>
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
          ))
        )}
      </View>
    </ScrollView>
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
});
