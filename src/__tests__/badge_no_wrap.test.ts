import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Badge Single-Line & No-Wrap Guard Suite', () => {
  it('ensures Badge component enforces numberOfLines={1} and flexShrink: 0', () => {
    const badgePath = path.resolve('src/components/ui/Badge.tsx');
    const badgeContent = fs.readFileSync(badgePath, 'utf8');

    assert.ok(
      badgeContent.includes('numberOfLines={1}'),
      'Badge component must enforce numberOfLines={1} on Text to prevent word breaking'
    );
    assert.ok(
      badgeContent.includes('flexShrink: 0'),
      'Badge component must enforce flexShrink: 0 to prevent shrinking in flex rows'
    );
  });

  it('ensures Manager team sellers page applies flexShrink: 0 on status badge and numberOfLines={1} on info', () => {
    const sellersPath = path.resolve('src/app/(manager)/sellers/index.tsx');
    const sellersContent = fs.readFileSync(sellersPath, 'utf8');

    assert.ok(
      sellersContent.includes('numberOfLines={1}'),
      'Manager team seller name and email must have numberOfLines={1}'
    );
    assert.ok(
      sellersContent.includes('statusBadge'),
      'Manager team sellers must apply statusBadge style to Badge'
    );
    assert.ok(
      sellersContent.includes('flexShrink: 0'),
      'Manager team styles must include flexShrink: 0 for statusBadge'
    );
  });
});
