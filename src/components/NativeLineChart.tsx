import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ScrollView } from 'react-native';

import { theme } from '../theme/tokens';

type LineDataPoint = {
  label: string;
  value: number;
};

type NativeLineChartProps = {
  data: LineDataPoint[];
  height?: number;
  color?: string;
  showCurrency?: boolean;
};

export function NativeLineChart({
  data,
  height = 180,
  color = theme.colors.brandPrimary,
  showCurrency = true,
}: NativeLineChartProps): React.JSX.Element {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const range = maxValue - minValue || 1;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [data]);

  const formatValue = (v: number) => {
    if (v >= 100000) return (v / 1000).toFixed(0) + 'k';
    if (v >= 10000) return (v / 1000).toFixed(0) + 'k';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v.toFixed(0);
  };

  // Chart area dimensions
  const chartAreaHeight = height - 48; // top label + bottom label
  const pointSpacing = 48;
  const chartWidth = Math.max((data.length - 1) * pointSpacing + 40, 200);

  // Calculate Y positions (inverted because screen Y goes down)
  const getY = (val: number) => {
    return chartAreaHeight - ((val - minValue) / range) * (chartAreaHeight - 16);
  };

  // Generate Y-axis grid lines (3 lines)
  const gridLines = [0, 0.5, 1].map(pct => ({
    y: chartAreaHeight - pct * (chartAreaHeight - 16),
    value: minValue + pct * range,
  }));

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ minWidth: '100%' }}>
        <View style={{ width: chartWidth, height: '100%' }}>
          {/* Y-axis grid lines */}
          <View style={[styles.chartArea, { height: chartAreaHeight }]}>
            {gridLines.map((line, i) => (
              <View
                key={i}
                style={[
                  styles.gridLine,
                  { top: line.y },
                ]}>
                <Text style={styles.gridLabel}>
                  {showCurrency ? '₹' : ''}{formatValue(line.value)}
                </Text>
                <View style={styles.gridDash} />
              </View>
            ))}

            {/* Area fill + Line segments */}
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}>
              {/* Connecting lines between points */}
              {data.map((point, i) => {
                if (i === data.length - 1) return null;
                const x1 = i * pointSpacing + 20;
                const y1 = getY(point.value);
                const x2 = (i + 1) * pointSpacing + 20;
                const y2 = getY(data[i + 1].value);

                const dx = x2 - x1;
                const dy = y2 - y1;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

                return (
                  <View
                    key={`line-${i}`}
                    style={{
                      position: 'absolute',
                      left: x1,
                      top: y1,
                      width: length,
                      height: 2.5,
                      backgroundColor: color,
                      borderRadius: 1.5,
                      transform: [{ rotate: `${angle}deg` }],
                      transformOrigin: 'left center',
                    }}
                  />
                );
              })}

              {/* Data point dots */}
              {data.map((point, i) => {
                const x = i * pointSpacing + 20;
                const y = getY(point.value);
                return (
                  <View
                    key={`dot-${i}`}
                    style={[
                      styles.dot,
                      {
                        left: x - 5,
                        top: y - 5,
                        backgroundColor: color,
                      },
                    ]}>
                    <View style={styles.dotInner} />
                  </View>
                );
              })}

              {/* Value labels on top of dots */}
              {data.map((point, i) => {
                const x = i * pointSpacing + 20;
                const y = getY(point.value);
                return (
                  <View
                    key={`val-${i}`}
                    style={{
                      position: 'absolute',
                      left: x - 24,
                      top: y - 20,
                      width: 48,
                      alignItems: 'center',
                    }}>
                    <Text style={[styles.pointValue, { color }]} numberOfLines={1}>
                      {showCurrency ? '₹' : ''}{formatValue(point.value)}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          </View>

          {/* X-axis labels */}
          <View style={styles.xAxis}>
            {data.map((point, i) => (
              <View
                key={`label-${i}`}
                style={[
                  styles.xLabelContainer,
                  { left: i * pointSpacing + 20 - 20 },
                ]}>
                <Text style={styles.xLabel}>{point.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 13,
  },
  chartArea: {
    position: 'relative',
    marginLeft: 4,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
    marginRight: 6,
  },
  gridDash: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  dotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  pointValue: {
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
  xAxis: {
    height: 24,
    position: 'relative',
    marginTop: 4,
  },
  xLabelContainer: {
    position: 'absolute',
    width: 40,
    alignItems: 'center',
  },
  xLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
});
