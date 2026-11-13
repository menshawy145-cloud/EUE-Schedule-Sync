import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { api } from '../services/api';
import { CourseCard } from '../components/CourseCard';
import { colors, spacing } from '../styles/theme';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const EUE_PERIODS = [
  { label: 'P1 (8:30 AM - 10:00 AM)', start: '08:30:00', end: '10:00:00' },
  { label: 'P2 (10:00 AM - 11:30 AM)', start: '10:00:00', end: '11:30:00' },
  { label: 'P3 (11:30 AM - 1:00 PM)', start: '11:30:00', end: '13:00:00' },
  { label: 'P4 (1:30 PM - 3:00 PM)', start: '13:30:00', end: '15:00:00' },
  { label: 'P5 (3:00 PM - 4:30 PM)', start: '15:00:00', end: '16:30:00' },
  { label: 'P6 (4:30 PM - 6:00 PM)', start: '16:30:00', end: '18:00:00' },
];

export const ScheduleScreen = () => {
  const [selectedDay, setSelectedDay] = useState('Saturday');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual Add Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('10:00');
  const [roomNumber, setRoomNumber] = useState('Room A-412');

  // Timetable AI Scanner Modal
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isPdf, setIsPdf] = useState(false);
  const [detectedCourses, setDetectedCourses] = useState([]);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.schedules.getAll(selectedDay);
      setSchedules(data);
    } catch (err) {
      console.warn('Failed to load schedules:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Open Real File Picker on Web / Mobile (Accepts Images and PDFs)
  const handlePickTimetableFile = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf,application/pdf';
      input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const isPdfFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        setIsPdf(isPdfFile);
        setSelectedFileName(file.name);

        if (!isPdfFile) {
          try {
            setSelectedImagePreview(URL.createObjectURL(file));
          } catch (_) {
            setSelectedImagePreview(null);
          }
        } else {
          setSelectedImagePreview(null);
        }

        setDetectedCourses([]);
        setScanModalVisible(true);
        await parseTimetableWithBackendAI(file);
      };
      input.click();
    } else {
      setScanModalVisible(true);
    }
  };

  // Call Backend Gemini Vision Parser
  const parseTimetableWithBackendAI = async (file) => {
    try {
      setScanning(true);
      setScanStatusText('Reading your timetable with AI...');
      const courses = await api.schedules.uploadTimetableImage(file);
      if (Array.isArray(courses) && courses.length > 0) {
        setDetectedCourses(courses);
        setScanStatusText(`✅ Successfully read ${courses.length} courses! Review and edit any field below before saving.`);
      } else {
        setDetectedCourses([]);
        setScanStatusText('No classes detected. You can add course rows manually below.');
      }
    } catch (err) {
      setScanStatusText('Error reading timetable: ' + (err.message || 'Server error'));
    } finally {
      setScanning(false);
    }
  };

  const updateDetectedCourse = (index, field, value) => {
    const updated = [...detectedCourses];
    updated[index] = { ...updated[index], [field]: value };
    setDetectedCourses(updated);
  };

  const removeDetectedRow = (index) => {
    setDetectedCourses(detectedCourses.filter((_, idx) => idx !== index));
  };

  const addBlankDetectedRow = () => {
    setDetectedCourses([
      ...detectedCourses,
      {
        course_code: 'FP0010',
        course_name: 'Course Name',
        day_of_week: selectedDay,
        start_time: '08:30:00',
        end_time: '10:00:00',
        room_number: 'Room A-412',
      },
    ]);
  };

  const handleConfirmBatchSave = async () => {
    if (detectedCourses.length === 0) {
      alert('No courses to save. Add at least one course row.');
      return;
    }
    try {
      setScanning(true);
      await api.schedules.createBatch(detectedCourses);
      setScanModalVisible(false);
      fetchSchedules();
    } catch (err) {
      alert('Save error: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleManualAdd = async () => {
    if (!courseCode.trim() || !courseName.trim()) {
      alert('Please fill in course code and name.');
      return;
    }
    try {
      await api.schedules.create({
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        day_of_week: selectedDay,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        room_number: roomNumber.trim(),
      });
      setModalVisible(false);
      fetchSchedules();
    } catch (err) {
      alert(err.message || 'Failed to save course');
    }
  };

  const handleToggleCancel = async (courseId) => {
    try {
      await api.schedules.toggleCancel(courseId);
      fetchSchedules();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClearAll = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Reset Timetable: Are you sure you want to clear your entire schedule?')
      : true;
    if (confirmed) {
      await api.schedules.clearAll();
      fetchSchedules();
    }
  };

  const handleDelete = async (courseId) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Remove this course from your schedule?')
      : true;
    if (confirmed) {
      await api.schedules.delete(courseId);
      fetchSchedules();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.scanBtn} onPress={handlePickTimetableFile}>
          <Text style={styles.scanBtnText}>📸 Upload Timetable (Photo / PDF)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Add Course</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
          <Text style={styles.clearBtnText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      {/* Days Tabs */}
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

      {/* Course List */}
      <ScrollView style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.dayTitle}>{selectedDay}'s Timetable</Text>
          <Text style={styles.courseCount}>{schedules.length} class(es)</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : schedules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>🏠 No classes on {selectedDay} (Not coming to campus / Day Off)</Text>
            <Text style={styles.emptySubtitle}>
              Click "📸 Upload Timetable (Photo / PDF)" to select your schedule image or PDF from your computer or phone, or click "+ Add Course".
            </Text>
          </View>
        ) : (
          schedules.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              onDelete={handleDelete}
              onToggleCancel={handleToggleCancel}
            />
          ))
        )}
      </ScrollView>

      {/* Modal: Timetable Upload (Image/PDF), Preview & Editable Courses */}
      <Modal visible={scanModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.scanModalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>📄 Timetable Import</Text>
              <TouchableOpacity onPress={handlePickTimetableFile} style={styles.reuploadBtn}>
                <Text style={styles.reuploadBtnText}>Choose Another File</Text>
              </TouchableOpacity>
            </View>

            {/* Uploaded Image or PDF Preview */}
            {selectedImagePreview && (
              <View style={styles.previewImageContainer}>
                <Image
                  source={{ uri: selectedImagePreview }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>
            )}
            {isPdf && (
              <View style={styles.pdfBadge}>
                <Text style={styles.pdfBadgeText}>📄 {selectedFileName || 'PDF Timetable Document'}</Text>
              </View>
            )}

            <Text style={styles.scanSubtitle}>{scanStatusText}</Text>

            {scanning ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {detectedCourses.map((c, i) => (
                  <View key={i} style={styles.editableRow}>
                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                      <TextInput
                        style={[styles.miniInput, { width: 80, fontWeight: '700' }]}
                        value={c.course_code}
                        placeholder="Code"
                        onChangeText={(v) => updateDetectedCourse(i, 'course_code', v)}
                      />
                      <TextInput
                        style={[styles.miniInput, { flex: 1, marginLeft: 6 }]}
                        value={c.course_name}
                        placeholder="Course Name"
                        onChangeText={(v) => updateDetectedCourse(i, 'course_name', v)}
                      />
                      <TouchableOpacity onPress={() => removeDetectedRow(i)} style={styles.removeRowBtn}>
                        <Text style={{ color: colors.danger, fontWeight: '800' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <TextInput
                        style={[styles.miniInput, { width: 95 }]}
                        value={c.day_of_week}
                        placeholder="Day"
                        onChangeText={(v) => updateDetectedCourse(i, 'day_of_week', v)}
                      />
                      <TextInput
                        style={[styles.miniInput, { width: 70, marginLeft: 6 }]}
                        value={c.start_time.slice(0, 5)}
                        placeholder="08:30"
                        onChangeText={(v) => updateDetectedCourse(i, 'start_time', v)}
                      />
                      <TextInput
                        style={[styles.miniInput, { width: 70, marginLeft: 6 }]}
                        value={c.end_time.slice(0, 5)}
                        placeholder="10:00"
                        onChangeText={(v) => updateDetectedCourse(i, 'end_time', v)}
                      />
                      <TextInput
                        style={[styles.miniInput, { flex: 1, marginLeft: 6 }]}
                        value={c.room_number || ''}
                        placeholder="Room"
                        onChangeText={(v) => updateDetectedCourse(i, 'room_number', v)}
                      />
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.addRowBtn} onPress={addBlankDetectedRow}>
                  <Text style={styles.addRowBtnText}>+ Add Another Course Row</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleConfirmBatchSave} disabled={scanning}>
                <Text style={styles.saveBtnText}>Save All ({detectedCourses.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Manual Course Add */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Course to {selectedDay}</Text>

            <Text style={styles.label}>Quick Select EUE Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {EUE_PERIODS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.periodChip}
                  onPress={() => {
                    setStartTime(p.start.slice(0, 5));
                    setEndTime(p.end.slice(0, 5));
                  }}
                >
                  <Text style={styles.periodChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Course Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. FP0012 or CS101"
              value={courseCode}
              onChangeText={setCourseCode}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Course Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Economics (Lecture)"
              value={courseName}
              onChangeText={setCourseName}
            />

            <View style={styles.timeRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="08:30"
                  value={startTime}
                  onChangeText={setStartTime}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10:00"
                  value={endTime}
                  onChangeText={setEndTime}
                />
              </View>
            </View>

            <Text style={styles.label}>Room Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Room A-412"
              value={roomNumber}
              onChangeText={setRoomNumber}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleManualAdd}>
                <Text style={styles.saveBtnText}>Save Course</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  scanBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
  },
  scanBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  clearBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  clearBtnText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  dayScroll: { maxHeight: 50, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayTab: { paddingHorizontal: 16, paddingVertical: 14 },
  activeDayTab: { borderBottomWidth: 3, borderBottomColor: colors.accent },
  dayTabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  activeDayTabText: { color: colors.primary, fontWeight: '700' },
  content: { padding: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  dayTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  courseCount: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.md },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: spacing.lg },
  scanModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: spacing.md, maxHeight: '92%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  reuploadBtn: { backgroundColor: colors.inputBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  reuploadBtnText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  previewImageContainer: {
    height: 140,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: { width: '100%', height: '100%' },
  pdfBadge: {
    padding: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pdfBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  scanSubtitle: { fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 8 },
  editableRow: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  miniInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeRowBtn: { paddingHorizontal: 8, justifyContent: 'center' },
  addRowBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 8,
    marginTop: 4,
  },
  addRowBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  periodChip: {
    backgroundColor: colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  label: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  input: { backgroundColor: colors.inputBg, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: spacing.sm },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, marginRight: spacing.sm },
  cancelBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
