import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthScaffold } from '../components/AuthScaffold';
import { OtpBoxes } from '../components/OtpBoxes';
import { theme } from '../theme/tokens';
import { formatDisplayPhone } from '../utils/phone';

type OtpMode = 'phone-sign-in' | 'google-link';

type OtpVerificationScreenProps = {
  currentStepLabel: string;
  mode: OtpMode;
  phoneNumber: string;
  otpValue: string;
  errorMessage: string | null;
  isBusy: boolean;
  onBack: () => void;
  onChangeOtp: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
};

export function OtpVerificationScreen({
  currentStepLabel,
  errorMessage,
  isBusy,
  mode,
  onBack,
  onChangeOtp,
  onResend,
  onVerify,
  otpValue,
  phoneNumber,
}: OtpVerificationScreenProps): React.JSX.Element {
  const isGoogleLink = mode === 'google-link';

  return (
    <AuthScaffold
      currentStepLabel={currentStepLabel}
      subtitle={`We sent a 6-digit code to ${formatDisplayPhone(phoneNumber)}. Enter it below to continue.`}
      title={
        isGoogleLink
          ? 'Finish linking your verified phone.'
          : 'Enter the OTP to sign in.'
      }>
      <OtpBoxes onChangeText={onChangeOtp} value={otpValue} />

      <Text style={styles.helperText}>
        {isGoogleLink
          ? 'Once verified, the same Firebase account will carry both Google and phone auth.'
          : 'After verification, the app syncs your Firebase token with the existing TownPulse backend.'}
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <ActionButton
        disabled={otpValue.length !== 6}
        isLoading={isBusy}
        label={isGoogleLink ? 'Verify and continue' : 'Verify OTP'}
        onPress={onVerify}
      />
      <ActionButton
        disabled={isBusy}
        label="Resend OTP"
        onPress={onResend}
        variant="secondary"
      />
      <ActionButton
        disabled={isBusy}
        label="Back"
        onPress={onBack}
        variant="ghost"
      />

      <View style={styles.footerHint}>
        <Text style={styles.footerHintTitle}>Tip</Text>
        <Text style={styles.footerHintBody}>
          Auto-read may fill the code for you on Android if Firebase and your
          device configuration allow it.
        </Text>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: theme.colors.ink500,
    fontSize: theme.typography.small,
    lineHeight: 20,
    marginTop: theme.spacing.md,
  },
  error: {
    color: theme.colors.danger,
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    fontSize: theme.typography.small,
    fontWeight: '600',
  },
  footerHint: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.brandCard,
  },
  footerHintTitle: {
    color: theme.colors.ink900,
    fontSize: theme.typography.small,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  footerHintBody: {
    color: theme.colors.ink500,
    fontSize: theme.typography.small,
    lineHeight: 20,
  },
});
