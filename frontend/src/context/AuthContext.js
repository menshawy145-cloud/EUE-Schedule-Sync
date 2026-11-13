import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('@eue_auth_token');
      if (storedToken) {
        setToken(storedToken);
        const me = await api.auth.getMe();
        setUser(me);
      }
    } catch (err) {
      await AsyncStorage.removeItem('@eue_auth_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.auth.login({ email, password });
    await AsyncStorage.setItem('@eue_auth_token', res.access_token);
    setToken(res.access_token);
    const me = await api.auth.getMe();
    setUser(me);
    return me;
  };

  const signup = async (email, studentId, fullName, password, verificationCode) => {
    const res = await api.auth.signup({
      email,
      student_id: studentId,
      full_name: fullName,
      password,
      verification_code: verificationCode,
    });
    await AsyncStorage.setItem('@eue_auth_token', res.access_token);
    setToken(res.access_token);
    const me = await api.auth.getMe();
    setUser(me);
    return me;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('@eue_auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
