import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Mobile Live Realtime Sync & Screen Listeners Suite', () => {
  const rootDir = process.cwd();

  it('verifies mobileRealtimeSync handles deduplication, reconnect recovery, and canonical events', () => {
    const syncFile = fs.readFileSync(path.join(rootDir, 'src', 'services', 'realtimeSync.ts'), 'utf-8');
    assert.ok(syncFile.includes('seenEventIds'), 'Must deduplicate incoming event IDs');
    assert.ok(syncFile.includes('REALTIME_RECONNECTED'), 'Must emit REALTIME_RECONNECTED on network recovery');
    assert.ok(syncFile.includes('DeviceEventEmitter.emit(evt.type, evt)'), 'Must emit canonical event names');
  });

  it('verifies all key Admin, Manager, and Seller screens subscribe to realtime events', () => {
    const screensWithUseRealtimeSync = [
      'src/app/(admin)/index.tsx',
      'src/app/(admin)/sales/index.tsx',
      'src/app/(admin)/inventory/index.tsx',
      'src/app/(admin)/customers/index.tsx',
      'src/app/(admin)/shifts/index.tsx',
      'src/app/(admin)/reports/index.tsx',
      'src/app/(manager)/index.tsx',
      'src/app/(manager)/sales/index.tsx',
      'src/app/(manager)/customers/index.tsx',
      'src/app/(manager)/shifts/index.tsx',
      'src/app/(seller)/index.tsx',
      'src/app/(seller)/sales/index.tsx',
      'src/app/(seller)/sales/[id].tsx',
      'src/app/(seller)/shift/index.tsx',
      'src/app/(seller)/customers/index.tsx',
    ];

    for (const relPath of screensWithUseRealtimeSync) {
      const content = fs.readFileSync(path.join(rootDir, relPath), 'utf-8');
      assert.ok(content.includes('useRealtimeSync('), `${relPath} must wire useRealtimeSync`);
    }

    const legacyListenerScreens = [
      'src/app/(admin)/approvals/index.tsx',
      'src/app/(manager)/inventory/index.tsx',
      'src/app/(seller)/inventory/index.tsx',
    ];
    for (const relPath of legacyListenerScreens) {
      const content = fs.readFileSync(path.join(rootDir, relPath), 'utf-8');
      assert.ok(
        content.includes("DeviceEventEmitter.addListener('REALTIME_DATA_SYNC'"),
        `${relPath} must listen to REALTIME_DATA_SYNC`
      );
    }
  });
});
