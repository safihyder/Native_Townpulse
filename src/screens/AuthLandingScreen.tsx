import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthScaffold } from '../components/AuthScaffold';
import { theme } from '../theme/tokens';

type AuthLandingScreenProps = {
  currentStepLabel: string;
  isBusy: boolean;
  errorMessage: string | null;
  onContinueWithGoogle: () => void;
  onContinueWithPhone: () => void;
};

export function AuthLandingScreen({
  currentStepLabel,
  errorMessage,
  isBusy,
  onContinueWithGoogle,
  onContinueWithPhone,
}: AuthLandingScreenProps): React.JSX.Element {
  return (
    <AuthScaffold
      currentStepLabel={currentStepLabel}
      subtitle="Welcome to Town Pulse!"
      title="Sign in">
      
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.buttonContainer}>
        <ActionButton
          disabled={isBusy}
          label="Continue with Phone"
          onPress={onContinueWithPhone}
        />
        
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <ActionButton
          isLoading={isBusy}
          label="Sign in with Google"
          onPress={onContinueWithGoogle}
          variant="secondary"
        />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    gap: 16,
    marginTop: 16,
  },
  error: {
    color: theme.colors.danger,
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.small,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.line,
  },
  dividerText: {
    paddingHorizontal: 16,
    color: theme.colors.ink500,
    fontSize: 12,
    fontWeight: '600',
  },
});

