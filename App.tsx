import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthLandingScreen } from './src/screens/AuthLandingScreen';
import { OtpVerificationScreen } from './src/screens/OtpVerificationScreen';
import { PhoneEntryScreen } from './src/screens/PhoneEntryScreen';
import { TestDashboardScreen } from './src/screens/TestDashboardScreen';
import { RestaurantDashboardScreen } from './src/screens/RestaurantDashboardScreen';
import { DeliveryDashboardScreen } from './src/screens/delivery/DeliveryDashboardScreen';
import { UserDashboardScreen } from './src/screens/user/UserDashboardScreen';
import type { SyncedTownPulseSession } from './src/services/backendAuth';
import {
  requestNotificationPermission,
  setupForegroundNotificationHandler,
} from './src/services/notificationService';
import { syncTownPulseUser } from './src/services/backendAuth';
import messaging from '@react-native-firebase/messaging';
import {
  confirmOtpCode,
  getCurrentFirebaseUserSnapshot,
  getFreshFirebaseIdToken,
  triggerPhoneOtp,
  confirmPhoneLinkOtp,
  signInWithGoogle,
  signOutEverywhere,
  type PhoneConfirmation,
} from './src/services/firebaseAuth';
import auth from '@react-native-firebase/auth';
import { sanitizeIndianPhoneInput } from './src/utils/phone';

type AppScreen =
  | 'restoring'    // Silent auto-login in progress
  | 'landing'
  | 'phone-entry'
  | 'verify-google-phone'
  | 'otp'
  | 'dashboard';

type OtpMode = 'phone-sign-in' | 'google-link';

type OtpSession = {
  confirmation: PhoneConfirmation;
  mode: OtpMode;
  phoneNumber: string;
};

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<AppScreen>('restoring'); // Start in restoring state
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSession, setOtpSession] = useState<OtpSession | null>(null);
  const [dashboardSession, setDashboardSession] =
    useState<SyncedTownPulseSession | null>(null);

  const phoneEntryMode =
    screen === 'verify-google-phone' ? 'google-link' : 'phone-sign-in';

  // 🟢 AUTO-RESTORE SESSION: Listen to Firebase auth state
  // If user was logged in before, Firebase fires this instantly on app start.
  // We silently re-sync and jump straight to dashboard.
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const syncedSession = await syncTownPulseUser({
            idToken,
            firebaseUid: firebaseUser.uid,
            fallbackName: firebaseUser.displayName || 'TownPulse User',
            fallbackPhone: firebaseUser.phoneNumber,
            fallbackEmail: firebaseUser.email,
            providerIds: firebaseUser.providerData.map((p: any) => p.providerId),
          });
          setDashboardSession(syncedSession);

          // Re-register FCM token silently
          try {
            const fcmToken = await messaging().getToken();
            if (fcmToken) {
              await fetch(`${(await import('./src/config/appConfig')).appConfig.apiBaseUrl}/api/auth/fcm-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ token: fcmToken }),
              });
            }
          } catch {}

          startTransition(() => setScreen('dashboard'));
        } catch {
          // Session restore failed (server down etc), show login
          startTransition(() => setScreen('landing'));
        }
      } else {
        // No Firebase user — show login screen
        startTransition(() => setScreen('landing'));
      }
    });
    return () => unsubscribe();
  }, []);

  // Request notification permission on app launch
  useEffect(() => {
    requestNotificationPermission();
    const unsubscribe = setupForegroundNotificationHandler();
    return () => unsubscribe();
  }, []);

  const clearTransientState = () => {
    setErrorMessage(null);
    setOtpCode('');
  };

const openDashboard = async () => {
  try {
    const currentUser = getCurrentFirebaseUserSnapshot();
    const idToken = await getFreshFirebaseIdToken();

    // 1. Log what we are sending to find the missing field
    console.log("SYNCING:", {
      uid: currentUser.uid,
      email: currentUser.email, // Check if this is null!
      phone: currentUser.phoneNumber,
    });

    const syncedSession = await syncTownPulseUser({
      idToken,
      firebaseUid: currentUser.uid,
      fallbackName: currentUser.displayName || 'TownPulse User',
      fallbackPhone: currentUser.phoneNumber,
      fallbackEmail: currentUser.email, // May be null for phone-only login
      providerIds: currentUser.providerIds,
    });

    setDashboardSession(syncedSession);

    // Register FCM token with backend so server can push notifications to this device
    try {
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        await fetch(`${(await import('./src/config/appConfig')).appConfig.apiBaseUrl}/api/auth/fcm-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token: fcmToken }),
        });
      }
    } catch (fcmErr) {
      console.warn('[FCM] Token registration skipped:', fcmErr);
    }

    startTransition(() => setScreen('dashboard'));
  } catch (error: any) {
    console.error("DEBUG SYNC ERROR:", error);

    // ✅ FRIENDLY ERROR HANDLING
    if (error.message.includes('400') || error.message.includes('already linked')) {
      setErrorMessage("This phone number is already linked to another account. Please sign in with Google.");
    } else {
      setErrorMessage("Server error: Unable to sync profile.");
    }
  }
};

  const startOtpFlow = async (rawPhoneNumber: string, mode: OtpMode) => {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const sanitizedPhone = sanitizeIndianPhoneInput(rawPhoneNumber);
 // ✅ NEW CODE
      const confirmation = await triggerPhoneOtp(sanitizedPhone.e164Phone);

      setPhoneDraft(sanitizedPhone.localNumber);
      setOtpSession({
        confirmation,
        mode,
        phoneNumber: sanitizedPhone.e164Phone,
      });
      setOtpCode('');

      startTransition(() => setScreen('otp'));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not send OTP.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleGooglePress = async () => {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const firebaseUser = await signInWithGoogle();

      if (!firebaseUser.phoneNumber) {
        setPhoneDraft('');
        startTransition(() => setScreen('verify-google-phone'));
        return;
      }

      await openDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Google sign-in failed. Please try again.',
      );
    } finally {
      setIsBusy(false);
    }
  };

const handleOtpVerification = async () => {
    if (!otpSession) {
      setErrorMessage('OTP session expired. Please request a new code.');
      startTransition(() => setScreen('landing'));
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      // 1. Decide whether to LINK or SIGN IN
      if (otpSession.mode === 'google-link') {
        // ✅ This keeps the Google session active and attaches the phone
        await confirmPhoneLinkOtp(otpSession.confirmation, otpCode);
      } else {
        // This is for standard phone-only login
        await confirmOtpCode(otpSession.confirmation, otpCode);
      }

      // 2. Everything succeeded! Sync with your backend and go to dashboard
      await openDashboard();
      
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Invalid OTP. Please retry.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpSession) {
      return;
    }

    await startOtpFlow(otpSession.phoneNumber, otpSession.mode);
  };

  const handleSignOut = async () => {
    setIsBusy(true);

    try {
      await signOutEverywhere();
      setDashboardSession(null);
      setOtpSession(null);
      setPhoneDraft('');
      clearTransientState();
      startTransition(() => setScreen('landing'));
    } catch (error) {
      Alert.alert(
        'Sign out failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const currentStepLabel = useMemo(() => {
    switch (screen) {
      case 'restoring':
        return 'Restoring session';
      case 'phone-entry':
        return 'Phone sign in';
      case 'verify-google-phone':
        return 'Verify after Google';
      case 'otp':
        return otpSession?.mode === 'google-link'
          ? 'Phone verification OTP'
          : 'Phone sign in OTP';
      case 'dashboard':
        return 'Authenticated';
      case 'landing':
      default:
        return 'TownPulse auth';
    }
  }, [otpSession?.mode, screen]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Branded splash shown while Firebase silently checks auth state */}
      {screen === 'restoring' && (
        <View style={splashStyles.container}>
          <View style={splashStyles.brandRow}>
            <View style={splashStyles.brandMark}>
              <Text style={splashStyles.brandMarkText}>TP</Text>
            </View>
            <Text style={splashStyles.brand}>TownPulse</Text>
          </View>
          <ActivityIndicator size="large" color="#F5C116" style={{ marginTop: 28 }} />
          <Text style={splashStyles.sub}>Restoring your session…</Text>
        </View>
      )}

      {screen === 'landing' && (
        <AuthLandingScreen
          currentStepLabel={currentStepLabel}
          errorMessage={errorMessage}
          isBusy={isBusy}
          onContinueWithGoogle={handleGooglePress}
          onContinueWithPhone={() => {
            clearTransientState();
            startTransition(() => setScreen('phone-entry'));
          }}
        />
      )}

      {(screen === 'phone-entry' || screen === 'verify-google-phone') && (
        <PhoneEntryScreen
          currentStepLabel={currentStepLabel}
          errorMessage={errorMessage}
          isBusy={isBusy}
          mode={phoneEntryMode}
          phoneValue={phoneDraft}
          onBack={() => {
            clearTransientState();
            startTransition(() => setScreen('landing'));
          }}
          onChangePhone={(value) => {
            setPhoneDraft(value);
            if (errorMessage) {
              setErrorMessage(null);
            }
          }}
          onSubmit={(value) => startOtpFlow(value, phoneEntryMode)}
        />
      )}

      {screen === 'otp' && otpSession && (
        <OtpVerificationScreen
          currentStepLabel={currentStepLabel}
          errorMessage={errorMessage}
          isBusy={isBusy}
          mode={otpSession.mode}
          otpValue={otpCode}
          phoneNumber={otpSession.phoneNumber}
          onBack={() => {
            clearTransientState();
            startTransition(() =>
              setScreen(
                otpSession.mode === 'google-link'
                  ? 'verify-google-phone'
                  : 'phone-entry',
              ),
            );
          }}
          onChangeOtp={(value) => {
            setOtpCode(value);
            if (errorMessage) {
              setErrorMessage(null);
            }
          }}
          onResend={handleResendOtp}
          onVerify={handleOtpVerification}
        />
      )}

      {screen === 'dashboard' && dashboardSession && (
        dashboardSession.user.role === 'manager' ? (
          <RestaurantDashboardScreen
            currentStepLabel={currentStepLabel}
            onSignOut={handleSignOut}
            session={dashboardSession}
          />
        ) : dashboardSession.user.role === 'delivery' ? (
          <DeliveryDashboardScreen
            session={dashboardSession}
            onSignOut={handleSignOut}
          />
        ) : dashboardSession.user.role === 'user' ? (
          <UserDashboardScreen
            session={dashboardSession}
            onSignOut={handleSignOut}
            onSessionUpdate={setDashboardSession}
          />
        ) : (
          <TestDashboardScreen
            currentStepLabel={currentStepLabel}
            isBusy={isBusy}
            onSignOut={handleSignOut}
            session={dashboardSession}
          />
        )
      )}
    </SafeAreaProvider>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F5C116',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandMarkText: {
    color: '#121212',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brand: {
    fontSize: 34,
    fontWeight: '900',
    color: '#121212',
    letterSpacing: 0.5,
  },
  sub: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
    color: '#B0B0B0',
  },
});

export default App;
