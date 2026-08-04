import React from 'react';
import {
  BackHandler,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { UpdateStatus } from '../hooks/useAppUpdateCheck';
import { APP_VERSION } from '../hooks/useAppUpdateCheck';

type Props = {
  visible: boolean;
  updateStatus: UpdateStatus;
  onSkip: () => void;
};

// ── SVG Icons ────────────────────────────────────────────────────────────────
function UpdateIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Outer circle */}
      <Circle cx="32" cy="32" r="30" stroke="#F5A623" strokeWidth="3" fill="#FFF7ED" />
      {/* Arrow pointing up */}
      <Path
        d="M32 46V22"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Path
        d="M24 30l8-8 8 8"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom line */}
      <Path
        d="M22 46h20"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MandatoryIcon({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Shield shape */}
      <Path
        d="M32 4L8 16v16c0 14.4 10.2 27.9 24 32 13.8-4.1 24-17.6 24-32V16L32 4z"
        stroke="#EF4444"
        strokeWidth="2.5"
        fill="#FEF2F2"
      />
      {/* Exclamation mark */}
      <Path
        d="M32 22v14"
        stroke="#EF4444"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Circle cx="32" cy="44" r="2" fill="#EF4444" />
    </Svg>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureDot} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

export function AppUpdateModal({ visible, updateStatus, onSkip }: Props) {
  const isMandatory = updateStatus.updateType === 'MANDATORY';
  const banner = updateStatus.banner;
  const title = banner?.title || (isMandatory ? 'Critical Update Required' : 'Update Available');
  const message = updateStatus.message || 'A new version of TownPulse is available.';
  const skipAllowed = !isMandatory && (banner?.skipAllowed !== false);

  // Block back button on mandatory updates
  React.useEffect(() => {
    if (!visible || !isMandatory) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Block back press for mandatory updates
      return true;
    });
    return () => subscription.remove();
  }, [visible, isMandatory]);

  const handleUpdate = () => {
    const storeUrl = updateStatus.storeUrl || banner?.primaryAction?.url;
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(() => {});
    }
  };

  const handleSkip = async () => {
    // Track the skip on backend (fire-and-forget)
    try {
      const { appConfig } = await import('../config/appConfig');
      fetch(`${appConfig.apiBaseUrl}/api/system/update-warning/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: Platform.OS,
          appVersion: APP_VERSION,
        }),
      }).catch(() => {});
    } catch {}

    onSkip();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isMandatory) onSkip();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            {isMandatory ? <MandatoryIcon size={72} /> : <UpdateIcon size={72} />}
          </View>

          {/* Title */}
          <Text style={[styles.title, isMandatory && styles.titleMandatory]}>
            {title}
          </Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Version info */}
          <View style={styles.versionRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionLabel}>Current</Text>
              <Text style={styles.versionValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.versionArrow}>
              <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                <Path d="M4 10h12M12 6l4 4-4 4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={[styles.versionBadge, styles.versionBadgeNew]}>
              <Text style={styles.versionLabel}>Latest</Text>
              <Text style={[styles.versionValue, styles.versionValueNew]}>
                {updateStatus.latestVersion}
              </Text>
            </View>
          </View>

          {/* Feature highlights */}
          <View style={styles.featuresContainer}>
            <FeatureItem text="Bug fixes & stability improvements" />
            <FeatureItem text="New features & performance boosts" />
            <FeatureItem text="Security patches" />
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            style={[styles.updateBtn, isMandatory && styles.updateBtnMandatory]}
            onPress={handleUpdate}
            activeOpacity={0.8}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" style={{ marginRight: 8 }}>
              <Path d="M10 3v10M6 9l4 4 4-4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M4 15h12" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
            </Svg>
            <Text style={styles.updateBtnText}>Update Now</Text>
          </TouchableOpacity>

          {skipAllowed && (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>Skip for Now</Text>
            </TouchableOpacity>
          )}

          {isMandatory && (
            <View style={styles.mandatoryNotice}>
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <Circle cx="7" cy="7" r="6" stroke="#EF4444" strokeWidth="1.5" />
                <Path d="M7 4v3" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                <Circle cx="7" cy="10" r="0.75" fill="#EF4444" />
              </Svg>
              <Text style={styles.mandatoryText}>
                This update is required to continue using the app.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C2434',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleMandatory: {
    color: '#DC2626',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  versionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  versionBadgeNew: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  versionLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '800',
    marginTop: 2,
  },
  versionValueNew: {
    color: '#D97706',
  },
  versionArrow: {
    padding: 4,
  },
  featuresContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F5A623',
  },
  featureText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5A623',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  updateBtnMandatory: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  updateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 10,
  },
  skipBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  mandatoryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mandatoryText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
});
