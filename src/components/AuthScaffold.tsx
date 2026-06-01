import React, { type ReactNode } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBackdrop } from './BrandBackdrop';
import { theme } from '../theme/tokens';

type AuthScaffoldProps = {
  currentStepLabel: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthScaffold({
  children,
  currentStepLabel,
  subtitle,
  title,
}: AuthScaffoldProps): React.JSX.Element {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#FFFBF0" />
      <View style={styles.root}>
        <BrandBackdrop />

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.heroBlock}>
            <View style={styles.brandPill}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>TP</Text>
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandEyebrow}>{currentStepLabel}</Text>
                <Text style={styles.brandName}>townpulse</Text>
              </View>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.card}>{children}</View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.brandCanvas,
  },
  root: {
    flex: 1,
    backgroundColor: theme.colors.brandCanvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.hero,
    paddingBottom: theme.spacing.xl,
  },
  heroBlock: {
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xl,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    paddingLeft: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(245,193,22,0.15)',
    marginBottom: theme.spacing.xl,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandMarkText: {
    color: theme.colors.brandPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  brandCopy: {
    gap: 2,
  },
  brandEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: theme.typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  brandName: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  title: {
    color: theme.colors.white,
    fontSize: theme.typography.hero,
    fontWeight: '900',
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: theme.typography.body,
    lineHeight: 24,
    maxWidth: 340,
  },
  card: {
    backgroundColor: theme.colors.brandCard,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.line,
    ...theme.shadow.card,
  },
});

