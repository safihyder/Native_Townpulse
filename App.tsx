import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppUpdateCheck } from './src/hooks/useAppUpdateCheck';
import { AppUpdateModal } from './src/components/AppUpdateModal';
import { ToastProvider } from './src/context/ToastContext';

import { SplashScreen } from './src/screens/SplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AuthUnifiedScreen } from './src/screens/AuthUnifiedScreen';
import { RestaurantDashboardScreen } from './src/screens/restaurant/RestaurantDashboardScreen';
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
import { theme } from './src/theme/tokens';

type AppScreen =
  | 'splash'
  | 'onboarding'
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
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [initialScreen, setInitialScreen] = useState<AppScreen | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSession, setOtpSession] = useState<OtpSession | null>(null);
  const [dashboardSession, setDashboardSession] =
    useState<SyncedTownPulseSession | null>(null);

  // App Update Check — works for ALL roles
  const { updateStatus, shouldShow: showUpdateModal, dismiss: dismissUpdate } = useAppUpdateCheck();

  const phoneEntryMode =
    screen === 'verify-google-phone' ? 'google-link' : 'phone-sign-in';

  // INITIALIZATION & AUTO-RESTORE
  useEffect(() => {
    let isMounted = true;

    const initializeApp = async (firebaseUser: any) => {
      try {
        const hasOnboarded = await AsyncStorage.getItem('@tp_onboarding_done');

        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          const syncedSession = await syncTownPulseUser({
            idToken,
            firebaseUid: firebaseUser.uid,
            fallbackName: firebaseUser.displayName || 'TownPulse User',
            fallbackPhone: firebaseUser.phoneNumber,
            fallbackEmail: firebaseUser.email,
            providerIds: firebaseUser.providerData.map((p: any) => p.providerId),
          });

          if (isMounted) {
            setDashboardSession(syncedSession);
            setInitialScreen('dashboard');
            setIsAuthReady(true);
          }

          try {
            const fcmToken = await messaging().getToken();
            if (fcmToken) {
              await fetch(`${(await import('./src/config/appConfig')).appConfig.apiBaseUrl}/api/auth/fcm-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ token: fcmToken }),
              });
            }
          } catch { }
        } else {
          if (isMounted) {
            setInitialScreen(hasOnboarded === 'true' ? 'landing' : 'onboarding');
            setIsAuthReady(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          // If sync fails, fallback to landing or onboarding
          const hasOnboarded = await AsyncStorage.getItem('@tp_onboarding_done');
          setInitialScreen(hasOnboarded === 'true' ? 'landing' : 'onboarding');
          setIsAuthReady(true);
        }
      }
    };

    const unsubscribe = auth().onAuthStateChanged(initializeApp);
    return () => {
      isMounted = false;
      unsubscribe();
    };
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
    setEmailDraft('');
  };

  const openDashboard = async (userEnteredEmail?: string) => {
    try {
      // Force reload the Firebase user to pick up any newly linked providers
      const firebaseAuth = auth();
      if (firebaseAuth.currentUser) {
        await firebaseAuth.currentUser.reload();
      }

      const currentUser = getCurrentFirebaseUserSnapshot();
      const idToken = await getFreshFirebaseIdToken();

      const syncedSession = await syncTownPulseUser({
        idToken,
        firebaseUid: currentUser.uid,
        fallbackName: currentUser.displayName || 'TownPulse User',
        fallbackPhone: currentUser.phoneNumber,
        fallbackEmail: currentUser.email || userEnteredEmail,
        providerIds: currentUser.providerIds,
      });

      setDashboardSession(syncedSession);

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
      } catch (fcmErr) { }

      startTransition(() => setScreen('dashboard'));
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('400') || msg.includes('already linked')) {
        setErrorMessage("This phone number is already linked to another account. Please sign in with Google.");
      } else {
        setErrorMessage(`Unable to sync profile: ${msg || 'Unknown error'}`);
      }
    }
  };

  const startOtpFlow = async (rawPhoneNumber: string, mode: OtpMode) => {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const sanitizedPhone = sanitizeIndianPhoneInput(rawPhoneNumber);
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
      if (otpSession.mode === 'google-link') {
        await confirmPhoneLinkOtp(otpSession.confirmation, otpCode);
      } else {
        await confirmOtpCode(otpSession.confirmation, otpCode);
      }

      await openDashboard(emailDraft);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Invalid OTP. Please retry.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpSession) return;
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
      case 'splash':
        return 'Starting up';
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
        return 'Sign in';
    }
  }, [otpSession?.mode, screen]);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar
          barStyle={screen === 'dashboard' ? 'dark-content' : 'light-content'}
          backgroundColor={screen === 'dashboard' ? '#FFFFFF' : '#F5C116'}
        />

        {screen === 'splash' && (
          <SplashScreen
            isReadyToTransition={isAuthReady && initialScreen !== null}
            onAnimationComplete={() => {
              if (initialScreen) {
                startTransition(() => setScreen(initialScreen));
              }
            }}
          />
        )}

        {screen === 'onboarding' && (
          <OnboardingScreen
            onComplete={() => startTransition(() => setScreen('landing'))}
          />
        )}

        {(screen === 'landing' || screen === 'phone-entry' || screen === 'verify-google-phone' || screen === 'otp') && (
          <AuthUnifiedScreen
            isBusy={isBusy}
            errorMessage={errorMessage}
            otpSent={!!otpSession || screen === 'otp'}
        isGoogleLinked={screen === 'verify-google-phone' || (screen === 'otp' && otpSession?.mode === 'google-link')}
            onSendOtp={(phone) => startOtpFlow(phone, phoneEntryMode)}
            onVerifyOtp={async (code, email) => {
              if (!otpSession?.confirmation) return;
              setIsBusy(true);
              setErrorMessage(null);
              try {
                const phoneCredential = auth.PhoneAuthProvider.credential(otpSession.confirmation.verificationId, code);
                await auth().signInWithCredential(phoneCredential);

                // Pass the user-entered email directly to openDashboard.
                // openDashboard passes it as fallbackEmail to syncTownPulseUser,
                // which sends it in the complete-profile body for new users.
                await openDashboard(email || undefined);
              } catch (error: any) {
                setErrorMessage(error.message || 'Invalid OTP');
              } finally {
                setIsBusy(false);
              }
            }}
            onGoogleSignIn={handleGooglePress}
            phoneDraft={phoneDraft}
            onChangePhone={(value) => {
              setPhoneDraft(value);
              if (errorMessage) setErrorMessage(null);
            }}
            otpDraft={otpCode}
            onChangeOtp={(value) => {
              setOtpCode(value);
              if (errorMessage) setErrorMessage(null);
            }}
            emailDraft={emailDraft}
            onChangeEmail={(value) => {
              setEmailDraft(value);
              if (errorMessage) setErrorMessage(null);
            }}
          />
        )}

        {screen === 'dashboard' && dashboardSession && (
          dashboardSession.user.role === 'restaurant_owner' ? (
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
          ) : (
            <UserDashboardScreen
              session={dashboardSession}
              onSignOut={handleSignOut}
              onSessionUpdate={setDashboardSession}
            />
          )
        )}
        {/* App Update Modal — shown on top of everything for all roles */}
        {showUpdateModal && updateStatus && (
          <AppUpdateModal
            visible={showUpdateModal}
            updateStatus={updateStatus}
            onSkip={dismissUpdate}
          />
        )}
      </ToastProvider>
    </SafeAreaProvider>
  );
}

export default App;
