import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { theme } from '../theme/tokens';

const { width, height } = Dimensions.get('window');

const IMG_1 = require('../assets/images/aa71d251acf4f6efe0c0e3aa741d755bb32c9b50.png');
const IMG_2 = require('../assets/images/48496e52b63e1a92e49253e4ebadf21fc87cf96d.png');

const SLIDES = [
  {
    id: '1',
    title: 'Delivery\neverywhere',
    subtitle:
      'We are always ready to deliver your items quickly and professionally',
    image: IMG_2,
    badges: ['rating', 'location'],
  },
  {
    id: '2',
    title: 'Fast food\ndelivery',
    subtitle:
      'We are always ready to deliver your items quickly and professionally',
    image: IMG_1,
    badges: ['time', 'energy'],
  },
];

const StarBadge = ({ style }: any) => (
  <View style={[styles.badgePill, style]}>
    <View style={[styles.badgeIcon, { backgroundColor: '#7BA4FF' }]} />
    <View style={{ flexDirection: 'row', marginLeft: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ color: '#FFC85C', fontSize: 14 }}>★</Text>
      ))}
    </View>
  </View>
);

const LocationBadge = ({ style }: any) => (
  <View style={[styles.badgeCircleContainer, style]}>
    <View style={[styles.badgeIcon, { backgroundColor: '#7BA4FF', width: 32, height: 32, borderRadius: 16 }]}>
       <View style={styles.pinTeardrop}>
         <View style={styles.pinHole} />
       </View>
    </View>
  </View>
);

const TimeBadge = ({ style }: any) => (
  <View style={[styles.badgePill, style]}>
    <View style={[styles.badgeIcon, { backgroundColor: '#FF5C66' }]}>
      <View style={styles.clockHandMin} />
      <View style={styles.clockHandHour} />
    </View>
    <Text style={{ marginLeft: 6, fontWeight: '800', color: '#111827', fontSize: 13 }}>15 min</Text>
  </View>
);

const EnergyBadge = ({ style }: any) => (
  <View style={[styles.badgeCircleContainer, style]}>
    <View style={[styles.badgeIcon, { backgroundColor: '#FF5C66', width: 32, height: 32, borderRadius: 16 }]}>
       <Text style={{ color: '#FFF', fontSize: 16 }}>⚡</Text>
    </View>
  </View>
);

type Props = {
  onComplete: () => void;
};

export function OnboardingScreen({ onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const scrollToNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      await AsyncStorage.setItem('@tp_onboarding_done', 'true');
      onComplete();
    }
  };

  const renderItem = ({ item }: any) => {
    return (
      <View style={styles.slide}>
        <LinearGradient
          colors={['#EAF3F8', '#F8E9C9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.imageContainer}
        >
          <Image
            source={item.image}
            style={styles.slideImage}
            resizeMode="contain"
          />
          {/* Render Badges absolutely positioned */}
          {item.badges?.includes('rating') && <StarBadge style={{ top: '15%', left: '8%' }} />}
          {item.badges?.includes('location') && <LocationBadge style={{ top: '40%', right: '8%' }} />}
          {item.badges?.includes('time') && <TimeBadge style={{ top: '25%', left: '8%' }} />}
          {item.badges?.includes('energy') && <EnergyBadge style={{ top: '15%', right: '8%' }} />}
        </LinearGradient>

        <Text style={styles.title}>{item.title}</Text>

        <Text style={styles.subtitle}>
          {item.subtitle}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={slidesRef}
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
      />

      <View style={styles.bottomBar}>
        <View style={styles.paginator}>
          {SLIDES.map((_, i) => {
            const inputRange = [
              (i - 1) * width,
              i * width,
              (i + 1) * width,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 20, 8],
              extrapolate: 'clamp',
            });

            const backgroundColor = scrollX.interpolate({
              inputRange,
              outputRange: [
                '#D1D5DB',
                '#F5B400',
                '#D1D5DB',
              ],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    backgroundColor,
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.85}
          onPress={scrollToNext}
        >
          <Text style={styles.nextButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  slide: {
    width,
    paddingHorizontal: 24,
    paddingTop: 15,
  },
  imageContainer: {
    width: width - 20,
    height: 400,
    borderRadius: 40,
    overflow: 'hidden',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },

  slideImage: {
    width: '115%',
    height: '105%',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 34,
    marginBottom: 16,
  },

  subtitle: {
    width: '88%',
    fontSize: 16,
    lineHeight: 28,
    color: '#6B7280',
  },

  bottomBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  paginator: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dot: {
    height: 6,
    borderRadius: 100,
    marginRight: 8,
  },

  nextButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: -4,
  },
  badgePill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 6,
    paddingRight: 12,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  badgeCircleContainer: {
    position: 'absolute',
    backgroundColor: '#FFF',
    padding: 6,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  badgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinTeardrop: {
    width: 14,
    height: 14,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 0,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinHole: {
    width: 6,
    height: 6,
    backgroundColor: '#7BA4FF',
    borderRadius: 3,
  },
  clockHandMin: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: '#FFF',
    top: 5,
    left: 11,
    borderRadius: 1,
  },
  clockHandHour: {
    position: 'absolute',
    width: 6,
    height: 2,
    backgroundColor: '#FFF',
    top: 11,
    left: 11,
    borderRadius: 1,
  },
});