import React from 'react';
import { StyleSheet, View } from 'react-native';

export function BrandBackdrop(): React.JSX.Element {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />
      <View style={styles.goldOrb} />
      <View style={styles.warmOrb} />
    </View>
  );
}

const styles = StyleSheet.create({
  topGlow: {
    position: 'absolute',
    top: -120,
    left: -40,
    right: -60,
    height: 320,
    backgroundColor: '#FFFBF0',
    borderBottomLeftRadius: 140,
    borderBottomRightRadius: 180,
    transform: [{ rotate: '-6deg' }],
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -140,
    right: -40,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(245,193,22,0.06)',
  },
  goldOrb: {
    position: 'absolute',
    top: 120,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F5C116',
    opacity: 0.12,
  },
  warmOrb: {
    position: 'absolute',
    top: 220,
    left: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#F5C116',
    opacity: 0.08,
  },
});

