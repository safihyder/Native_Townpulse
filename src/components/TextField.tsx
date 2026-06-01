import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { theme } from '../theme/tokens';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  prefixLabel?: string;
  maxLength?: number;
};

export function TextField({
  autoFocus = false,
  keyboardType = 'default',
  label,
  maxLength,
  onChangeText,
  placeholder,
  prefixLabel,
  value,
}: TextFieldProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        {prefixLabel ? <Text style={styles.prefix}>{prefixLabel}</Text> : null}
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.ink500}
          style={styles.input}
          value={value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: theme.spacing.sm,
  },
  label: {
    color: theme.colors.ink700,
    fontSize: theme.typography.small,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.brandCanvas,
    paddingHorizontal: theme.spacing.md,
  },
  prefix: {
    color: theme.colors.ink900,
    fontSize: theme.typography.body,
    fontWeight: '800',
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.ink900,
    fontSize: theme.typography.body,
    paddingVertical: theme.spacing.md,
  },
});
