import { appConfig } from '../config/appConfig';

type UserAddress = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
};

type CheckUserResponse = {
  success: boolean;
  uid?: string;
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  address?: UserAddress;
  isNewUser?: boolean;
  message?: string;
};

type CompleteProfileResponse = {
  success: boolean;
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  address?: UserAddress;
  isNewUser?: boolean;
  message?: string;
};

export type SyncedTownPulseSession = {
  syncSource: 'check' | 'complete-profile';
  user: {
    id: string;
    firebaseUid: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    address?: UserAddress;
  };
  idToken: string;
  firebase: {
    uid: string;
    providerIds: string[];
  };
};

type SyncTownPulseUserArgs = {
  idToken: string;
  firebaseUid: string;
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  providerIds: string[];
};

async function postJson<TResponse>(
  path: string,
  idToken: string,
  body?: Record<string, unknown>,
): Promise<TResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  const parsed = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    const detailedError = parsed?.error ? ` (${parsed.error})` : '';
    throw new Error(
      (parsed?.message || `Backend request failed with status ${response.status}.`) + detailedError
    );
  }

  return parsed as TResponse;
}

function normalizeSession(args: {
  firebaseUid: string;
  providerIds: string[];
  payload: CheckUserResponse | CompleteProfileResponse;
  syncSource: 'check' | 'complete-profile';
  idToken: string;
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
}): SyncedTownPulseSession {
  const {
    fallbackEmail,
    fallbackName,
    fallbackPhone,
    firebaseUid,
    idToken,
    payload,
    providerIds,
    syncSource,
  } = args;

  return {
    syncSource,
    user: {
      id: payload._id || firebaseUid,
      firebaseUid,
      name: payload.name || fallbackName || 'TownPulse User',
      email: payload.email || fallbackEmail || '',
      phone: payload.phone || fallbackPhone || '',
      role: payload.role || 'user',
      address: (payload as any).address,
    },
    idToken,
    firebase: {
      uid: firebaseUid,
      providerIds,
    },
  };
}

export async function syncTownPulseUser({
  fallbackEmail,
  fallbackName,
  fallbackPhone,
  firebaseUid,
  idToken,
  providerIds,
}: SyncTownPulseUserArgs): Promise<SyncedTownPulseSession> {
  const checked = await postJson<CheckUserResponse>('/api/auth/check', idToken);

  if (checked.success && checked.isNewUser === false) {
    return normalizeSession({
      firebaseUid,
      providerIds,
      payload: checked,
      syncSource: 'check',
      idToken,
      fallbackName,
      fallbackPhone,
      fallbackEmail,
    });
  }

  const completed = await postJson<CompleteProfileResponse>(
    '/api/auth/complete-profile',
    idToken,
    {
      name: fallbackName?.trim() || 'TownPulse User',
      email: fallbackEmail || `${firebaseUid}@townpulse.local`,
      phone: fallbackPhone || '',
      address: {
        city: appConfig.placeholderAddressCity,
      },
    },
  );

  return normalizeSession({
    firebaseUid,
    providerIds,
    payload: completed,
    syncSource: 'complete-profile',
    idToken,
    fallbackName,
    fallbackPhone,
    fallbackEmail,
  });
}
