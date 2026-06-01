import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '../theme/tokens';

type OtpBoxesProps = {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
};

export function OtpBoxes({
  length = 6,
  onChangeText,
  value,
}: OtpBoxesProps): React.JSX.Element {
  const inputRef = useRef<TextInput>(null);
  const slots = Array.from({ length }, (_, index) => value[index] ?? '');

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.root}>
      <View style={styles.row}>
        {slots.map((digit, index) => (
          <View key={index} style={styles.box}>
            <Text style={styles.digit}>{digit || '•'}</Text>
          </View>
        ))}
      </View>

      <TextInput
        autoComplete="sms-otp"
        caretHidden
        keyboardType="number-pad"
        maxLength={length}
        onChangeText={(text) =>
          onChangeText(text.replace(/\D/g, '').slice(0, length))
        }
        ref={inputRef}
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
        value={value}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  box: {
    flex: 1,
    minHeight: 64,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.brandCanvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.ink900,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
});
