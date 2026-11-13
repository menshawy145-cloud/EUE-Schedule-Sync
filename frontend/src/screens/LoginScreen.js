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

  const handlePerformReset = async () => {
    setForgotError('');
    setForgotSuccess('');

    if (!forgotCode.trim() || !/^\d{6}$/.test(forgotCode.trim())) {
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
        verification_code: forgotCode.trim(),
        new_password: forgotNewPassword,
      });
      setForgotSuccess(res.message || 'Password reset successfully!');
      setEmail(fullEmail);
      setTimeout(() => {
        setForgotModalVisible(false);
        setForgotStep(1);
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotCode('');
        Alert.alert('Password Reset', 'Your password has been reset successfully. Please sign in with your new password.');
      }, 1200);
    } catch (err) {
      setForgotError(err.message || 'Password reset failed. Make sure you sent the verification email from your university Outlook.');
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

          <View style={styles.passwordLabelRow}>
            <Text style={styles.label}>Password</Text>
            <TouchableOpacity
              onPress={() => {
                setForgotModalVisible(true);
                setForgotStep(1);
                setForgotError('');
                setForgotSuccess('');
                setForgotEmailInput(email.trim().split('@')[0] || '');
              }}
            >
              <Text style={styles.forgotLink}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
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
                  {forgotStep === 1 ? 'Step 1: Enter University Email' : 'Step 2: Outlook Verification & New Password'}
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
                  We will generate a secure reset code linked to your university Outlook inbox.
                </Text>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={handleRequestResetCode}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Send Reset Code →</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {/* Step 2: Outlook Verification */}
                <View style={styles.codeHighlightBox}>
                  <Text style={styles.codeLabel}>YOUR 6-DIGIT RESET CODE</Text>
                  <Text style={styles.codeText}>{forgotCode}</Text>
                  <TouchableOpacity
                    style={styles.copySmallBtn}
                    onPress={() => copyText(forgotCode, 'code')}
                  >
                    <Text style={styles.copySmallText}>
                      {copiedField === 'code' ? '✓ Copied' : 'Copy Code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {forgotMailto ? (
                  <TouchableOpacity
                    style={styles.outlookBtn}
                    onPress={() => Linking.openURL(forgotMailto)}
                  >
                    <Text style={styles.outlookBtnText}>📧 Open University Outlook App</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.reverseVerifyGuide}>
                  <Text style={styles.guideStep}>
                    1. Tap the button above to launch your university Outlook.
                  </Text>
                  <Text style={styles.guideStep}>
                    2. Hit <Text style={{ fontWeight: '800' }}>Send</Text> to dispatch the verification code to <Text style={{ fontFamily: 'monospace', fontWeight: '700' }}>{forgotTargetEmail}</Text>.
                  </Text>
                  <Text style={styles.guideStep}>
                    3. Enter your new password below and tap <Text style={{ fontWeight: '800' }}>Confirm Reset</Text>.
                  </Text>
                </View>

                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textSecondary}
                  value={forgotNewPassword}
                  onChangeText={setForgotNewPassword}
                  secureTextEntry
                />

                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textSecondary}
                  value={forgotConfirmPassword}
                  onChangeText={setForgotConfirmPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={handlePerformReset}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>I Sent the Email — Reset Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backStepBtn}
                  onPress={() => setForgotStep(1)}
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
  passwordLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  forgotLink: { fontSize: 12, fontWeight: '700', color: colors.accent },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  switchAuth: { marginTop: spacing.md, alignItems: 'center' },
  switchText: { fontSize: 13, color: colors.textSecondary },
  switchHighlight: { color: colors.accent, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.card, width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 16, padding: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: { padding: 8 },
  modalCloseText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  modalErrorBox: { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.md },
  modalErrorText: { color: '#B91C1C', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modalSuccessBox: { backgroundColor: '#DCFCE7', borderColor: '#22C55E', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.md },
  modalSuccessText: { color: '#15803D', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  uniRow: { flexDirection: 'row', marginBottom: spacing.md },
  uniPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, marginHorizontal: 3 },
  uniPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  uniPillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  uniPillTextActive: { color: '#fff' },
  emailInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  emailPrefixInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  domainSuffix: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  modalHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 16 },
  modalPrimaryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginVertical: spacing.sm },
  modalPrimaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  codeHighlightBox: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: spacing.md },
  codeLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, marginBottom: 4 },
  codeText: { fontSize: 32, fontWeight: '800', letterSpacing: 6, color: colors.primary, fontFamily: 'monospace', marginVertical: 4 },
  copySmallBtn: { marginTop: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  copySmallText: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  outlookBtn: { backgroundColor: '#0078D4', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.md },
  outlookBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reverseVerifyGuide: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.md },
  guideStep: { fontSize: 12, color: '#166534', lineHeight: 18, marginBottom: 4 },
  backStepBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  backStepText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
