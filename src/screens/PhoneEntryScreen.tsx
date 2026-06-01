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
          ? 'Your Google account is in, but TownPulse still needs a verified mobile number before moving ahead.'
          : 'Enter your mobile number and Firebase will send a one-time password.'
      }
      title={
        isGoogleFlow
          ? 'Verify your phone to finish Google sign-in.'
          : 'Sign in with your mobile number.'
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
        We keep the flow India-first for now. Enter a valid 10-digit number to
        receive your OTP.
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

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

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Frontend-only setup</Text>
        <Text style={styles.noteBody}>
          This screen uses Firebase on mobile for OTP delivery. The backend is
          untouched and only receives the verified Firebase ID token later.
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
    marginTop: theme.spacing.sm,
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
  noteCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandAccentSoft,
  },
  noteTitle: {
    color: theme.colors.brandAccent,
    fontSize: theme.typography.small,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  noteBody: {
    color: theme.colors.ink700,
    fontSize: theme.typography.small,
    lineHeight: 20,
  },
});
