import notifee, { AndroidImportance, AndroidCategory, AndroidColor } from '@notifee/react-native';
import { appConfig } from '../config/appConfig';

/**
 * Stores the previously seen order IDs over the lifetime
 * of the background execution so we only alert exactly once 
 * per newly seen PLACED order.
 */
let knownPlacedOrderIds = new Set<string>();
let currentToken: string | null = null;
let isPollerRunning = false;
let stopPollerFlag = false;
let fgNotificationId = 'townpulse_fgs';

const fetchActiveOrders = async (token: string) => {
    try {
        const response = await fetch(`${appConfig.apiBaseUrl}/api/orders/restaurant/active`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return null;
        const json = await response.json();
        return json.orders || [];
    } catch {
        return null; // Network blip
    }
};

/**
 * Register the Notifee Foreground Service task.
 * This runs infinitely until `stopBackgroundPoller` is called.
 */
notifee.registerForegroundService((notification) => {
    return new Promise(async (resolve) => {
        while (!stopPollerFlag) {
            if (currentToken) {
                const incomingOrders = await fetchActiveOrders(currentToken);
                if (incomingOrders) {
                    const currentPlaced = incomingOrders.filter((o: any) => o.status === 'PLACED');
                    const newUnseenOrders = currentPlaced.filter((o: any) => !knownPlacedOrderIds.has(o.orderId));

                    if (newUnseenOrders.length > 0) {
                        try {
                            const alarmChannelId = await notifee.createChannel({
                                id: 'townpulse_orders_bg',
                                name: 'New Orders (Background)',
                                importance: AndroidImportance.HIGH,
                                sound: 'default',
                                vibration: true,
                            });

                            await notifee.displayNotification({
                                title: '🟢 New Order Received!',
                                body: `Order ${newUnseenOrders[0].orderId} is waiting. Please accept it now.`,
                                android: {
                                    channelId: alarmChannelId,
                                    importance: AndroidImportance.HIGH,
                                    category: AndroidCategory.ALARM,
                                    pressAction: { id: 'default' },
                                },
                            });
                        } catch (e) {
                            console.error('Notifee Alarm Error:', e);
                        }
                    }

                    // Update known IDs
                    knownPlacedOrderIds = new Set(currentPlaced.map((o: any) => o.orderId));
                }
            }
            
            // Sleep for 15 seconds
            await new Promise<void>(res => setTimeout(() => res(), 15000));
        }
        
        // When flag is set to true, break the loop and resolve to kill the service cleanly
        resolve();
    });
});

export const startBackgroundPoller = async (token: string) => {
    currentToken = token;
    
    if (isPollerRunning) return;
    
    try {
        await notifee.requestPermission();
        
        const channelId = await notifee.createChannel({
            id: 'townpulse_persist',
            name: 'TownPulse Background Sync',
            importance: AndroidImportance.MIN,
        });

        stopPollerFlag = false;

        // Boot the Foreground Service natively (Android 14+ compatible via Notifee)
        notifee.displayNotification({
            id: fgNotificationId,
            title: 'TownPulse Kitchen',
            body: 'Listening for incoming orders securely...',
            android: {
                channelId,
                asForegroundService: true,
                color: AndroidColor.RED,
                colorized: true,
            },
        });

        isPollerRunning = true;
    } catch (e) {
        console.error("Could not start Notifee background poller.", e);
    }
};

export const stopBackgroundPoller = async () => {
    currentToken = null;
    if (isPollerRunning) {
        stopPollerFlag = true;
        await notifee.stopForegroundService();
        await notifee.cancelNotification(fgNotificationId);
        isPollerRunning = false;
        knownPlacedOrderIds.clear();
    }
};
