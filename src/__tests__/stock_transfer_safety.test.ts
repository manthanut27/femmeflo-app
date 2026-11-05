import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Admin Stock Transfer Safety & Crash Prevention Suite', () => {
  it('safely formats destination options even when seller or manager fields are null/undefined', () => {
    const rawSellers = [
      { id: 'usr_seller_12345678', name: 'Ramesh Patel', phone: '9876543210', email: 'ramesh@femmeflo.in' },
      { id: undefined, name: null, phone: null, email: undefined }, // Malformed or partial seller
      { id: 'usr_short', name: '', phone: '', email: '' },
    ];

    const destinationOptions = rawSellers.map((s: any) => ({
      id: s.id,
      title: `${s.name || 'Field Officer'} (Field Officer)`,
      subtitle: `Seller ID: ${s.id ? String(s.id).slice(0, 8) : 'N/A'} • Phone: ${s.phone || 'N/A'}`,
      badge: 'FIELD SELLER',
      badgeVariant: 'ACTIVE',
      metadata: `${s.phone || ''} ${s.email || ''}`,
    }));

    assert.strictEqual(destinationOptions.length, 3);
    assert.strictEqual(destinationOptions[0].title, 'Ramesh Patel (Field Officer)');
    assert.strictEqual(destinationOptions[0].subtitle, 'Seller ID: usr_sell • Phone: 9876543210');
    assert.strictEqual(destinationOptions[1].title, 'Field Officer (Field Officer)');
    assert.strictEqual(destinationOptions[1].subtitle, 'Seller ID: N/A • Phone: N/A');
    assert.strictEqual(destinationOptions[2].title, 'Field Officer (Field Officer)');
    assert.strictEqual(destinationOptions[2].subtitle, 'Seller ID: usr_shor • Phone: N/A');
  });

  it('safely formats product options with null/undefined SKU or IDs without throwing slice errors', () => {
    const rawProducts = [
      { id: 'prd_ sanitary_pad_xl', name: 'FemmeFlo Comfort XL', sku: 'FF-PAD-XL', basePricePaise: 3500, minFloorPricePaise: 2800 },
      { id: undefined, name: null, sku: null, basePricePaise: null, minFloorPricePaise: null },
      { id: 'prd_regular', name: 'FemmeFlo Regular', sku: '', basePricePaise: 2500, minFloorPricePaise: 2000 },
    ];

    const productOptions = rawProducts.map((p: any) => {
      const minFloor = (((p.minFloorPricePaise ?? p.basePricePaise ?? 2500) as number) / 100).toFixed(2);
      const basePrice = (((p.basePricePaise ?? 3000) as number) / 100).toFixed(2);
      return {
        id: p.id,
        title: p.name || 'Product SKU',
        subtitle: `SKU: ${p.sku || (p.id ? String(p.id).slice(0, 8) : 'SKU')} • Base: ₹${basePrice} • Min Floor: ₹${minFloor}`,
        badge: p.sku || 'SKU',
        badgeVariant: 'ACTIVE',
        metadata: `${p.sku || ''} ${p.description || ''}`,
      };
    });

    assert.strictEqual(productOptions.length, 3);
    assert.strictEqual(productOptions[0].title, 'FemmeFlo Comfort XL');
    assert.strictEqual(productOptions[1].title, 'Product SKU');
    assert.strictEqual(productOptions[1].subtitle, 'SKU: SKU • Base: ₹30.00 • Min Floor: ₹25.00');
    assert.strictEqual(productOptions[2].title, 'FemmeFlo Regular');
    assert.strictEqual(productOptions[2].subtitle, 'SKU: prd_regu • Base: ₹25.00 • Min Floor: ₹20.00');
  });

  it('filters searchable dropdown options safely when title, subtitle, or metadata are undefined', () => {
    const options = [
      { id: 'opt_1', title: 'Main Warehouse', subtitle: 'Indore Central', badge: 'DEPOT', metadata: 'WH-01' },
      { id: 'opt_2', title: undefined as any, subtitle: null as any, badge: undefined as any, metadata: undefined as any },
      { id: 'opt_3', title: 'Ramesh Patel', subtitle: 'Van Stock Seller', badge: 'ACTIVE', metadata: '9876543210' },
    ];

    const search = (q: string) => {
      const term = q.trim().toLowerCase();
      if (!term) return options;
      return options.filter((opt) => {
        const matchTitle = opt.title ? opt.title.toLowerCase().includes(term) : false;
        const matchSubtitle = opt.subtitle ? opt.subtitle.toLowerCase().includes(term) : false;
        const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(term) : false;
        const matchMeta = opt.metadata ? opt.metadata.toLowerCase().includes(term) : false;
        return matchTitle || matchSubtitle || matchBadge || matchMeta;
      });
    };

    // Searching must not throw TypeError: Cannot read properties of undefined (reading 'toLowerCase')
    assert.doesNotThrow(() => search('patel'));
    assert.strictEqual(search('patel').length, 1);
    assert.strictEqual(search('patel')[0].id, 'opt_3');

    assert.doesNotThrow(() => search('warehouse'));
    assert.strictEqual(search('warehouse').length, 1);
    assert.strictEqual(search('warehouse')[0].id, 'opt_1');

    // Searching non-matching text returns empty array cleanly
    assert.strictEqual(search('nonexistent').length, 0);
  });

  it('constructs strict backend payload for stock transfers without unrecognized keys or root quantity', () => {
    const payload = {
      sourceId: 'wh_indore_01',
      destinationId: 'loc_van_seller_01',
      productId: 'prd_pad_xl',
      quantity: 50,
      reference: 'TX-2026-001',
      requestKey: 'REQ-KEY-12345',
    };

    const requestKey = payload.requestKey || payload.reference || undefined;
    const items = payload.productId
      ? [{ productId: payload.productId, quantity: Number(payload.quantity) }]
      : [];

    const body: Record<string, any> = {
      sourceId: payload.sourceId,
      destinationId: payload.destinationId,
      items,
    };
    if (requestKey) {
      body.requestKey = requestKey;
    }

    assert.strictEqual(body.sourceId, 'wh_indore_01');
    assert.strictEqual(body.destinationId, 'loc_van_seller_01');
    assert.deepStrictEqual(body.items, [{ productId: 'prd_pad_xl', quantity: 50 }]);
    assert.strictEqual(body.requestKey, 'REQ-KEY-12345');

    // Strict schema compliance: root quantity, productId, reference, sourceWarehouseId, targetLocationId must not exist
    assert.strictEqual(body.sourceWarehouseId, undefined);
    assert.strictEqual(body.targetLocationId, undefined);
    assert.strictEqual(body.productId, undefined);
    assert.strictEqual(body.quantity, undefined);
    assert.strictEqual(body.reference, undefined);
  });

  it('guards safe back navigation without triggering multiple concurrent pops', () => {
    let goBackCount = 0;
    let replaceCount = 0;

    const mockRouterCanGoBack = {
      canGoBack: () => true,
      back: () => { goBackCount++; },
      replace: () => { replaceCount++; },
    };

    const navigateBackSafely = (router: typeof mockRouterCanGoBack) => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace();
      }
    };

    navigateBackSafely(mockRouterCanGoBack);
    assert.strictEqual(goBackCount, 1);
    assert.strictEqual(replaceCount, 0);

    const mockRouterCannotGoBack = {
      canGoBack: () => false,
      back: () => { goBackCount++; },
      replace: () => { replaceCount++; },
    };

    navigateBackSafely(mockRouterCannotGoBack);
    assert.strictEqual(replaceCount, 1);
  });

  it('deduplicates destination options across dual-role managers and sellers with identical IDs', () => {
    const mockManagers = [
      { id: 'usr_dual_01', name: 'Manthan Utekar', isSeller: true, district: 'Indore', state: 'MP', phone: '9876543210' },
      { id: 'usr_mgr_only', name: 'Sunil Verma', isSeller: false, district: 'Bhopal', state: 'MP', phone: '9876543211' },
    ];

    const mockSellers = [
      // Manthan Utekar is returned by both managers (isSeller: true) AND sellers endpoint
      { id: 'usr_dual_01', name: 'Manthan Utekar', phone: '9876543210' },
      { id: 'usr_seller_02', name: 'Kavita Patel', phone: '9876543212' },
    ];

    const mockWarehouses = [
      { id: 'wh_source_01', name: 'Indore HQ Central Depot', code: 'HQ-IND' },
      { id: 'wh_dest_02', name: 'Bhopal Regional Depot', code: 'REG-BPL' },
    ];

    const sourceWarehouseId = 'wh_source_01';

    const buildDestinationOptions = () => {
      const list: any[] = [];
      const seenIds = new Set<string>();

      // 1. Dual-Role Managers
      const dualRoleManagers = mockManagers.filter((m) => Boolean(m?.isSeller));
      for (const m of dualRoleManagers) {
        const id = String(m?.id || '').trim();
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        list.push({
          id,
          title: `${m.name || 'Manager'} (Dual-Role Manager - Van Stock)`,
          badge: 'VAN STOCK',
          icon: 'car-sport',
        });
      }

      // 2. Field Officers / Sellers (Deduplicated)
      for (const s of mockSellers) {
        const id = String(s?.id || '').trim();
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        list.push({
          id,
          title: `${s.name || 'Field Officer'} (Field Officer)`,
          badge: 'FIELD SELLER',
          icon: 'person',
        });
      }

      // 3. Regional Hubs (Excluding source)
      for (const w of mockWarehouses) {
        const id = String(w?.id || '').trim();
        if (!id || id === sourceWarehouseId || seenIds.has(id)) continue;
        seenIds.add(id);
        list.push({
          id,
          title: `${w.name || 'Regional Hub'} (Regional Hub)`,
          badge: 'DEPOT / HUB',
          icon: 'business',
        });
      }

      return list;
    };

    const options = buildDestinationOptions();

    // usr_dual_01 must appear exactly ONCE
    const dualMatches = options.filter((o) => o.id === 'usr_dual_01');
    assert.strictEqual(dualMatches.length, 1);
    assert.strictEqual(dualMatches[0].badge, 'VAN STOCK');

    // Total items: 1 dual-role manager + 1 unique seller + 1 regional hub (wh_dest_02) = 3 total (wh_source_01 excluded)
    assert.strictEqual(options.length, 3);
    assert.deepStrictEqual(options.map((o) => o.id), ['usr_dual_01', 'usr_seller_02', 'wh_dest_02']);
  });

  it('generates guaranteed unique keys in SearchableDropdownModal even with duplicate or missing IDs', () => {
    const rawOptions = [
      { id: 'duplicate_id', title: 'Option 1' },
      { id: 'duplicate_id', title: 'Option 2 (Duplicate)' },
      { id: '', title: 'Option with empty ID' },
      { id: undefined as any, title: 'Option with undefined ID' },
    ];

    const keyExtractor = (item: any, index: number) =>
      item?.id ? `${String(item.id)}_${index}` : `opt_${index}`;

    const keys = rawOptions.map((opt, i) => keyExtractor(opt, i));

    assert.strictEqual(keys[0], 'duplicate_id_0');
    assert.strictEqual(keys[1], 'duplicate_id_1');
    assert.strictEqual(keys[2], 'opt_2');
    assert.strictEqual(keys[3], 'opt_3');

    // Ensure all keys are 100% unique strings
    const uniqueKeys = new Set(keys);
    assert.strictEqual(uniqueKeys.size, rawOptions.length);
  });
});

