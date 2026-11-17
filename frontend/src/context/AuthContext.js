import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [initialTab, setInitialTab] = useState('Dashboard');

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
        if (me?.student_id) {
          const onboarded = await AsyncStorage.getItem(`@eue_onboarded_${me.student_id}`);
          const pending = await AsyncStorage.getItem(`@eue_pending_onboarding_${me.student_id}`);
          setIsNewUser(pending === 'true' && onboarded !== 'true');
        } else {
          setIsNewUser(false);
        }
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
    if (me?.student_id) {
      await AsyncStorage.setItem(`@eue_onboarded_${me.student_id}`, 'true');
      await AsyncStorage.removeItem(`@eue_pending_onboarding_${me.student_id}`);
    }
    setIsNewUser(false);
    setInitialTab('Dashboard');
    return me;
  };

  const signup = async (email, studentId, fullName, password, verificationCode, isReverseFallback = false) => {
    const res = await api.auth.signup({
      email,
      student_id: studentId,
      full_name: fullName,
      password,
      verification_code: verificationCode,
      is_reverse_fallback: isReverseFallback,
    });
    await AsyncStorage.setItem('@eue_auth_token', res.access_token);
    setToken(res.access_token);
    const me = await api.auth.getMe();
    setUser(me);
    if (me?.student_id) {
      await AsyncStorage.setItem(`@eue_pending_onboarding_${me.student_id}`, 'true');
    }
    setIsNewUser(true);
    return me;
  };

  const completeOnboarding = async (target = 'Dashboard') => {
    if (user?.student_id) {
      await AsyncStorage.setItem(`@eue_onboarded_${user.student_id}`, 'true');
      await AsyncStorage.removeItem(`@eue_pending_onboarding_${user.student_id}`);
    }
    setInitialTab(target);
    setIsNewUser(false);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('@eue_auth_token');
    setToken(null);
    setUser(null);
    setIsNewUser(false);
    setInitialTab('Dashboard');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isNewUser,
        initialTab,
        login,
        signup,
        logout,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
