/**
 * useRestaurantSocket.ts
 *
 * Uses socket.io-client to connect to the TownPulse backend.
 * The backend uses socket.io with Firebase auth token for authentication.
 *
 * Provides:
 *   statusMap         — Record<restaurantId, boolean>   live isOpen
 *   serverTime        — authoritative IST time from server
 *   connected         — boolean
 *   onNewOrder        — callback ref to set; called with { restaurantId, orderId, total }
 *   onRestaurantUpdate— callback ref to set; called with { restaurantId }
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { appConfig } from '../config/appConfig';
import { getFreshFirebaseIdToken } from '../services/firebaseAuth';

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

export function useRestaurantSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [serverTime, setServerTime] = useState<ServerTime | null>(null);

  const onNewOrder = useRef<((data: { restaurantId: string; orderId: string; total: number }) => void) | null>(null);
  const onRestaurantUpdate = useRef<((data: { restaurantId: string }) => void) | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function connect() {
      if (destroyed) return;

      let token: string | null = null;
      try {
        token = await getFreshFirebaseIdToken();
      } catch { /* will connect without auth */ }

      const socket = io(appConfig.apiBaseUrl, {
        transports: ['websocket', 'polling'],
        auth: token ? { token } : undefined,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 3000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (!destroyed) {
          console.log('[Socket.IO] Connected');
          setConnected(true);
        }
      });

      socket.on('disconnect', () => {
        if (!destroyed) {
          console.log('[Socket.IO] Disconnected');
          setConnected(false);
        }
      });

      socket.on('server_time', (data: ServerTime) => {
        if (!destroyed) setServerTime(data);
      });

      socket.on('status_update', (data: Array<{ restaurantId: string; isOpen: boolean }>) => {
        if (!destroyed) {
          setStatusMap(prev => {
            const next = { ...prev };
            for (const u of data) {
              next[u.restaurantId] = u.isOpen;
            }
            return next;
          });
        }
      });

      socket.on('new_order', (data: any) => {
        if (!destroyed) onNewOrder.current?.(data);
      });

      socket.on('restaurant_updated', (data: any) => {
        if (!destroyed) onRestaurantUpdate.current?.(data);
      });

      socket.on('connect_error', (err: Error) => {
        console.log('[Socket.IO] Connect error:', err.message);
      });
    }

    connect();

    return () => {
      destroyed = true;
      socketRef.current?.disconnect();
    };
  }, []);

  return { statusMap, serverTime, connected, onNewOrder, onRestaurantUpdate, socketRef };
}
