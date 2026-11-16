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
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { colors, spacing } from '../styles/theme';

const UNIVERSITIES = [
  { id: 'uol', name: 'UoL', domain: 'uol.eue.edu.eg' },
  { id: 'uclan', name: 'UCLan', domain: 'uclan.eue.edu.eg' },
  { id: 'uel', name: 'UEL', domain: 'uel.eue.edu.eg' },
];

export const LoginScreen = ({ navigation }) => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forgot Password Modal States
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Enter Email, 2 = Verify & New Password
  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [forgotSelectedUni, setForgotSelectedUni] = useState(UNIVERSITIES[0]);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [showForgotFallback, setShowForgotFallback] = useState(false);
  const [forgotMailto, setForgotMailto] = useState('');
  const [forgotTargetEmail, setForgotTargetEmail] = useState('eueschedulesync@gmail.com');
  const [forgotSubject, setForgotSubject] = useState('');
  const [forgotBody, setForgotBody] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [copiedField, setCopiedField] = useState('');

  const buildForgotValidatedEmail = () => {
    const raw = forgotEmailInput.trim().toLowerCase();
    return raw.includes('@') ? raw : `${raw}@${forgotSelectedUni.domain}`;
  };

  const copyText = (text, fieldName) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(''), 2000);
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your university email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async () => {
    setForgotError('');
    setForgotSuccess('');
    const fullEmail = buildForgotValidatedEmail();

    const validDomains = ['uol.eue.edu.eg', 'uclan.eue.edu.eg', 'uel.eue.edu.eg'];
    const emailDomain = fullEmail.split('@')[1];
    if (!validDomains.includes(emailDomain)) {
      setForgotError('Email must belong to @uol.eue.edu.eg, @uclan.eue.edu.eg, or @uel.eue.edu.eg');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await api.auth.forgotPassword({ email: fullEmail });
      setForgotCode(res.code || '');
      setForgotMailto(res.mailto || '');
      setForgotTargetEmail(res.target_email || 'eueschedulesync@gmail.com');
      setForgotSubject(res.subject || `EUE Password Reset ${res.code}`);
      setForgotBody(res.body || `Reset my EUE password: ${res.code}`);
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || 'Could not initiate password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handlePerformReset = async (isReverseFallback = false) => {
    setForgotError('');
    setForgotSuccess('');

    const code = forgotCode.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      setForgotError('Please enter a valid 6-digit verification code.');
      return;
    }

    if (forgotNewPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    const fullEmail = buildForgotValidatedEmail();
    try {
      setForgotLoading(true);
      const res = await api.auth.resetPassword({
        email: fullEmail,
        verification_code: code,
        new_password: forgotNewPassword,
        is_reverse_fallback: isReverseFallback,
      });
      setForgotSuccess(res.message || 'Password reset successfully!');
      setEmail(fullEmail);
      setTimeout(() => {
        setForgotModalVisible(false);
        setForgotStep(1);
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotCode('');
        setShowForgotFallback(false);
        Alert.alert('Password Reset', 'Your password has been reset successfully. Please sign in with your new password.');
      }, 1200);
    } catch (err) {
      setForgotError(err.message || 'Password reset failed. Please check your verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>EUE</Text>
          </View>
          <Text style={styles.title}>EUE</Text>
          <Text style={styles.subtitle}>European Universities in Egypt</Text>
        </View>

        <View style={styles.formCard}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>University Email</Text>
          <TextInput
            style={styles.input}
            placeholder="student@uol.eue.edu.eg"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showLoginPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.passwordToggleBtn}
              onPress={() => setShowLoginPassword((prev) => !prev)}
              accessibilityLabel={showLoginPassword ? 'Hide password' : 'Show password'}
            >
              <Text style={styles.passwordToggleText}>{showLoginPassword ? '🙈 Hide' : '👁 Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>

          {/* Forgot Password link placed right below the Sign In button */}
          <TouchableOpacity
            style={styles.forgotPasswordBtn}
            onPress={() => {
              setForgotModalVisible(true);
              setForgotStep(1);
              setForgotError('');
              setForgotSuccess('');
              setForgotEmailInput(email.trim().split('@')[0] || '');
              setShowForgotFallback(false);
            }}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.switchAuth}>
            <Text style={styles.switchText}>
              New to EUE? <Text style={styles.switchHighlight}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>🔑 Reset Password</Text>
                <Text style={styles.modalSubtitle}>
                  {forgotStep === 1 ? 'Step 1: Enter University Email' : 'Step 2: Enter Verification Code & New Password'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setForgotModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {forgotError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>⚠️ {forgotError}</Text>
              </View>
            ) : null}

            {forgotSuccess ? (
              <View style={styles.modalSuccessBox}>
                <Text style={styles.modalSuccessText}>✅ {forgotSuccess}</Text>
              </View>
            ) : null}

            {forgotStep === 1 ? (
              <View>
                <Text style={styles.label}>Select University</Text>
                <View style={styles.uniRow}>
                  {UNIVERSITIES.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.uniPill, forgotSelectedUni.id === u.id && styles.uniPillActive]}
                      onPress={() => setForgotSelectedUni(u)}
                    >
                      <Text style={[styles.uniPillText, forgotSelectedUni.id === u.id && styles.uniPillTextActive]}>
                        {u.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>University Email / Username</Text>
                <View style={styles.emailInputWrapper}>
                  <TextInput
                    style={styles.emailPrefixInput}
                    placeholder="firstname.lastname"
                    placeholderTextColor={colors.textSecondary}
                    value={forgotEmailInput}
                    onChangeText={setForgotEmailInput}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  {!forgotEmailInput.includes('@') && (
                    <Text style={styles.domainSuffix}>@{forgotSelectedUni.domain}</Text>
                  )}
                </View>

                <Text style={styles.modalHint}>
                  We will send a 6-digit password reset code directly to your university Outlook inbox.
                </Text>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={handleRequestResetCode}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>✉️ Send Reset Code →</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 440 }}>
                <View style={styles.stepInfoBox}>
                  <Text style={styles.stepInfoText}>
                    ✉️ We sent a 6-digit reset code to <Text style={{ fontWeight: '700' }}>{buildForgotValidatedEmail()}</Text>. Check your Outlook inbox (and junk/spam folder) and enter it below:
                  </Text>
                </View>

                <Text style={styles.label}>6-Digit Verification Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="123456"
                  placeholderTextColor={colors.textSecondary}
                  value={forgotCode}
                  onChangeText={setForgotCode}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                />

                <Text style={styles.label}>New Password (minimum 6 characters)</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textSecondary}
                    value={forgotNewPassword}
                    onChangeText={setForgotNewPassword}
                    secureTextEntry={!showResetPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.passwordToggleBtn}
                    onPress={() => setShowResetPassword((prev) => !prev)}
                    accessibilityLabel={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    <Text style={styles.passwordToggleText}>{showResetPassword ? '🙈 Hide' : '👁 Show'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textSecondary}
                    value={forgotConfirmPassword}
                    onChangeText={setForgotConfirmPassword}
                    secureTextEntry={!showResetConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.passwordToggleBtn}
                    onPress={() => setShowResetConfirmPassword((prev) => !prev)}
                    accessibilityLabel={showResetConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    <Text style={styles.passwordToggleText}>{showResetConfirmPassword ? '🙈 Hide' : '👁 Show'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={() => handlePerformReset(false)}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>🔑 Reset Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleRequestResetCode}
                  disabled={forgotLoading}
                >
                  <Text style={styles.resendBtnText}>🔄 Resend Code to University Email</Text>
                </TouchableOpacity>

                {/* Secondary Fallback: Verify by sending from Outlook */}
                <View style={styles.fallbackToggleContainer}>
                  <TouchableOpacity
                    style={styles.fallbackToggleBtn}
                    onPress={() => setShowForgotFallback((prev) => !prev)}
                  >
                    <Text style={styles.fallbackToggleBtnText}>
                      {showForgotFallback ? '▲ Hide Outlook Fallback' : "✉️ Didn't receive the email? Verify by sending from Outlook instead ▾"}
                    </Text>
                  </TouchableOpacity>

                  {showForgotFallback && (
                    <View style={styles.fallbackBox}>
                      <Text style={styles.fallbackTitle}>
                        If university spam filters delay incoming emails, you can verify instantly by sending an email from your university Outlook:
                      </Text>

                      {forgotMailto ? (
                        <TouchableOpacity
                          style={styles.openOutlookBtn}
                          onPress={() => {
                            Linking.openURL(forgotMailto).catch(() => {
                              setForgotError('Could not open mail app. Please copy the details below and send manually.');
                            });
                          }}
                        >
                          <Text style={styles.openOutlookBtnText}>✉️ Open EUE Outlook & Send Email</Text>
                        </TouchableOpacity>
                      ) : null}

                      <View style={styles.fallbackRow}>
                        <Text style={styles.fallbackLabel}>To:</Text>
                        <Text style={styles.fallbackVal} selectable>{forgotTargetEmail}</Text>
                        <TouchableOpacity onPress={() => copyText(forgotTargetEmail, 'to')} style={styles.copyBtn}>
                          <Text style={styles.copyBtnText}>{copiedField === 'to' ? '✓ Copied' : 'Copy'}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.fallbackRow}>
                        <Text style={styles.fallbackLabel}>Subject:</Text>
                        <Text style={styles.fallbackVal} selectable>{forgotSubject}</Text>
                        <TouchableOpacity onPress={() => copyText(forgotSubject, 'sub')} style={styles.copyBtn}>
                          <Text style={styles.copyBtnText}>{copiedField === 'sub' ? '✓ Copied' : 'Copy'}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.fallbackRow}>
                        <Text style={styles.fallbackLabel}>Body:</Text>
                        <Text style={styles.fallbackVal} selectable>{forgotBody}</Text>
                        <TouchableOpacity onPress={() => copyText(forgotBody, 'body')} style={styles.copyBtn}>
                          <Text style={styles.copyBtnText}>{copiedField === 'body' ? '✓ Copied' : 'Copy'}</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.modalPrimaryBtn, { marginTop: spacing.md }]}
                        onPress={() => handlePerformReset(true)}
                        disabled={forgotLoading}
                      >
                        {forgotLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.modalPrimaryBtnText}>📨 I Sent the Email — Reset Password</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.backStepBtn}
                  onPress={() => {
                    setForgotStep(1);
                    setShowForgotFallback(false);
                  }}
                  disabled={forgotLoading}
                >
                  <Text style={styles.backStepText}>← Change Email / Request New Code</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  brandContainer: { alignItems: 'center', marginBottom: spacing.xl },
  logoBadge: {
    backgroundColor: colors.accent,
    width: 68,
    height: 68,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
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
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    minHeight: 46,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    minHeight: 46,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
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
  loginBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 46,
  },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  forgotPasswordBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  switchAuth: { marginTop: spacing.md, alignItems: 'center' },
  switchText: { fontSize: 13, color: colors.textSecondary },
  switchHighlight: { color: colors.accent, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.card, width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 16, padding: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: { padding: 8, minHeight: 42, justifyContent: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  modalErrorBox: { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.md },
  modalErrorText: { color: '#B91C1C', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modalSuccessBox: { backgroundColor: '#DCFCE7', borderColor: '#22C55E', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.md },
  modalSuccessText: { color: '#15803D', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  uniRow: { flexDirection: 'row', marginBottom: spacing.md, flexWrap: 'wrap', gap: 6 },
  uniPill: { flex: 1, minWidth: 80, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, minHeight: 42 },
  uniPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  uniPillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  uniPillTextActive: { color: '#fff' },
  emailInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 46 },
  emailPrefixInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: colors.textPrimary },
  domainSuffix: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  modalHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 16 },
  modalPrimaryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm, minHeight: 46 },
  modalPrimaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stepInfoBox: { backgroundColor: '#ECFDF5', borderColor: '#10B981', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.md },
  stepInfoText: { color: '#047857', fontSize: 12, fontWeight: '500', lineHeight: 18, textAlign: 'center' },
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
    marginVertical: 6,
  },
  resendBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 2 },
  resendBtnText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  fallbackToggleContainer: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  fallbackToggleBtn: { paddingVertical: 8, alignItems: 'center' },
  fallbackToggleBtnText: { fontSize: 12, fontWeight: '700', color: '#0078D4', textAlign: 'center' },
  fallbackBox: { marginTop: spacing.sm, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  fallbackTitle: { fontSize: 11, color: colors.textSecondary, marginBottom: 8, lineHeight: 16 },
  openOutlookBtn: { backgroundColor: '#0078D4', borderRadius: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10, minHeight: 42 },
  openOutlookBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  fallbackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 },
  fallbackLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, width: 55 },
  fallbackVal: { flex: 1, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: colors.textPrimary },
  copyBtn: { backgroundColor: '#EDF2F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, minHeight: 28, justifyContent: 'center' },
  copyBtnText: { fontSize: 10, fontWeight: '700', color: colors.accent },
  backStepBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 6 },
  backStepText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
