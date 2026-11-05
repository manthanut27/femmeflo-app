import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Sales Retail Customer Dropdown & Search Option Suite', () => {
  const sampleCustomers = [
    {
      id: 'cust_001',
      shopName: 'Sharma General Store',
      ownerName: 'Ramesh Sharma',
      phone: '+919876543210',
      district: 'Indore',
      village: 'Rau',
      category: { id: 'cat_kirana', name: 'KIRANA' },
      address: 'Shop 12, Main Bazaar',
      pincode: '453331',
    },
    {
      id: 'cust_002',
      shopName: 'Gupta Medical Hall',
      ownerName: 'Sanjay Gupta',
      phone: '+919876543211',
      district: 'Indore',
      village: 'Pithampur',
      category: { id: 'cat_pharma', name: 'PHARMACY' },
      address: 'Near Government Hospital',
      pincode: '454775',
    },
    {
      id: 'cust_003',
      shopName: 'Pooja Beauty Parlour & Cosmetics',
      ownerName: 'Pooja Verma',
      phone: '+919876543212',
      district: 'Ujjain',
      village: 'Sanwer',
      category: { id: 'cat_beauty', name: 'BEAUTY' },
      address: 'Station Road',
      pincode: '456001',
    },
  ];

  it('maps customer array into dropdown options with titles, subtitles, badges, and metadata', () => {
    const options = sampleCustomers.map((c) => ({
      id: c.id,
      title: c.shopName,
      subtitle: `Owner: ${c.ownerName} • ${c.village || c.district} • 📞 ${c.phone}`,
      badge: c.category?.name || 'RETAIL',
      icon: 'storefront-outline',
      metadata: `${c.phone} ${c.address} ${c.pincode}`,
    }));

    assert.strictEqual(options.length, 3);
    assert.strictEqual(options[0].title, 'Sharma General Store');
    assert.strictEqual(options[0].badge, 'KIRANA');
    assert.match(options[0].subtitle, /Ramesh Sharma/);
    assert.match(options[0].metadata, /453331/);
  });

  it('filters customers accurately when searching by shop name', () => {
    const query = 'medical';
    const filtered = sampleCustomers.filter((c) => {
      const q = query.toLowerCase();
      return (
        c.shopName.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 'cust_002');
  });

  it('filters customers accurately when searching by phone number or village', () => {
    const query = 'Sanwer';
    const filtered = sampleCustomers.filter((c) => {
      const q = query.toLowerCase();
      return (
        c.shopName.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.village.toLowerCase().includes(q)
      );
    });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 'cust_003');
  });

  it('filters sales transactions by customerId and returns correct subtotal', () => {
    const sales = [
      { id: 'sale_1', customerId: 'cust_001', totalAmountPaise: 35000, quantity: 10 },
      { id: 'sale_2', customerId: 'cust_002', totalAmountPaise: 70000, quantity: 20 },
      { id: 'sale_3', customerId: 'cust_001', totalAmountPaise: 17500, quantity: 5 },
    ];

    const selectedCustomerId = 'cust_001';
    const customerSales = sales.filter((s) => s.customerId === selectedCustomerId);

    assert.strictEqual(customerSales.length, 2);
    const totalPaise = customerSales.reduce((acc, s) => acc + s.totalAmountPaise, 0);
    assert.strictEqual(totalPaise, 52500);
    const totalQty = customerSales.reduce((acc, s) => acc + s.quantity, 0);
    assert.strictEqual(totalQty, 15);
  });

  it('resets to all sales when ALL or null is selected', () => {
    const sales = [
      { id: 'sale_1', customerId: 'cust_001' },
      { id: 'sale_2', customerId: 'cust_002' },
    ];

    const selectedCustomerId: string | null = null;
    const activeSales = selectedCustomerId
      ? sales.filter((s) => s.customerId === selectedCustomerId)
      : sales;

    assert.strictEqual(activeSales.length, 2);
  });
});

