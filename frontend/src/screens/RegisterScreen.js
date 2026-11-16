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
  Linking,
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
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  // Email Verification States
  const [codeSent, setCodeSent] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [targetEmail, setTargetEmail] = useState('eueschedulesync@gmail.com');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [mailtoUrl, setMailtoUrl] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const buildValidatedEmail = () => {
    const rawEmail = emailInput.trim().toLowerCase();
    return rawEmail.includes('@') ? rawEmail : `${rawEmail}@${selectedUni.domain}`;
  };

  const copyText = (text, fieldName) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(''), 2000);
    }
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
      setVerificationCode(res.code || '');
      setEnteredCode('');
      setTargetEmail(res.target_email || 'eueschedulesync@gmail.com');
      setEmailSubject(res.subject || `EUE Verify ${res.code}`);
      setEmailBody(res.body || `Verify my EUE account: ${res.code}`);
      setMailtoUrl(res.mailto || '');
      setInfoMessage(`✉️ Verification code sent directly to ${fullEmail}! Please check your Outlook inbox (and junk/spam folder) and enter the 6-digit code below.`);
    } catch (err) {
      setErrorMessage(err.message || 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Direct flow: student enters the 6-digit code received in their email
  const handleDirectVerifyAndRegister = async () => {
    setErrorMessage('');
    if (!validateFormFields()) return;

    const code = enteredCode.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      setErrorMessage('Please enter the 6-digit verification code sent to your university email.');
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
        code,
        false // isReverseFallback = false
      );
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed. Please check your code or use Outlook verification below.');
    } finally {
      setLoading(false);
    }
  };

  // Fallback flow: student sends verification email from Outlook to eueschedulesync@gmail.com
  const handleFallbackVerifyAndRegister = async () => {
    setErrorMessage('');
    if (!validateFormFields()) return;

    if (!verificationCode || !verificationCode.trim()) {
      setErrorMessage('Verification code is missing. Please click "Send 6-Digit Verification Code" first.');
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
        verificationCode.trim(),
        true // isReverseFallback = true
      );
    } catch (err) {
      setErrorMessage(err.message || 'Reverse verification failed. Make sure you dispatched the email from your Outlook.');
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
            placeholder="e.g. Mohamed Elmenshawy"
            placeholderTextColor={colors.textSecondary}
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Student ID (Exact 8 Digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 26102546"
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
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showRegisterPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.passwordToggleBtn}
              onPress={() => setShowRegisterPassword((prev) => !prev)}
              accessibilityLabel={showRegisterPassword ? 'Hide password' : 'Show password'}
            >
              <Text style={styles.passwordToggleText}>{showRegisterPassword ? '🙈 Hide' : '👁 Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showRegisterConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.passwordToggleBtn}
              onPress={() => setShowRegisterConfirmPassword((prev) => !prev)}
              accessibilityLabel={showRegisterConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              <Text style={styles.passwordToggleText}>{showRegisterConfirmPassword ? '🙈 Hide' : '👁 Show'}</Text>
            </TouchableOpacity>
          </View>

          {!codeSent ? (
            <TouchableOpacity style={styles.sendCodeBtn} onPress={handleSendVerificationCode} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerBtnText}>✉️ Send 6-Digit Verification Code</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.verificationSection}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>ENTER 6-DIGIT CODE SENT TO YOUR EMAIL</Text>
              </View>
              <Text style={styles.stepDesc}>
                Check your university Outlook inbox (and junk/spam folder) for the verification code sent to {buildValidatedEmail()}:
              </Text>

              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                placeholderTextColor={colors.textSecondary}
                value={enteredCode}
                onChangeText={setEnteredCode}
                keyboardType="numeric"
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity style={styles.registerBtn} onPress={handleDirectVerifyAndRegister} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerBtnText}>🚀 Verify & Create My Account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendVerificationCode} style={styles.resendBtn} disabled={loading}>
                <Text style={styles.resendText}>🔄 Resend Code to University Email</Text>
              </TouchableOpacity>

              {/* Secondary Fallback: Verify by sending from Outlook */}
              <View style={styles.fallbackToggleContainer}>
                <TouchableOpacity
                  style={styles.fallbackToggleBtn}
                  onPress={() => setShowFallback(!showFallback)}
                >
                  <Text style={styles.fallbackToggleBtnText}>
                    {showFallback ? '▲ Hide Outlook Fallback' : "✉️ Didn't receive the email? Verify by sending from Outlook instead ▾"}
                  </Text>
                </TouchableOpacity>

                {showFallback && (
                  <View style={styles.fallbackBox}>
                    <Text style={styles.fallbackTitle}>
                      If university spam filters delay incoming emails, you can verify instantly by sending an email from your university Outlook:
                    </Text>

                    <TouchableOpacity
                      style={styles.openOutlookBtn}
                      onPress={() => {
                        if (mailtoUrl) {
                          Linking.openURL(mailtoUrl).catch(() => {
                            setErrorMessage('Could not open mail app. Please copy the details below and send from Outlook.');
                          });
                        }
                      }}
                    >
                      <Text style={styles.openOutlookBtnText}>✉️ Open EUE Outlook & Send Email</Text>
                    </TouchableOpacity>

                    <View style={styles.fallbackRow}>
                      <Text style={styles.fallbackLabel}>To:</Text>
                      <Text style={styles.fallbackVal} selectable>{targetEmail}</Text>
                      <TouchableOpacity onPress={() => copyText(targetEmail, 'to')} style={styles.copyBtn}>
                        <Text style={styles.copyBtnText}>{copiedField === 'to' ? '✓ Copied' : 'Copy'}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fallbackRow}>
                      <Text style={styles.fallbackLabel}>Subject:</Text>
                      <Text style={styles.fallbackVal} selectable>{emailSubject}</Text>
                      <TouchableOpacity onPress={() => copyText(emailSubject, 'sub')} style={styles.copyBtn}>
                        <Text style={styles.copyBtnText}>{copiedField === 'sub' ? '✓ Copied' : 'Copy'}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fallbackRow}>
                      <Text style={styles.fallbackLabel}>Body:</Text>
                      <Text style={styles.fallbackVal} selectable>{emailBody}</Text>
                      <TouchableOpacity onPress={() => copyText(emailBody, 'body')} style={styles.copyBtn}>
                        <Text style={styles.copyBtnText}>{copiedField === 'body' ? '✓ Copied' : 'Copy'}</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[styles.registerBtn, { marginTop: spacing.md }]} onPress={handleFallbackVerifyAndRegister} disabled={loading}>
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.registerBtnText}>📨 I Sent the Email — Verify & Register</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
  infoText: { color: '#047857', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  uniPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  uniPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  activeUniPill: {
    backgroundColor: '#EBF8FF',
    borderColor: colors.accent,
  },
  uniPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A5568',
  },
  activeUniPillText: {
    color: colors.accent,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    minHeight: 44,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  passwordToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 42,
  },
  passwordToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  codeInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 10,
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  emailInputPart: {
    flex: 1,
    minWidth: 160,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  domainBadge: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderLeftWidth: 0,
    minHeight: 44,
    justifyContent: 'center',
  },
  domainBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
  },
  sendCodeBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 46,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  verificationSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  fallbackToggleContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  fallbackToggleBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 44,
    justifyContent: 'center',
  },
  fallbackToggleBtnText: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepBadge: {
    backgroundColor: '#1a2b49',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  stepBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepDesc: {
    fontSize: 13,
    color: '#4A5568',
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  openOutlookBtn: {
    backgroundColor: '#0078D4', // Outlook Blue
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
    minHeight: 46,
  },
  openOutlookBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  fallbackBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  fallbackLabel: {
    width: 60,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  fallbackVal: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  copyBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  registerBtn: {
    backgroundColor: '#10B981', // Emerald green
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  resendText: {
    color: colors.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  switchAuth: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  switchText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  switchHighlight: {
    color: colors.accent,
    fontWeight: '700',
  },
});
