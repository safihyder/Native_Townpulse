import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

/**
 * Requests notification permission from the user.
 * On Android 13+ (API 33), this triggers the system permission dialog.
 * On older Android versions, permissions are granted at install time.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Enable Notifications',
          message:
            'TownPulse needs notification access to alert you about new orders, delivery updates, and important messages.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        },
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Notification permission denied by user');
        return false;
      }
    }

    const authStatus = await messaging().requestPermission();
    const isAuthorized =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (isAuthorized) {
      console.log('Notification permission granted');
    }

    return isAuthorized;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Sets up foreground message handling.
 * When a FCM message arrives while the app is in the foreground,
 * FCM suppresses the system notification — we use Notifee to
 * manually show it with HIGH priority and loud sound.
 */
export function setupForegroundNotificationHandler() {
  return messaging().onMessage(async remoteMessage => {
    console.log('Foreground FCM received:', remoteMessage);

    const title = String(remoteMessage.notification?.title || remoteMessage.data?.title || '🟢 New Order!');
    const body = String(remoteMessage.notification?.body || remoteMessage.data?.body || 'A new order is waiting.');

    try {
      const channelId = await notifee.createChannel({
        id: 'townpulse_orders_bg',
        name: 'New Orders',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });

      await notifee.displayNotification({
        title,
        body,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.ALARM,
          pressAction: { id: 'default' },
        },
      });
    } catch (e) {
      console.error('Notifee foreground display error:', e);
    }
  });
}

/**
 * Gets the FCM token for this device.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
}
