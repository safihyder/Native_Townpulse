import {
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  linkWithCredential,
  signOut,
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { appConfig } from '../config/appConfig';

// This type handles both standard and linking flows
export type PhoneConfirmation = FirebaseAuthTypes.ConfirmationResult;

export type FirebaseSnapshot = {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  providerIds: string[];
};

let googleConfigured = false;

function ensureGoogleConfigured() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: appConfig.googleWebClientId,
  });
  googleConfigured = true;
}

function getCurrentUserOrThrow() {
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error('No Firebase user is active.');
  }
  return currentUser;
}

// ---------------------------------------------------------
// GOOGLE SIGN-IN
// ---------------------------------------------------------

export async function signInWithGoogle(): Promise<FirebaseSnapshot> {
  ensureGoogleConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Clear any stale session to prevent "missing initial state" browser redirect errors
  try { await GoogleSignin.signOut(); } catch { /* no active session, ignore */ }

  const googleResponse: any = await GoogleSignin.signIn();
  const googleIdToken = googleResponse?.data?.idToken ?? googleResponse?.idToken;

  if (!googleIdToken) {
    throw new Error('Google ID token missing. Check Firebase console.');
  }

  const googleCredential = GoogleAuthProvider.credential(googleIdToken);
  
  // Use Modular signInWithCredential
  await signInWithCredential(getAuth(), googleCredential);

  return getCurrentFirebaseUserSnapshot();
}

// ---------------------------------------------------------
// PHONE FLOWS (SIGN-IN & LINKING)
// ---------------------------------------------------------

/**
 * Used for standard Phone-Only login OR the first step of Linking.
 * In React Native Firebase, this is the most reliable way to get 
 * a ConfirmationResult for the OTP.
 */
export async function triggerPhoneOtp(
  phoneNumber: string,
): Promise<PhoneConfirmation> {
  return signInWithPhoneNumber(getAuth(), phoneNumber);
}

/**
 * Standard Phone Sign-in (Step 2)
 */
export async function confirmOtpCode(
  confirmation: PhoneConfirmation,
  otpCode: string,
): Promise<FirebaseSnapshot> {
  await confirmation.confirm(otpCode);
  return getCurrentFirebaseUserSnapshot();
}

/**
 * Native Phone Linking (Step 2)
 * This glues the phone number to the existing Google account UID.
 */
export async function confirmPhoneLinkOtp(
  confirmation: PhoneConfirmation,
  otpCode: string,
): Promise<FirebaseSnapshot> {
  const currentUser = getCurrentUserOrThrow();

  // 1. Create the credential using the verificationId from the OTP request
  const credential = PhoneAuthProvider.credential(
    confirmation.verificationId,
    otpCode,
  );

  // 2. Attach it to the current user (the Google account)
  // This prevents the creation of a second UID.
  await linkWithCredential(currentUser, credential);

  return getCurrentFirebaseUserSnapshot();
}

// ---------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------

export function getCurrentFirebaseUserSnapshot(): FirebaseSnapshot {
  const currentUser = getCurrentUserOrThrow();
  return {
    uid: currentUser.uid,
    displayName: currentUser.displayName,
    email: currentUser.email,
    phoneNumber: currentUser.phoneNumber,
    providerIds: currentUser.providerData
      .map(p => p.providerId)
      .filter(Boolean) as string[],
  };
}

export async function getFreshFirebaseIdToken(): Promise<string> {
  const currentUser = getCurrentUserOrThrow();
  // ✅ This is the modular way:
  return getIdToken(currentUser, true); 
}

export async function signOutEverywhere(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // No Google session active
  }
  await signOut(getAuth());
}