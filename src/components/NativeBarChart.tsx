import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

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
  const animValues = useRef(data.map(() => new Animated.Value(0))).current;

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

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.barsRow}>
        {data.map((point, i) => {
          const barHeight = animValues[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, height - 32],
          });

          return (
            <View key={point.label} style={styles.barColumn}>
              {point.value > 0 && (
                <Text style={styles.barValueText}>₹{point.value}</Text>
              )}
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
              <Text style={styles.barLabel}>{point.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 8,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    marginBottom: 2,
  },
  barLabel: {
    color: theme.colors.ink500,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
