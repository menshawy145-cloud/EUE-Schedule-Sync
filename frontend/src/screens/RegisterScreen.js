import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { colors, spacing } from '../styles/theme';

const UNIVERSITIES = [
  { id: 'uol', name: 'UoL', domain: 'uol.eue.edu.eg' },
  { id: 'uclan', name: 'UCLan', domain: 'uclan.eue.edu.eg' },
  { id: 'uel', name: 'UEL', domain: 'uel.eue.edu.eg' },
];

export const RegisterScreen = ({ navigation }) => {
  const { signup } = useContext(AuthContext);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedUni, setSelectedUni] = useState(UNIVERSITIES[0]);
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email Verification States
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const buildValidatedEmail = () => {
    const rawEmail = emailInput.trim().toLowerCase();
    return rawEmail.includes('@') ? rawEmail : `${rawEmail}@${selectedUni.domain}`;
  };

  const validateFormFields = () => {
    const trimmedName = fullName.trim();
    const trimmedId = studentId.trim();
    const rawEmail = emailInput.trim().toLowerCase();

    if (!trimmedName || !trimmedId || !rawEmail || !password) {
      setErrorMessage('Please fill in all fields.');
      return false;
    }

    if (!/^\d{8}$/.test(trimmedId)) {
      setErrorMessage('Student ID must be an exact 8-digit number (e.g. 20241234).');
      return false;
    }

    const fullEmail = buildValidatedEmail();
    const validDomains = ['uol.eue.edu.eg', 'uclan.eue.edu.eg', 'uel.eue.edu.eg'];
    const emailDomain = fullEmail.split('@')[1];
    if (!validDomains.includes(emailDomain)) {
      setErrorMessage('Email must end with @uol.eue.edu.eg, @uclan.eue.edu.eg, or @uel.eue.edu.eg');
      return false;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return false;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleSendVerificationCode = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (!validateFormFields()) return;

    const fullEmail = buildValidatedEmail();
    try {
      setLoading(true);
      const res = await api.auth.sendVerificationCode({
        email: fullEmail,
        student_id: studentId.trim(),
        full_name: fullName.trim(),
      });
      setCodeSent(true);
      if (res.dev_code) {
        setInfoMessage(`📧 Code sent to ${fullEmail}! (Your Code: ${res.dev_code})`);
      } else {
        setInfoMessage(`📧 Code sent to ${fullEmail}! Check your Outlook Inbox, "Other" tab, and Junk folder.`);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    setErrorMessage('');
    if (!validateFormFields()) return;

    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    const fullEmail = buildValidatedEmail();
    try {
      setLoading(true);
      await signup(
        fullEmail,
        studentId.trim(),
        fullName.trim(),
        password,
        verificationCode.trim()
      );
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>EUE</Text>
          <Text style={styles.subtitle}>European Universities in Egypt • Verified Student Signup</Text>
        </View>

        <View style={styles.formCard}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {infoMessage ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{infoMessage}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Select Your EUE University</Text>
          <View style={styles.uniPillsRow}>
            {UNIVERSITIES.map((uni) => (
              <TouchableOpacity
                key={uni.id}
                style={[styles.uniPill, selectedUni.id === uni.id && styles.activeUniPill]}
                onPress={() => {
                  setSelectedUni(uni);
                  setCodeSent(false);
                }}
              >
                <Text style={[styles.uniPillText, selectedUni.id === uni.id && styles.activeUniPillText]}>
                  {uni.name} (@{uni.domain.split('.')[0]})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sara Ahmad"
            placeholderTextColor={colors.textSecondary}
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Student ID (Exact 8 Digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 20242347"
            placeholderTextColor={colors.textSecondary}
            value={studentId}
            onChangeText={setStudentId}
            keyboardType="numeric"
            maxLength={8}
          />

          <Text style={styles.label}>University Email</Text>
          <View style={styles.emailInputRow}>
            <TextInput
              style={[styles.input, styles.emailInputPart]}
              placeholder="username"
              placeholderTextColor={colors.textSecondary}
              value={emailInput}
              onChangeText={(v) => {
                setEmailInput(v);
                setCodeSent(false);
              }}
              autoCapitalize="none"
            />
            {!emailInput.includes('@') && (
              <View style={styles.domainBadge}>
                <Text style={styles.domainBadgeText}>@{selectedUni.domain}</Text>
              </View>
            )}
          </View>

          <Text style={styles.label}>Password (minimum 6 characters)</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {!codeSent ? (
            <TouchableOpacity style={styles.sendCodeBtn} onPress={handleSendVerificationCode} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerBtnText}>📧 Send 6-Digit Verification Code</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.verificationSection}>
              <Text style={styles.label}>Enter 6-Digit Email Verification Code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="123456"
                placeholderTextColor={colors.textSecondary}
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="numeric"
                maxLength={6}
              />

              <TouchableOpacity style={styles.registerBtn} onPress={handleVerifyAndRegister} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerBtnText}>✅ Verify Code & Create Account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendVerificationCode} style={styles.resendBtn} disabled={loading}>
                <Text style={styles.resendText}>Resend Verification Code</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchAuth}>
            <Text style={styles.switchText}>
              Already registered? <Text style={styles.switchHighlight}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#A0AEC0', textAlign: 'center', marginTop: 4 },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.md,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  infoBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.md,
  },
  infoText: { color: '#065F46', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  uniPillsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  uniPill: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 3,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeUniPill: { backgroundColor: colors.primary, borderColor: colors.primary },
  uniPillText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  activeUniPillText: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emailInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  emailInputPart: { flex: 1, marginBottom: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  domainBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 10,
    height: 48,
    justifyContent: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  domainBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  sendCodeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  verificationSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  codeInput: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 2,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  registerBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  registerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resendBtn: { marginTop: spacing.sm, alignItems: 'center' },
  resendText: { fontSize: 12, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  switchAuth: { marginTop: spacing.md, alignItems: 'center' },
  switchText: { fontSize: 13, color: colors.textSecondary },
  switchHighlight: { color: colors.primary, fontWeight: '700' },
});
