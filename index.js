// Polyfill / fallback for globalThis.expo before expo-router and expo-modules-core load
// This prevents "[runtime not ready]: TypeError: Cannot read property 'EventEmitter' of undefined"
// when the JS runtime boots before or independently of native TurboModule registration.
if (typeof globalThis !== 'undefined') {
  class FallbackEventEmitter {
    listeners = new Map();
    addListener(eventName, listener) {
      if (!this.listeners.has(eventName)) {
        this.listeners.set(eventName, new Set());
      }
      this.listeners.get(eventName).add(listener);
      return {
        remove: () => {
          this.listeners.get(eventName)?.delete(listener);
        },
      };
    }
    removeListener(eventName, listener) {
      this.listeners.get(eventName)?.delete(listener);
    }
    removeAllListeners(eventName) {
      if (eventName) {
        this.listeners.delete(eventName);
      } else {
        this.listeners.clear();
      }
    }
    emit(eventName, ...args) {
      const list = this.listeners.get(eventName);
      if (list) {
        list.forEach((cb) => {
          try {
            cb(...args);
          } catch (err) {
            console.error(err);
          }
        });
      }
    }
    listenerCount(eventName) {
      return this.listeners.get(eventName)?.size ?? 0;
    }
  }

  if (!globalThis.expo) {
    globalThis.expo = {
      EventEmitter: FallbackEventEmitter,
      modules: {},
    };
  } else if (!globalThis.expo.EventEmitter) {
    globalThis.expo.EventEmitter = FallbackEventEmitter;
  }
}

import 'expo-router/entry';

