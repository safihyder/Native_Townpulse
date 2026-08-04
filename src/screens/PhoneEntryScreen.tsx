import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthScaffold } from '../components/AuthScaffold';
import { TextField } from '../components/TextField';
import { appConfig } from '../config/appConfig';
import { theme } from '../theme/tokens';

type PhoneEntryMode = 'phone-sign-in' | 'google-link';

type PhoneEntryScreenProps = {
  currentStepLabel: string;
  mode: PhoneEntryMode;
  phoneValue: string;
  errorMessage: string | null;
  isBusy: boolean;
  onBack: () => void;
  onChangePhone: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function PhoneEntryScreen({
  currentStepLabel,
  errorMessage,
  isBusy,
  mode,
  onBack,
  onChangePhone,
  onSubmit,
  phoneValue,
}: PhoneEntryScreenProps): React.JSX.Element {
  const isGoogleFlow = mode === 'google-link';

  return (
    <AuthScaffold
      currentStepLabel={currentStepLabel}
      subtitle={
        isGoogleFlow
          ? 'We need a verified mobile number to finish setting up your account.'
          : 'Enter your mobile number to receive a one-time password.'
      }
      title={
        isGoogleFlow
          ? 'Verify your phone'
          : 'Sign in'
      }>
      <TextField
        autoFocus
        keyboardType="number-pad"
        label="Mobile number"
        maxLength={10}
        onChangeText={onChangePhone}
        placeholder="9876543210"
        prefixLabel={appConfig.supportCountryCode}
        value={phoneValue}
      />

      <Text style={styles.helperText}>
        Enter a valid 10-digit number to receive your OTP.
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.buttonContainer}>
        <ActionButton
          isLoading={isBusy}
          label={isGoogleFlow ? 'Send verification OTP' : 'Send OTP'}
          onPress={() => onSubmit(phoneValue)}
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
  helperText: {
    color: theme.colors.ink500,
    fontSize: theme.typography.small,
    lineHeight: 20,
    marginTop: theme.spacing.sm,
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 12,
  },
  error: {
    color: theme.colors.danger,
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.small,
    fontWeight: '600',
  },
});

