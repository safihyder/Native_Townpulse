import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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

  // -- Spring scale animation on press --
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (isInactive) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isInactive]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // -- Pulse animation while loading --
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.92,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLoading]);

  const resolvedScale = isLoading ? pulseAnim : scaleAnim;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isInactive}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.base,
          variant === 'primary' && (isLoading ? styles.primaryLoading : styles.primary),
          variant === 'secondary' && (isLoading ? styles.secondaryLoading : styles.secondary),
          variant === 'ghost' && styles.ghost,
          disabled && !isLoading && styles.disabled,
          {
            transform: [{ scale: resolvedScale }],
            opacity: disabled && !isLoading ? 0.5 : opacityAnim,
          },
        ]}>
        <View style={styles.inner}>
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={variant === 'primary' ? '#FFFFFF' : theme.colors.brandPrimary}
            />
          ) : (
            <Text
              style={[
                styles.label,
                variant === 'primary' && styles.primaryLabel,
                variant !== 'primary' && styles.secondaryLabel,
              ]}>
              {label}
            </Text>
          )}
        </View>
      </Animated.View>
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
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 24,
  },
  primary: {
    backgroundColor: theme.colors.brandPrimary,
  },
  primaryLoading: {
    backgroundColor: '#E8D88A', // Muted gold while loading
  },
  secondary: {
    backgroundColor: theme.colors.brandPrimarySoft,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  secondaryLoading: {
    backgroundColor: 'rgba(245,193,22,0.06)',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    // opacity handled by Animated.View
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
