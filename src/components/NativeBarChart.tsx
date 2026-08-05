import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ScrollView } from 'react-native';

import { theme } from '../theme/tokens';

type BarDataPoint = {
  label: string;
  value: number;
};

type NativeBarChartProps = {
  data: BarDataPoint[];
  height?: number;
};

export function NativeBarChart({ data, height = 160 }: NativeBarChartProps): React.JSX.Element {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const animValuesRef = useRef<Animated.Value[]>([]);
  if (!animValuesRef.current || animValuesRef.current.length !== data.length) {
    animValuesRef.current = data.map(() => new Animated.Value(0));
  }
  const animValues = animValuesRef.current;

  useEffect(() => {
    const animations = animValues.map((anim, i) =>
      Animated.timing(anim, {
        toValue: data[i].value / maxValue,
        duration: 600,
        delay: i * 80,
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [data, maxValue, animValues]);

  const formatValue = (v: number) => {
    if (v >= 10000) return (v / 1000).toFixed(0) + 'k';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v.toString();
  };

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.barsRow}>
          {data.map((point, i) => {
            const barHeight = animValues[i].interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            });

            return (
              <View key={point.label} style={styles.barColumn}>
                <View style={styles.barValueContainer}>
                  {point.value > 0 && (
                    <Text style={styles.barValueText} numberOfLines={1} adjustsFontSizeToFit>
                      ₹{formatValue(point.value)}
                    </Text>
                  )}
                </View>
                <View style={styles.barTrack}>
                  <Animated.View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor:
                          point.value === maxValue
                            ? theme.colors.brandPrimary
                            : theme.colors.brandAccent,
                      },
                    ]}
                  />
                </View>
                <View style={styles.barLabelContainer}>
                  <Text style={styles.barLabel}>{point.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 16,
    paddingHorizontal: 8,
    minWidth: '100%',
    height: '100%',
  },
  barColumn: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barValueContainer: {
    height: 16,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '120%',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 2,
  },
  barLabelContainer: {
    height: 20,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  barValueText: {
    color: theme.colors.ink700,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  barLabel: {
    color: theme.colors.ink500,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
