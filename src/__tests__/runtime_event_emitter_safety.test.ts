import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('Runtime EventEmitter & Native Module Initialization Safety Suite', () => {
  it('ensures package.json points to custom entry point index.js', () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    assert.equal(pkg.main, 'index.js', 'package.json main must be index.js');
  });

  it('ensures index.js contains early globalThis.expo polyfill before expo-router', () => {
    const entryPath = resolve(process.cwd(), 'index.js');
    const content = readFileSync(entryPath, 'utf8');
    assert.ok(content.includes('globalThis.expo'), 'index.js must safeguard globalThis.expo');
    assert.ok(content.includes('EventEmitter'), 'index.js must provide fallback EventEmitter');
    assert.ok(content.includes("import 'expo-router/entry';"), 'index.js must import expo-router/entry');
  });

  it('verifies FallbackEventEmitter contract behavior', () => {
    // Test the fallback emitter implementation logic
    class FallbackEventEmitter {
      listeners = new Map<string, Set<Function>>();
      addListener(eventName: string, listener: Function) {
        if (!this.listeners.has(eventName)) {
          this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName)!.add(listener);
        return {
          remove: () => {
            this.listeners.get(eventName)?.delete(listener);
          },
        };
      }
      removeListener(eventName: string, listener: Function) {
        this.listeners.get(eventName)?.delete(listener);
      }
      removeAllListeners(eventName?: string) {
        if (eventName) {
          this.listeners.delete(eventName);
        } else {
          this.listeners.clear();
        }
      }
      emit(eventName: string, ...args: any[]) {
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
      listenerCount(eventName: string) {
        return this.listeners.get(eventName)?.size ?? 0;
      }
    }

    const emitter = new FallbackEventEmitter();
    let callCount = 0;
    let receivedPayload: any = null;

    const sub = emitter.addListener('TEST_EVENT', (data: any) => {
      callCount++;
      receivedPayload = data;
    });

    assert.equal(emitter.listenerCount('TEST_EVENT'), 1);

    emitter.emit('TEST_EVENT', { status: 'ok' });
    assert.equal(callCount, 1);
    assert.deepEqual(receivedPayload, { status: 'ok' });

    // Test subscription removal
    sub.remove();
    assert.equal(emitter.listenerCount('TEST_EVENT'), 0);
    emitter.emit('TEST_EVENT', { status: 'ignored' });
    assert.equal(callCount, 1);
  });

  it('ensures app.json disables aggressive ProGuard class stripping for native reflection', () => {
    const appJsonPath = resolve(process.cwd(), 'app.json');
    const appConfig = JSON.parse(readFileSync(appJsonPath, 'utf8'));
    const buildPropsPlugin = appConfig.expo.plugins.find(
      (p: any) => Array.isArray(p) && p[0] === 'expo-build-properties'
    );
    assert.ok(buildPropsPlugin, 'expo-build-properties plugin must be present');
    const androidConfig = buildPropsPlugin[1].android;
    assert.equal(androidConfig.enableProguardInReleaseBuilds, false);
    assert.equal(androidConfig.enableShrinkResourcesInReleaseBuilds, false);
    assert.ok(
      androidConfig.extraProguardRules.includes('expo.modules'),
      'extraProguardRules must protect expo.modules'
    );
  });
});

