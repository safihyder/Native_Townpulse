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
      subtitle={`We sent a 6-digit code to ${formatDisplayPhone(phoneNumber)}.`}
      title="Enter 6 digit otp">
      <OtpBoxes onChangeText={onChangeOtp} value={otpValue} />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.buttonContainer}>
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
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  error: {
    color: theme.colors.danger,
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.md,
    fontSize: theme.typography.small,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 24,
  },
});

