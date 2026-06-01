import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthScaffold } from '../components/AuthScaffold';
import type { SyncedTownPulseSession } from '../services/backendAuth';
import { theme } from '../theme/tokens';

type TestDashboardScreenProps = {
  currentStepLabel: string;
  isBusy: boolean;
  onSignOut: () => void;
  session: SyncedTownPulseSession;
};

export function TestDashboardScreen({
  currentStepLabel,
  isBusy,
  onSignOut,
  session,
}: TestDashboardScreenProps): React.JSX.Element {
  const backendUser = session.user;

  return (
    <AuthScaffold
      currentStepLabel={currentStepLabel}
      subtitle="This is the frontend-only post-auth placeholder screen. Later, this can become the real customer home."
      title="Test Dashboard">
      <View style={styles.successBanner}>
        <Text style={styles.successEyebrow}>Authenticated</Text>
        <Text style={styles.successTitle}>
          Firebase and backend sync completed.
        </Text>
      </View>

      <View style={styles.infoGrid}>
        <InfoCard label="Name" value={backendUser.name || 'TownPulse User'} />
        <InfoCard label="Role" value={backendUser.role || 'user'} />
        <InfoCard label="Phone" value={backendUser.phone || 'Not available'} />
        <InfoCard label="Email" value={backendUser.email || 'Not available'} />
        <InfoCard label="Firebase UID" value={session.firebase.uid} />
        <InfoCard label="Sync source" value={session.syncSource} />
      </View>

      <View style={styles.providerPanel}>
        <Text style={styles.providerTitle}>Linked providers</Text>
        <Text style={styles.providerText}>
          {session.firebase.providerIds.length > 0
            ? session.firebase.providerIds.join(', ')
            : 'No provider data reported'}
        </Text>
      </View>

      <ActionButton
        isLoading={isBusy}
        label="Sign out"
        onPress={onSignOut}
        variant="primary"
      />
    </AuthScaffold>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  successBanner: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandPrimarySoft,
    borderWidth: 1,
    borderColor: theme.colors.lineLight,
  },
  successEyebrow: {
    color: theme.colors.success,
    fontSize: theme.typography.micro,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  successTitle: {
    color: theme.colors.ink900,
    fontSize: theme.typography.h2,
    fontWeight: '900',
    lineHeight: 28,
  },
  infoGrid: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  infoCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandCanvas,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  infoLabel: {
    color: theme.colors.ink500,
    fontSize: theme.typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  infoValue: {
    color: theme.colors.ink900,
    fontSize: theme.typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  providerPanel: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.brandAccentSoft,
  },
  providerTitle: {
    color: theme.colors.brandAccent,
    fontSize: theme.typography.small,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  providerText: {
    color: theme.colors.ink700,
    fontSize: theme.typography.small,
    lineHeight: 20,
  },
});
