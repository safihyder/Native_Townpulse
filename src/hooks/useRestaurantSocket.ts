/**
 * useRestaurantSocket.ts
 *
 * Uses React Native's built-in WebSocket (no npm package) to connect to
 * the TownPulse backend at /ws.
 *
 * Provides:
 *   statusMap         — Record<restaurantId, boolean>   live isOpen
 *   serverTime        — authoritative IST time from server
 *   connected         — boolean
 *   onNewOrder        — callback ref to set; called with { restaurantId, orderId, total }
 *   onRestaurantUpdate— callback ref to set; called with { restaurantId }
 *
 * Usage:
 *   const { statusMap, onNewOrder, onRestaurantUpdate } = useRestaurantSocket();
 *   useEffect(() => { onNewOrder.current = (d) => refetchOrders(); }, []);
 *   useEffect(() => { onRestaurantUpdate.current = (d) => refetchRestaurant(); }, []);
 */

import { useEffect, useRef, useState } from 'react';
import { appConfig } from '../config/appConfig';

export interface ServerTime {
  hour: number;
  minute: number;
  totalMins: number;
  uiDayIdx: number;
  dateStr: string;
  isoStr: string;
}

export interface StatusMap {
  [restaurantId: string]: boolean;
}

// Convert http(s):// → ws(s)://
function toWsUrl(base: string): string {
  return base.replace(/^http/, 'ws') + '/ws';
}

export function useRestaurantSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [serverTime, setServerTime] = useState<ServerTime | null>(null);

  // Caller-settable callbacks — use refs so they don't recreate the effect
  const onNewOrder = useRef<((data: { restaurantId: string; orderId: string; total: number }) => void) | null>(null);
  const onRestaurantUpdate = useRef<((data: { restaurantId: string }) => void) | null>(null);

  useEffect(() => {
    const WS_URL = toWsUrl(appConfig.apiBaseUrl);
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!destroyed) {
          console.log('[WS] Connected to', WS_URL);
          setConnected(true);
        }
      };

      ws.onmessage = (event) => {
        if (destroyed) return;
        try {
          const msg = JSON.parse(event.data as string);
          switch (msg.type) {
            case 'server_time':
              setServerTime(msg.data);
              break;

            case 'status_update':
              setStatusMap(prev => {
                const next = { ...prev };
                for (const u of (msg.data as Array<{ restaurantId: string; isOpen: boolean }>)) {
                  next[u.restaurantId] = u.isOpen;
                }
                return next;
              });
              break;

            case 'new_order':
              onNewOrder.current?.(msg.data);
              break;

            case 'restaurant_updated':
              onRestaurantUpdate.current?.(msg.data);
              break;
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => { /* handled by onclose */ };

      ws.onclose = () => {
        setConnected(false);
        if (!destroyed) {
          // Auto-reconnect after 5 s
          retryTimer.current = setTimeout(connect, 5000);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { statusMap, serverTime, connected, onNewOrder, onRestaurantUpdate };
}
