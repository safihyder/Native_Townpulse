## TownPulse Mobile Auth

This folder contains the frontend-only React Native auth app for TownPulse.

Implemented in this app:

- `Continue with Google`
- `Continue with phone`
- Firebase OTP for phone sign-in
- Mandatory phone verification after Google sign-in
- Backend sync using the existing TownPulse auth endpoints
- Placeholder post-login screen titled `Test Dashboard`

## Important note about backend compatibility

The backend was left untouched on purpose.

Because the current backend still expects a profile-completion style flow, the mobile app temporarily syncs new users by calling:

- `POST /api/auth/check`
- `POST /api/auth/complete-profile`

For first-time users, the app sends:

- fallback name: `TownPulse User` if Firebase has no display name
- fallback address: `{ "city": "Pending" }`

That keeps the current backend happy without changing backend code.

## Setup

1. Install dependencies:

```bash
cd apps/townpulse-mobile-auth
npm install
```

2. Add Firebase files:

- Android: place `google-services.json` in `android/app/`
- iOS: place `GoogleService-Info.plist` in `ios/`

3. Update `src/config/appConfig.ts`:

- `apiBaseUrl`
- `googleWebClientId`

4. Enable these providers in Firebase Console:

- Phone Authentication
- Google Sign-In

5. Android only:

- add SHA-1 / SHA-256 fingerprints in Firebase

6. iOS only:

- run CocoaPods after `npm install`

```bash
bundle install
bundle exec pod install
```

## Run

```bash
npm start
npm run android
```

`npm start` now starts both:

- the TownPulse backend from the repo root
- the React Native Metro bundler from this app folder

or

```bash
npm run ios
```

## App flow

1. User lands on the TownPulse auth screen.
2. User selects Google or phone.
3. Firebase completes auth.
4. If Google account has no phone number, app forces number verification.
5. App fetches Firebase ID token.
6. App syncs with the current backend.
7. App opens `Test Dashboard`.
