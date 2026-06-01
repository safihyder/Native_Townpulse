import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '../theme/tokens';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  isLoading?: boolean;
};

export function ActionButton({
  disabled = false,
  isLoading = false,
  label,
  onPress,
  variant = 'primary',
}: ActionButtonProps): React.JSX.Element {
  const isInactive = disabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && !isInactive && styles.pressed,
        isInactive && styles.disabled,
      ]}>
      <View style={styles.inner}>
        {isLoading ? (
          <ActivityIndicator
            color={variant === 'primary' ? theme.colors.white : theme.colors.brandPrimary}
          />
        ) : null}
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant !== 'primary' && styles.secondaryLabel,
          ]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 58,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  primary: {
    backgroundColor: theme.colors.brandPrimary,
  },
  secondary: {
    backgroundColor: theme.colors.brandPrimarySoft,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.7,
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  primaryLabel: {
    color: theme.colors.white,
  },
  secondaryLabel: {
    color: theme.colors.brandPrimary,
  },
});
