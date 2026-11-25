import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import type { RealtimeEventPayload, RealtimeEventType } from '@/services/realtimeSync';

/**
 * Subscribe cleanly to one or more centralized real-time sync events (plus reconnect recovery).
 * Coalesces rapid bursts within 300ms to prevent redundant API reloads.
 */
export function useRealtimeSync(
  eventTypes: RealtimeEventType[],
  onSync: (event?: RealtimeEventPayload) => void,
  debounceMs = 300
): void {
  const callbackRef = useRef(onSync);
  callbackRef.current = onSync;

  const eventKey = eventTypes.join('|');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSync = (evt?: RealtimeEventPayload) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        callbackRef.current(evt);
      }, debounceMs);
    };

    const subs = [
      ...eventTypes.map((type) =>
        DeviceEventEmitter.addListener(type, (evt: RealtimeEventPayload) => scheduleSync(evt))
      ),
      DeviceEventEmitter.addListener('REALTIME_RECONNECTED', () => scheduleSync()),
    ];

    return () => {
      if (timer) clearTimeout(timer);
      subs.forEach((s) => s.remove());
    };
  }, [eventKey, debounceMs]);
}
