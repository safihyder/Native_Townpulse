/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

/**
 * FCM Background Message Handler
 * This runs even when the app is completely CLOSED/KILLED.
 * Android calls this headless JS task when an FCM message arrives.
 */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  const title = remoteMessage.notification?.title || remoteMessage.data?.title || '🟢 New Order!';
  const body = remoteMessage.notification?.body || remoteMessage.data?.body || 'A new order has arrived. Please accept it!';

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
});

AppRegistry.registerComponent(appName, () => App);
