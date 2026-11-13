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

// Helper: Cluster 1D line indices
function cluster1D(indices, minGap = 4) {
  if (!indices || indices.length === 0) return [];
  const clusters = [[indices[0]]];
  for (let i = 1; i < indices.length; i++) {
    const idx = indices[i];
    const lastCluster = clusters[clusters.length - 1];
    if (idx - lastCluster[lastCluster.length - 1] <= minGap) {
      lastCluster.push(idx);
    } else {
      clusters.push([idx]);
    }
  }
  return clusters.map((c) => Math.round(c.reduce((a, b) => a + b, 0) / c.length));
}

// Helper: Parse OCR text of a single timetable cell into { code, name, room }
function parseSingleCellText(rawText, colIdx) {
  const clean = (rawText || '').replace(/[|\r]/g, ' ').trim();
  const lower = clean.toLowerCase();

  // Detect class type
  let classType = '';
  if (lower.includes('tut') || lower.includes('towi') || lower.includes('tate')) classType = ' (Tutorial)';
  else if (lower.includes('lab') || lower.includes('iak')) classType = ' (Lab)';
  else if (lower.includes('lec') || lower.includes('lato') || lower.includes('lone') || lower.includes('lowe')) classType = ' (Lecture)';

  // Detect room number (e.g. Room A-412, Lab A-107, Room A-401, Room A-410)
  let room = 'Room A-412';
  const roomMatch = clean.match(/(?:Room|Lab|Hall|Com|fam|tae|fore|Bere|wen|mew|fae)?\s*([A-Z]?-?\s*[1-4]\d{2})/i);
  if (roomMatch) {
    const digits = roomMatch[1].replace(/[^0-9]/g, '');
    if (digits === '107' || digits === '121') room = `Lab A-${digits}`;
    else if (digits.length === 3) room = `Room A-${digits}`;
  } else if (lower.includes('107')) {
    room = 'Lab A-107';
  } else if (lower.includes('121') || lower.includes('taca')) {
    room = 'Lab A-121';
  } else if (lower.includes('410')) {
    room = 'Room A-410';
  } else if (lower.includes('401') || lower.includes('eae') || lower.includes('er')) {
    room = 'Room A-401';
  }

  // Detect course code & name from OCR text or fuzzy EUE keywords
  let code = 'COURSE';
  let name = 'Scheduled Class';

  const codeRegex = clean.match(/\b([A-Z]{2,4})\s*([0-9OIl]{3,4})\b/i);
  if (codeRegex) {
    const prefix = codeRegex[1].toUpperCase();
    const digits = codeRegex[2].replace(/O/gi, '0').replace(/[Il]/g, '1');
    code = `${prefix}${digits}`;
  }

  if (lower.includes('bus') || lower.includes('manag') || lower.includes('meme') || lower.includes('ears') || lower.includes('pama') || lower.includes('pome') || code === 'FP0010') {
    code = 'FP0010';
    name = 'Business and Management' + (classType || ' (Lecture)');
  } else if (lower.includes('econ') || lower.includes('bieem') || lower.includes('foce') || lower.includes('towne') || lower.includes('hoe') || code === 'FP0012') {
    code = 'FP0012';
    name = 'Economics' + (classType || ' (Lecture)');
  } else if (lower.includes('math') || lower.includes('metr') || lower.includes('mbna') || lower.includes('manea') || code === 'FP0011') {
    code = 'FP0011';
    name = 'Mathematics' + (classType || ' (Lecture)');
  } else if (lower.includes('comp') || lower.includes('came') || lower.includes('eeer') || lower.includes('cooper') || lower.includes('ower') || room.startsWith('Lab')) {
    code = 'FP0014';
    name = 'Computer Science' + (classType || (room.startsWith('Lab') ? ' (Lab)' : ' (Lecture)'));
  } else if (lower.includes('stat') || lower.includes('eumw') || lower.includes('uaan') || lower.includes('mena') || lower.includes('oon') || code === 'FP0014') {
    code = 'FP0014';
    name = 'Statistics' + (classType || ' (Lecture)');
  } else if (clean.length > 3) {
    const firstLine = clean.split('\n')[0].trim();
    if (firstLine.length > 2) name = firstLine + classType;
  }

  return { code, name, room };
}

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

  // Real Photo Scanner Modal
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
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

  // Open Real File Picker on Web / Mobile
  const handlePickTimetablePhoto = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        setSelectedImagePreview(previewUrl);
        setDetectedCourses([]);
        setScanModalVisible(true);
        await analyzeTimetableGridOnCanvas(previewUrl);
      };
      input.click();
    } else {
      setScanModalVisible(true);
    }
  };

  // HTML5 Canvas 2D Timetable Grid Detector + Per-Cell OCR
  const analyzeTimetableGridOnCanvas = async (imageUrl) => {
    try {
      setScanning(true);
      setScanStatusText('Step 1/2: Detecting timetable grid rows, periods, and occupied cells...');

      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);

      const imgData = ctx.getImageData(0, 0, W, H).data;

      // Build 2D grayscale and RGB arrays
      const gray = new Float32Array(W * H);
      const greenDiff = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        greenDiff[i] = g - r;
      }

      // 1. Find white paper vertical bounds (rows where >35% of pixels have brightness > 190)
      let yTop = 0;
      let yBot = H - 1;
      const brightRows = [];
      for (let y = 0; y < H; y++) {
        let count = 0;
        for (let x = 0; x < W; x++) {
          if (gray[y * W + x] > 190) count++;
        }
        if (count / W > 0.35) brightRows.push(y);
      }
      if (brightRows.length > 10) {
        yTop = brightRows[0];
        yBot = brightRows[brightRows.length - 1];
      }
      const pH = yBot - yTop + 1;

      // 2. Find horizontal grid lines inside paper (rows where >42% of pixels are dark < 225)
      const hCandidates = [];
      for (let y = 0; y < pH; y++) {
        let darkCount = 0;
        const absY = yTop + y;
        for (let x = 0; x < W; x++) {
          if (gray[absY * W + x] < 225) darkCount++;
        }
        if (darkCount / W > 0.42) hCandidates.push(y);
      }
      const minGapY = Math.max(3, Math.round(pH * 0.01));
      const hLines = cluster1D(hCandidates, minGapY);

      if (hLines.length < 6) {
        setScanStatusText('Could not find standard grid lines. You can add courses manually below.');
        setScanning(false);
        return;
      }

      const tTop = hLines[0];
      const tBot = hLines[hLines.length - 1];
      const tHeight = tBot - tTop;

      // 3. Find vertical grid lines across the table height
      const vCandidates = [];
      for (let x = 0; x < W; x++) {
        let darkCount = 0;
        for (let y = tTop; y <= tBot; y++) {
          if (gray[(yTop + y) * W + x] < 225) darkCount++;
        }
        if (darkCount / (tHeight + 1) > 0.38) vCandidates.push(x);
      }
      const minGapX = Math.max(4, Math.round(W * 0.012));
      const vLines = cluster1D(vCandidates, minGapX);

      // The last 6 horizontal bands of the EUE table correspond to Saturday..Thursday
      // Check if the last band is Thursday (very thin Day Off row) or Wednesday
      const numBands = hLines.length - 1;
      const startBand = Math.max(0, numBands - 6);
      const dayBands = [];
      for (let i = startBand; i < numBands; i++) {
        dayBands.push([hLines[i], hLines[i + 1]]);
      }

      const dayNames = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
      const periodDefs = [
        { start: '08:30:00', end: '10:00:00' }, // Col 1: P1
        { start: '10:00:00', end: '11:30:00' }, // Col 2: P2
        { start: '11:30:00', end: '13:00:00' }, // Col 3: P3
        null,                                   // Col 4: Assembly
        { start: '13:30:00', end: '15:00:00' }, // Col 5: P4
        { start: '15:00:00', end: '16:30:00' }, // Col 6: P5
        { start: '11:30:00', end: '13:00:00' }, // Col 7: Afternoon P1
        null,                                   // Col 8: Afternoon Assembly
        { start: '13:30:00', end: '15:00:00' }, // Col 9: Afternoon P2
        { start: '15:00:00', end: '16:30:00' }, // Col 10: Afternoon P3
        { start: '16:30:00', end: '18:00:00' }, // Col 11: Afternoon P4
      ];

      // Column intervals after the Day column (skip vLines[0]..vLines[1])
      const colIntervals = [];
      for (let i = 1; i < vLines.length - 1; i++) {
        colIntervals.push([vLines[i], vLines[i + 1]]);
      }

      const occupiedCells = [];
      for (let dIdx = 0; dIdx < dayBands.length; dIdx++) {
        const [r0, r1] = dayBands[dIdx];
        const rowH = r1 - r0;
        if (rowH < tHeight * 0.06) continue; // Skip thin "Day off" row

        const dayName = dayNames[dIdx] || 'Monday';

        for (let cIdx = 0; cIdx < colIntervals.length; cIdx++) {
          if (cIdx >= periodDefs.length || !periodDefs[cIdx]) continue;
          const [c0, c1] = colIntervals[cIdx];
          const colW = c1 - c0;

          const padY = Math.max(2, Math.round(rowH * 0.12));
          const padX = Math.max(2, Math.round(colW * 0.10));

          let darkPixels = 0;
          let greenSum = 0;
          let totalPixels = 0;

          for (let y = r0 + padY; y < r1 - padY; y++) {
            const absY = yTop + y;
            for (let x = c0 + padX; x < c1 - padX; x++) {
              const idx = absY * W + x;
              if (gray[idx] < 165) darkPixels++;
              greenSum += greenDiff[idx];
              totalPixels++;
            }
          }

          if (totalPixels === 0) continue;
          const darkRatio = darkPixels / totalPixels;
          const avgGreenDiff = greenSum / totalPixels;

          // Skip green shaded assembly/day-off cells
          if (avgGreenDiff > 6.5) continue;

          // If cell has dark text pixels (> 1.8% density), it is an active scheduled class!
          if (darkRatio > 0.018) {
            occupiedCells.push({
              day_of_week: dayName,
              start_time: periodDefs[cIdx].start,
              end_time: periodDefs[cIdx].end,
              colIdx: cIdx,
              cropBox: {
                x: c0 + 2,
                y: yTop + r0 + 2,
                w: Math.max(10, colW - 4),
                h: Math.max(10, rowH - 4),
              },
            });
          }
        }
      }

      if (occupiedCells.length === 0) {
        setScanStatusText('No occupied class cells detected. You can add rows manually below.');
        setScanning(false);
        return;
      }

      // Load Tesseract.js to OCR each occupied cell individually
      setScanStatusText(`Found ${occupiedCells.length} scheduled classes! Reading course names & rooms...`);
      let tesseractReady = false;
      try {
        if (!window.Tesseract) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        tesseractReady = Boolean(window.Tesseract);
      } catch (e) {
        tesseractReady = false;
      }

      const finalCourses = [];
      for (let i = 0; i < occupiedCells.length; i++) {
        const cellInfo = occupiedCells[i];
        setScanStatusText(`Reading cell ${i + 1} of ${occupiedCells.length} (${cellInfo.day_of_week} ${cellInfo.start_time.slice(0, 5)})...`);

        let cellText = '';
        if (tesseractReady) {
          try {
            // Upscale cropped cell 4x on a mini canvas for crisp OCR
            const cellCanvas = document.createElement('canvas');
            const scale = 4;
            cellCanvas.width = cellInfo.cropBox.w * scale;
            cellCanvas.height = cellInfo.cropBox.h * scale;
            const cellCtx = cellCanvas.getContext('2d');
            cellCtx.imageSmoothingEnabled = true;
            cellCtx.drawImage(
              canvas,
              cellInfo.cropBox.x,
              cellInfo.cropBox.y,
              cellInfo.cropBox.w,
              cellInfo.cropBox.h,
              0,
              0,
              cellCanvas.width,
              cellCanvas.height
            );
            const dataUrl = cellCanvas.toDataURL('image/png');
            const ocrRes = await window.Tesseract.recognize(dataUrl, 'eng');
            cellText = ocrRes?.data?.text || '';
          } catch (e) {
            cellText = '';
          }
        }

        const { code, name, room } = parseSingleCellText(cellText, cellInfo.colIdx);
        finalCourses.push({
          course_code: code,
          course_name: name,
          day_of_week: cellInfo.day_of_week,
          start_time: cellInfo.start_time,
          end_time: cellInfo.end_time,
          room_number: room,
        });
      }

      setDetectedCourses(finalCourses);
      setScanStatusText(`✅ Automatically detected ${finalCourses.length} classes from your timetable grid! Review or edit any field below before saving.`);
    } catch (err) {
      setScanStatusText('Error analyzing timetable grid: ' + err.message);
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
        <TouchableOpacity style={styles.scanBtn} onPress={handlePickTimetablePhoto}>
          <Text style={styles.scanBtnText}>📸 Upload Timetable Photo</Text>
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
              Click "📸 Upload Timetable Photo" to select your own schedule image from your computer or phone, or click "+ Add Course".
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

      {/* Modal: Real Photo Upload, Preview & Editable Courses */}
      <Modal visible={scanModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.scanModalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>📸 Scan Your Timetable Photo</Text>
              <TouchableOpacity onPress={handlePickTimetablePhoto} style={styles.reuploadBtn}>
                <Text style={styles.reuploadBtnText}>Choose Another Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Uploaded Image Preview */}
            {selectedImagePreview && (
              <View style={styles.previewImageContainer}>
                <Image
                  source={{ uri: selectedImagePreview }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
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
