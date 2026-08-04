import React, { type ReactNode } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/tokens';

const { width } = Dimensions.get('window');

type AuthScaffoldProps = {
  currentStepLabel: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthScaffold({
  children,
  currentStepLabel,
  subtitle,
  title,
}: AuthScaffoldProps): React.JSX.Element {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF5F0" />
      <View style={styles.root}>
        
        {/* Top Illustration Area (matching Figma's warm top section) */}
        <View style={styles.topSection}>
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>🛵</Text>
          </View>
        </View>

        {/* Bottom Content Area (White rounded sheet) */}
        <View style={styles.bottomSheet}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.card}>{children}</View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF5F0', // Soft pinkish/warm background at the top
  },
  root: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  topSection: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F0', // Will be replaced by an image if provided
  },
  emojiCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 50,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: theme.colors.brandCanvas,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    // Soft shadow pointing up
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  headerText: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    color: theme.colors.ink900,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.ink500,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: theme.colors.brandCanvas,
    flex: 1,
  },
});

