import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  pressedOpacity?: number;
  children: React.ReactNode;
};

/**
 * A drop-in replacement for TouchableOpacity that uses spring scale + opacity
 * animation on press for a premium, responsive button feel.
 *
 * Uses `useNativeDriver: true` for 60fps performance.
 */
export function PressableScale({
  style,
  scaleValue = 0.96,
  pressedOpacity = 0.85,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleValue,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: pressedOpacity,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleValue, pressedOpacity]);

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

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}>
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: disabled ? 0.5 : opacityAnim,
          },
        ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
