import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Dimensions } from 'react-native';
import Video from 'react-native-video';

const { width, height } = Dimensions.get('window');

type Props = {
  isReadyToTransition: boolean;
  onAnimationComplete: () => void;
};

export function SplashScreen({ isReadyToTransition, onAnimationComplete }: Props) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // When the app is ready (session restored/checked) AND video has loaded, fade out
    if (isReadyToTransition && isVideoLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        onAnimationComplete();
      });
    }
  }, [isReadyToTransition, isVideoLoaded, fadeAnim, onAnimationComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Video
        source={require('../assets/splash.mp4')}
        style={styles.video}
        resizeMode="contain"
        repeat
        poster="" // prevents some black flashes
        onLoad={() => setIsVideoLoaded(true)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'hsla(47, 100%, 50%, 0.97)', // closer match
    justifyContent: 'center',
    alignItems: 'center',
  },

  video: {
    width: width,
    height: height,
  },
});
