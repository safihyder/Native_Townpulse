import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { appConfig } from '../config/appConfig';

// Hardcode current app version — bump this with each release
export const APP_VERSION = '1.0.0';
export const APP_PLATFORM = Platform.OS; // 'android' | 'ios'

export type UpdateStatus = {
  updateType: 'NONE' | 'WARNING' | 'MANDATORY';
  allowUsage: boolean;
  latestVersion: string;
  storeUrl: string | null;
  message: string;
  banner: {
    show: boolean;
    title: string;
    message: string;
    primaryAction: { type: string; label: string; url: string | null };
    secondaryAction: { type: string; label: string } | null;
    skipAllowed: boolean;
  } | null;
};

/**
 * Checks for app updates on mount and periodically (every 5 min).
 * Returns the update status for the modal to consume.
 */
export function useAppUpdateCheck() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkForUpdate = async () => {
    try {
      const res = await fetch(
        `${appConfig.apiBaseUrl}/api/system/update-status?platform=${APP_PLATFORM}&appVersion=${APP_VERSION}`
      );
      const json = await res.json();

      if (json.success && json.updateType && json.updateType !== 'NONE') {
        setUpdateStatus({
          updateType: json.updateType,
          allowUsage: json.allowUsage,
          latestVersion: json.latestVersion,
          storeUrl: json.storeUrl || null,
          message: json.message,
          banner: json.banner || null,
        });
        // If it's mandatory, always force-show (never allow dismissal)
        if (json.updateType === 'MANDATORY') {
          setDismissed(false);
        }
      } else {
        setUpdateStatus(null);
      }
    } catch {
      // Silently fail — don't block the app
    }
  };

  useEffect(() => {
    // Check on mount (with small delay so splash doesn't block)
    const timeout = setTimeout(checkForUpdate, 2000);

    // Re-check every 5 minutes
    intervalRef.current = setInterval(checkForUpdate, 5 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const dismiss = () => {
    if (updateStatus?.updateType !== 'MANDATORY') {
      setDismissed(true);
    }
  };

  const shouldShow =
    updateStatus !== null &&
    updateStatus.updateType !== 'NONE' &&
    (updateStatus.updateType === 'MANDATORY' || !dismissed);

  return { updateStatus, shouldShow, dismiss };
}
