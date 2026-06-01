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

const featureList = [
  'Food-delivery style onboarding',
  'Firebase OTP verification',
  'Google sign-in with phone verification',
];

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
      subtitle="Fast, clean onboarding for TownPulse customers. Sign in like a delivery app, then land inside a demo dashboard."
      title="Login that feels quick, warm, and ready to order.">
      <View style={styles.featureStrip}>
        {featureList.map((item) => (
          <View key={item} style={styles.featureChip}>
            <Text style={styles.featureChipText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose your path</Text>
        <Text style={styles.sectionCopy}>
          Google comes first. Phone sign-in stays one tap away.
        </Text>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <ActionButton
        isLoading={isBusy}
        label="Continue with Google"
        onPress={onContinueWithGoogle}
      />
      <ActionButton
        disabled={isBusy}
        label="Continue with Phone"
        onPress={onContinueWithPhone}
        variant="secondary"
      />

      <View style={styles.infoPanel}>
        <Text style={styles.infoTitle}>How this flow works</Text>
        <Text style={styles.infoBody}>
          Phone sign-in uses Firebase OTP. Google sign-in works too, but if the
          Google account has no phone number linked, the app asks for number
          verification before opening the dashboard.
        </Text>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  featureStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  featureChip: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandAccentSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  featureChipText: {
    color: theme.colors.brandAccent,
    fontSize: theme.typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  section: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.ink900,
    fontSize: theme.typography.h2,
    fontWeight: '900',
  },
  sectionCopy: {
    color: theme.colors.ink500,
    fontSize: theme.typography.body,
    lineHeight: 24,
    marginTop: theme.spacing.xs,
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
  infoPanel: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.brandCard,
    padding: theme.spacing.lg,
  },
  infoTitle: {
    color: theme.colors.ink900,
    fontSize: theme.typography.body,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  infoBody: {
    color: theme.colors.ink500,
    fontSize: theme.typography.small,
    lineHeight: 21,
  },
});
