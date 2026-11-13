import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'https://eueapp.pythonanywhere.com/api/v1';

async function request(endpoint, options = {}) {
  const token = await AsyncStorage.getItem('@eue_auth_token');
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  if (response.status === 204) return null;

  const data = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? data.detail.map((d) => d.msg).join(', ')
      : data?.detail || 'An error occurred';
    throw new Error(detail);
  }
  return data;
}

export const api = {
  auth: {
    sendVerificationCode: (payload) => request('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    signup: (userData) => request('/auth/signup', { method: 'POST', body: JSON.stringify(userData) }),
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    getMe: () => request('/auth/me'),
  },
  users: {
    searchByStudentId: (studentId) => request(`/users/search?student_id=${encodeURIComponent(studentId)}`),
  },
  schedules: {
    getAll: (day) => request(day ? `/schedules/?day=${encodeURIComponent(day)}` : '/schedules/'),
    create: (courseData) => request('/schedules/', { method: 'POST', body: JSON.stringify(courseData) }),
    createBatch: (courses) => request('/schedules/batch', { method: 'POST', body: JSON.stringify({ courses }) }),
    toggleCancel: (id) => request(`/schedules/${id}/toggle-cancel`, { method: 'PUT' }),
    clearAll: () => request('/schedules/clear-all', { method: 'DELETE' }),
    uploadTimetableImage: (fileObj) => {
      const formData = new FormData();
      if (fileObj) formData.append('file', fileObj);
      return request('/schedules/upload-image', { method: 'POST', body: formData });
    },
    getFriendOverlap: (friendId) => request(`/schedules/friends/${friendId}/overlap`),
    delete: (id) => request(`/schedules/${id}`, { method: 'DELETE' }),
  },
  friends: {
    sendRequest: (targetStudentId) => request('/friends/requests', { method: 'POST', body: JSON.stringify({ target_student_id: targetStudentId }) }),
    getPendingRequests: () => request('/friends/requests/pending'),
    getSentRequests: () => request('/friends/requests/sent'),
    respondRequest: (requestId, action) => request(`/friends/requests/${requestId}/respond`, { method: 'POST', body: JSON.stringify({ action }) }),
    getAll: () => request('/friends/'),
    getFriendSchedule: (friendId) => request(`/friends/${friendId}/schedule`),
    removeFriend: (friendId) => request(`/friends/${friendId}`, { method: 'DELETE' }),
  },
  dashboard: {
    getDashboard: () => request('/dashboard/'),
  },
};
