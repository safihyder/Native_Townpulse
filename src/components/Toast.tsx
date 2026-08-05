import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme/tokens';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export type ToastData = {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
  autoDismissMs?: number | null; // null = no auto dismiss
};

type ToastItemProps = {
  toast: ToastData;
  onDismiss: (id: string) => void;
  index: number;
};

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  error: {
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: '✕',
    text: '#991B1B',
  },
  success: {
    bg: '#F0FDF4',
    border: '#BBF7D0',
    icon: '✓',
    text: '#166534',
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: '⚠',
    text: '#92400E',
  },
  info: {
    bg: '#FFFDF5',
    border: '#FDE68A',
    icon: 'ℹ',
    text: '#78641B',
  },
};

const ICON_BG: Record<ToastType, string> = {
  error: '#FEE2E2',
  success: '#DCFCE7',
  warning: '#FEF3C7',
  info: '#FEF9E7',
};

function ToastItem({ toast, onDismiss, index }: ToastItemProps) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const colors = TOAST_COLORS[toast.type];
  const autoDismiss = toast.autoDismissMs !== null
    ? (toast.autoDismissMs ?? (toast.type === 'error' ? null : toast.type === 'warning' ? 4000 : 3000))
    : null;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    if (autoDismiss) {
      const timer = setTimeout(() => handleDismiss(), autoDismiss);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id));
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          transform: [{ translateY }],
          opacity,
          marginTop: index > 0 ? 8 : 0,
        },
      ]}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: ICON_BG[toast.type] }]}>
        <Text style={[styles.iconText, { color: colors.text }]}>{colors.icon}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {toast.title}
        </Text>
        {toast.body ? (
          <Text style={[styles.body, { color: colors.text }]} numberOfLines={3}>
            {toast.body}
          </Text>
        ) : null}
      </View>

      {/* Dismiss */}
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.dismissBtn}>
        <Text style={[styles.dismissText, { color: colors.text }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

type ToastContainerProps = {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={[styles.container, { top: insets.top + 8 }]}
      pointerEvents="box-none">
      {toasts.slice(0, 3).map((toast, i) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    ...theme.shadow.card,
    elevation: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    opacity: 0.85,
    lineHeight: 18,
  },
  dismissBtn: {
    padding: 4,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.6,
  },
});
