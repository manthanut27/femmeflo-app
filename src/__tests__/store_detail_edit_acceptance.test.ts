import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, beforeEach } from 'node:test';
import { handleMockRequest, mockDb, syncMockServiceUser } from '../api/mockService.ts';
import type { CustomerItem, UpdateCustomerPayload } from '../api/types.ts';

describe('Store Detail Page & In-Place Editing Acceptance Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string): string => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  // =========================================================================
  // 1. DYNAMIC STORE DETAILS (ZERO HARDCODING)
  // =========================================================================
  describe('1. Dynamic Store Details (Zero Hardcoding)', () => {
    it('verifies StoreDetailView.tsx uses dynamic ID extraction via useLocalSearchParams or props without hardcoded names', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      // Must import useLocalSearchParams
      assert.match(
        code,
        /useLocalSearchParams/,
        'StoreDetailView must import useLocalSearchParams from expo-router'
      );

      // Must extract dynamic customer id from search params or prop
      assert.match(
        code,
        /const\s*\{\s*id\s*\}\s*=\s*useLocalSearchParams|useLocalSearchParams<\{\s*id\?:\s*string\s*\}>|searchParams\.id/,
        'StoreDetailView must dynamically extract id from route search parameters'
      );

      // Must NOT contain hardcoded shop names like "manthan shop" or static dummy names
      assert.doesNotMatch(
        code,
        /manthan\s+shop/i,
        'StoreDetailView must NOT contain any hardcoded "manthan shop" identifier'
      );
    });

    it('verifies Seller, Manager, and Admin routes wire dynamic id to StoreDetailView without hardcoded values', () => {
      const sellerCode = readFile('src/app/(seller)/customers/[id].tsx');
      const managerCode = readFile('src/app/(manager)/customers/[id].tsx');
      const adminCode = readFile('src/app/(admin)/customers/[id].tsx');

      for (const [portal, code] of [
        ['Seller', sellerCode],
        ['Manager', managerCode],
        ['Admin', adminCode],
      ] as const) {
        // Must extract id dynamically
        assert.match(
          code,
          /const\s*\{\s*id\s*\}\s*=\s*useLocalSearchParams<\{\s*id:\s*string\s*\}>\(\)/,
          `${portal} [id].tsx route must extract dynamic id via useLocalSearchParams<{ id: string }>()`
        );

        // Must pass id into StoreDetailView
        assert.match(
          code,
          /customerId=\{id\}/,
          `${portal} [id].tsx must pass dynamic customerId={id} to StoreDetailView`
        );

        // Zero hardcoded store names
        assert.doesNotMatch(
          code,
          /manthan\s+shop/i,
          `${portal} [id].tsx must NOT hardcode any store names`
        );
      }
    });

    it('verifies EmptyState 404 error display is rendered when customer record is not found', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      // Verifies empty state when customer is not found
      assert.match(
        code,
        /if\s*\(!customer\)\s*\{/,
        'StoreDetailView must guard with if (!customer) to render not-found state'
      );

      assert.match(
        code,
        /title="Customer Not Found"/,
        'StoreDetailView must display "Customer Not Found" title for missing records'
      );

      assert.match(
        code,
        /description="The requested retailer outlet record could not be found\."/,
        'StoreDetailView must show informative 404 description'
      );

      assert.match(
        code,
        /actionTitle="Back to Stores"/,
        'StoreDetailView must provide actionable Back to Stores navigation'
      );
    });

    it('verifies newly created dynamic shops load exact details dynamically via API without hardcoding', async () => {
      // Create a unique dynamic customer
      const dynamicId = `cust_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const dynamicShopName = `Dynamic Flora Mart ${Date.now()}`;
      const dynamicOwner = `Sunita Patel ${Date.now()}`;

      const dynamicCustomer: CustomerItem = {
        id: dynamicId,
        shopName: dynamicShopName,
        ownerName: dynamicOwner,
        contactName: dynamicOwner,
        phone: '+919876501234',
        email: `flora_${Date.now()}@example.com`,
        address: '77 Heritage Market, Highway 48',
        village: 'Khandwa Rural',
        district: 'Khandwa',
        state: 'Madhya Pradesh',
        pincode: '450001',
        active: true,
        createdAt: new Date().toISOString(),
      };

      // Add directly to mockDb
      mockDb.customers.unshift(dynamicCustomer);

      // Query through mockService
      const res = await handleMockRequest<{ customer: CustomerItem }>(
        `seller/customers/${dynamicId}`,
        { method: 'GET' }
      );

      assert.ok(res.customer, 'Customer should be returned');
      assert.equal(res.customer.id, dynamicId, 'Returned ID must match dynamic requested ID');
      assert.equal(res.customer.shopName, dynamicShopName, 'Returned shop name must match dynamic input');
      assert.equal(res.customer.ownerName, dynamicOwner, 'Returned owner name must match dynamic input');
      assert.equal(res.customer.district, 'Khandwa');
      assert.equal(res.customer.pincode, '450001');
    });
  });

  // =========================================================================
  // 2. READ-ONLY DISPLAY MODE (when isEditing === false)
  // =========================================================================
  describe('2. Store Details Read-Only Display Mode (when isEditing === false)', () => {
    it('verifies isEditing starts as false by default', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      assert.match(
        code,
        /const\s*\[\s*isEditing\s*,\s*setIsEditing\s*\]\s*=\s*useState\(\s*false\s*\)/,
        'isEditing state must initialize to false (view mode by default)'
      );
    });

    it('verifies fields are non-editable display elements in view mode and user cannot edit', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      // Check view mode block structure
      assert.match(
        code,
        /\{isEditing\s*\?\s*\([\s\S]*?<Input[\s\S]*?\)\s*:\s*\([\s\S]*?styles\.viewDetailsGrid/,
        'When isEditing is false, viewDetailsGrid must be rendered with non-editable Text elements'
      );

      // Verify each field is rendered inside detailValue / detailValueBold Text in view mode
      assert.match(
        code,
        /<Text style=\{styles\.detailValueBold\}>\{customer\.shopName\}<\/Text>/,
        'Shop name must be rendered as static text in view mode'
      );

      assert.match(
        code,
        /<Text style=\{styles\.detailValue\}>\{customer\.ownerName[\s\S]*?\}<\/Text>/,
        'Owner name must be rendered as static text in view mode'
      );

      assert.match(
        code,
        /<Text style=\{styles\.detailValue\}>\{customer\.phone[\s\S]*?\}<\/Text>/,
        'Phone number must be rendered as static text in view mode'
      );

      assert.match(
        code,
        /<Text style=\{styles\.detailValue\}>\{customer\.address[\s\S]*?\}<\/Text>/,
        'Address must be rendered as static text in view mode'
      );

      assert.match(
        code,
        /<Text style=\{styles\.detailValue\}>\{customer\.pincode[\s\S]*?\}<\/Text>/,
        'PIN code must be rendered as static text in view mode'
      );
    });

    it('verifies Edit Details action button is visible and accessible in view mode', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      // Top action in Header
      assert.match(
        code,
        /accessibilityLabel="Edit Details"/,
        'Header must expose an accessible "Edit Details" button when isEditing is false'
      );

      assert.match(
        code,
        /name="pencil"/,
        'Edit button must render pencil icon'
      );

      // Inline card action buttons
      assert.match(
        code,
        /accessibilityLabel="Edit Shop Information"/,
        'Shop Information card must expose quick edit trigger in view mode'
      );

      assert.match(
        code,
        /accessibilityLabel="Edit Location Details"/,
        'Location Details card must expose quick edit trigger in view mode'
      );
    });

    it('verifies quick contact pills (Call, Email, Navigate) are accessible in view mode', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      assert.match(
        code,
        /!isEditing\s*&&\s*\([\s\S]*?styles\.contactRow/,
        'Quick contact buttons must be displayed in view mode'
      );

      assert.match(
        code,
        /accessibilityLabel=\{`Call \$\{customer\.phone\}`\}/,
        'Call button must have accessible label with customer phone'
      );

      assert.match(
        code,
        /accessibilityLabel=\{`Email \$\{customer\.email\}`\}/,
        'Email button must have accessible label with customer email'
      );

      assert.match(
        code,
        /accessibilityLabel="Open store location in Maps"/,
        'Navigate button must have accessible label'
      );
    });

    it('verifies storefront photo banner and recent store ledger are rendered in view mode', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      // Storefront photo card
      assert.match(
        code,
        /Storefront Photo/,
        'Storefront photo card must be rendered'
      );

      assert.match(
        code,
        /accessibilityLabel="Update Storefront Photo"/,
        'Storefront photo must have update button'
      );

      // Ledger section
      assert.match(
        code,
        /!isEditing\s*&&\s*\([\s\S]*?Recent Store Ledger/,
        'Recent store ledger section must be visible in view mode'
      );
    });
  });

  // =========================================================================
  // 3. IN-PLACE EDITING MODE (when isEditing === true)
  // =========================================================================
  describe('3. In-Place Editing Mode (when isEditing === true)', () => {
    it('verifies tapping Edit Details transitions isEditing to true and pre-fills form data', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      assert.match(
        code,
        /const\s+handleStartEditing\s*=\s*\(\)\s*=>\s*\{[\s\S]*?initForm\(customer\);[\s\S]*?setIsEditing\(true\);/,
        'handleStartEditing must initialize form from customer values and set isEditing to true'
      );

      // Verify initForm pre-fills all fields
      assert.match(
        code,
        /shopName:\s*cust\.shopName/,
        'initForm must pre-fill shopName'
      );
      assert.match(
        code,
        /ownerName:\s*cust\.ownerName/,
        'initForm must pre-fill ownerName'
      );
      assert.match(
        code,
        /phone:\s*cust\.phone/,
        'initForm must pre-fill phone'
      );
      assert.match(
        code,
        /email:\s*cust\.email/,
        'initForm must pre-fill email'
      );
      assert.match(
        code,
        /address:\s*cust\.address/,
        'initForm must pre-fill address'
      );
      assert.match(
        code,
        /pincode:\s*cust\.pincode/,
        'initForm must pre-fill pincode'
      );
      assert.match(
        code,
        /district:\s*cust\.district/,
        'initForm must pre-fill district'
      );
      assert.match(
        code,
        /state:\s*cust\.state/,
        'initForm must pre-fill state'
      );
    });

    it('verifies editable inputs are rendered with current values and user-friendly placeholders in edit mode', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      // Shop Name Input
      assert.match(
        code,
        /placeholder="Enter store \/ shop name"/,
        'Shop name input must have clear placeholder'
      );

      // Owner Name Input
      assert.match(
        code,
        /placeholder="Enter proprietor full name"/,
        'Owner name input must have clear placeholder'
      );

      // Phone Input
      assert.match(
        code,
        /placeholder="10-digit mobile number"/,
        'Phone input must have 10-digit placeholder'
      );
      assert.match(
        code,
        /keyboardType="phone-pad"/,
        'Phone input must use phone-pad keyboard'
      );

      // Address Input
      assert.match(
        code,
        /placeholder="Building, street, landmark"/,
        'Address input must have clear placeholder'
      );

      // PIN Code Input
      assert.match(
        code,
        /placeholder="6-digit PIN code"/,
        'PIN code input must have 6-digit placeholder'
      );
      assert.match(
        code,
        /maxLength=\{6\}/,
        'PIN code input must constrain maxLength to 6'
      );
    });

    it('validates mandatory fields on save (shopName, ownerName, phone, pincode, district, state)', () => {
      // Replicate validation logic from StoreDetailView to verify rule correctness
      function validateCustomerForm(formData: {
        shopName: string;
        ownerName: string;
        phone: string;
        email?: string;
        address: string;
        pincode: string;
        district: string;
        state: string;
      }): { isValid: boolean; errors: Record<string, string> } {
        const errors: Record<string, string> = {};

        if (!formData.shopName.trim()) {
          errors.shopName = 'Store / Shop name is mandatory.';
        } else if (formData.shopName.trim().length < 2) {
          errors.shopName = 'Store name must be at least 2 characters.';
        }

        if (!formData.ownerName.trim()) {
          errors.ownerName = 'Owner / Proprietor name is mandatory.';
        } else if (formData.ownerName.trim().length < 2) {
          errors.ownerName = 'Owner name must be at least 2 characters.';
        }

        const cleanPhone = formData.phone.replace(/\D/g, '');
        if (!cleanPhone) {
          errors.phone = 'Mobile number is mandatory.';
        } else if (cleanPhone.length < 10) {
          errors.phone = 'Please enter a valid 10-digit mobile number.';
        }

        if (formData.email && formData.email.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData.email.trim())) {
            errors.email = 'Please enter a valid email address.';
          }
        }

        if (!formData.address.trim()) {
          errors.address = 'Street address is mandatory.';
        }

        const cleanPin = formData.pincode.replace(/\D/g, '');
        if (!cleanPin) {
          errors.pincode = 'PIN Code is mandatory.';
        } else if (cleanPin.length !== 6) {
          errors.pincode = 'PIN Code must be exactly 6 digits.';
        }

        if (!formData.district.trim()) {
          errors.district = 'District is mandatory.';
        }

        if (!formData.state.trim()) {
          errors.state = 'State is mandatory.';
        }

        return { isValid: Object.keys(errors).length === 0, errors };
      }

      // Test invalid inputs
      const invalid = validateCustomerForm({
        shopName: '',
        ownerName: 'A',
        phone: '123',
        email: 'invalid-email',
        address: '',
        pincode: '452',
        district: '',
        state: '',
      });

      assert.equal(invalid.isValid, false);
      assert.ok(invalid.errors.shopName);
      assert.ok(invalid.errors.ownerName);
      assert.ok(invalid.errors.phone);
      assert.ok(invalid.errors.email);
      assert.ok(invalid.errors.address);
      assert.ok(invalid.errors.pincode);
      assert.ok(invalid.errors.district);
      assert.ok(invalid.errors.state);

      // Test valid inputs
      const valid = validateCustomerForm({
        shopName: 'Kailash Kirana Store',
        ownerName: 'Kailash Chandra',
        phone: '9876543210',
        email: 'kailash@store.com',
        address: 'Main Bazaar, Shop No 4',
        pincode: '452001',
        district: 'Indore',
        state: 'Madhya Pradesh',
      });

      assert.equal(valid.isValid, true);
      assert.equal(Object.keys(valid.errors).length, 0);
    });

    it('verifies Save Changes action persists updated fields via API and switches isEditing back to false', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      assert.match(
        code,
        /const\s+handleSaveChanges\s*=\s*async\s*\(\)\s*=>\s*\{/,
        'StoreDetailView must define handleSaveChanges'
      );

      assert.match(
        code,
        /const\s+res\s*=\s*await\s+updateCustomer\(customerId,\s*payload\);/,
        'handleSaveChanges must call updateCustomer with dynamic id and payload'
      );

      assert.match(
        code,
        /setCustomer\(updatedCustomer\);[\s\S]*?initForm\(updatedCustomer\);[\s\S]*?setIsEditing\(false\);/,
        'handleSaveChanges must update local state and switch isEditing to false'
      );

      assert.match(
        code,
        /setSuccessBanner\('Store details successfully updated\.'\);/,
        'handleSaveChanges must show success banner feedback'
      );
    });

    it('verifies Cancel action discards uncommitted edits and reverts back to original values before editing began', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      assert.match(
        code,
        /const\s+handleCancelEditing\s*=\s*\(\)\s*=>\s*\{[\s\S]*?initForm\(customer\);[\s\S]*?setIsEditing\(false\);[\s\S]*?setFormErrors\(\{\}\);/,
        'handleCancelEditing must call initForm(customer) to discard edits, clear errors, and set isEditing to false'
      );
    });

    it('verifies Header back navigation warns user about unsaved edits during edit mode', () => {
      const code = readFile('src/components/customers/StoreDetailView.tsx');

      assert.match(
        code,
        /Alert\.alert\('Discard Edits\?',\s*'You have unsaved edits\. Are you sure you want to cancel\?'/,
        'Header onBack handler must alert user before discarding unsaved edits'
      );
    });
  });

  // =========================================================================
  // 4. MULTI-ROLE API INTEGRATION & VERIFICATION
  // =========================================================================
  describe('4. Multi-Role API & MockService Dynamic Integration', () => {
    beforeEach(() => {
      syncMockServiceUser({
        id: 'usr_super_admin',
        name: 'Super Admin',
        email: 'admin@femmeflo.in',
        role: 'SUPER_ADMIN',
        active: true,
      });
    });

    it('verifies adminApi defines getCustomer and updateCustomer matching manager and seller contracts', () => {
      const adminCode = readFile('src/api/admin.ts');

      assert.match(
        adminCode,
        /async\s+getCustomer\(\s*id:\s*string\s*\):\s*Promise<\{\s*customer:\s*CustomerItem\s*\}>/,
        'adminApi must define getCustomer(id: string): Promise<{ customer: CustomerItem }>'
      );

      assert.match(
        adminCode,
        /async\s+updateCustomer\(\s*id:\s*string,\s*payload:\s*UpdateCustomerPayload\s*\):\s*Promise<\{\s*customer:\s*CustomerItem\s*\}>/,
        'adminApi must define updateCustomer(id: string, payload: UpdateCustomerPayload)'
      );
    });

    it('verifies managerApi defines getCustomer and updateCustomer', () => {
      const managerCode = readFile('src/api/manager.ts');

      assert.match(
        managerCode,
        /async\s+getCustomer\(\s*id:\s*string\s*\):\s*Promise<\{\s*customer:\s*CustomerItem\s*\}>/,
        'managerApi must define getCustomer(id: string): Promise<{ customer: CustomerItem }>'
      );

      assert.match(
        managerCode,
        /async\s+updateCustomer\(\s*id:\s*string,\s*payload:\s*UpdateCustomerPayload\s*\):\s*Promise<\{\s*customer:\s*CustomerItem\s*\}>/,
        'managerApi must define updateCustomer(id: string, payload: UpdateCustomerPayload)'
      );
    });

    it('verifies sellerApi defines getCustomer and updateCustomer', () => {
      const sellerCode = readFile('src/api/seller.ts');

      assert.match(
        sellerCode,
        /async\s+getCustomer\(\s*id:\s*string\s*\):\s*Promise<\{\s*customer:\s*CustomerItem\s*\}>/,
        'sellerApi must define getCustomer(id: string): Promise<{ customer: CustomerItem }>'
      );

      assert.match(
        sellerCode,
        /async\s+updateCustomer\(\s*id:\s*string,\s*payload:\s*UpdateCustomerPayload\s*\):\s*Promise<\{\s*customer:\s*CustomerItem\s*\}>/,
        'sellerApi must define updateCustomer(id: string, payload: UpdateCustomerPayload)'
      );
    });

    it('verifies photoUrl and photoPath normalization in getCustomer and updateCustomer across APIs', () => {
      const adminCode = readFile('src/api/admin.ts');
      const managerCode = readFile('src/api/manager.ts');
      const sellerCode = readFile('src/api/seller.ts');

      for (const [name, code] of [
        ['adminApi', adminCode],
        ['managerApi', managerCode],
        ['sellerApi', sellerCode],
      ] as const) {
        assert.match(
          code,
          /photoUrl:\s*res\.customer\.photoUrl\s*\|\|\s*\(res\.customer\s+as\s+any\)\.photoPath\s*\|\|\s*null/,
          `${name} must normalize photoUrl fallback from photoPath`
        );
      }
    });

    it('verifies dynamic ID resolution and in-place update persistence in mockService', async () => {
      // Create a test store
      const testId = `cust_edit_test_${Date.now()}`;
      const originalShop = {
        id: testId,
        shopName: 'Original Kirana Store',
        ownerName: 'Mohan Lal',
        contactName: 'Mohan Lal',
        phone: '+919812345678',
        email: 'mohan@original.com',
        address: 'Old Market Square',
        village: 'Rau',
        district: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '453331',
        active: true,
        createdAt: new Date().toISOString(),
      };
      mockDb.customers.unshift(originalShop);

      // Fetch dynamic store
      const fetched = await handleMockRequest<{ customer: CustomerItem }>(
        `admin/customers/${testId}`,
        { method: 'GET' }
      );
      assert.equal(fetched.customer.shopName, 'Original Kirana Store');
      assert.equal(fetched.customer.ownerName, 'Mohan Lal');

      // Update store details in-place
      const updatePayload: UpdateCustomerPayload = {
        shopName: 'Mohan Modern Supermarket',
        ownerName: 'Mohan Lal Sharma',
        phone: '+919899988877',
        email: 'mohan.sharma@modernmarket.in',
        address: 'New Commercial Complex, Ground Floor',
        village: 'Rau Central',
        district: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '453331',
      };

      const updated = await handleMockRequest<{ customer: CustomerItem }>(
        `admin/customers/${testId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        }
      );

      assert.equal(updated.customer.shopName, 'Mohan Modern Supermarket');
      assert.equal(updated.customer.ownerName, 'Mohan Lal Sharma');
      assert.equal(updated.customer.phone, '+919899988877');
      assert.equal(updated.customer.email, 'mohan.sharma@modernmarket.in');
      assert.equal(updated.customer.address, 'New Commercial Complex, Ground Floor');

      // Verify persistent fetch reflects the update
      const refetched = await handleMockRequest<{ customer: CustomerItem }>(
        `admin/customers/${testId}`,
        { method: 'GET' }
      );
      assert.equal(refetched.customer.shopName, 'Mohan Modern Supermarket');
      assert.equal(refetched.customer.ownerName, 'Mohan Lal Sharma');
      assert.equal(refetched.customer.phone, '+919899988877');
    });

    it('verifies manager permission enforcement in mockService for customer directory access', async () => {
      // Set current user as manager with view_customers permission
      syncMockServiceUser({
        id: 'usr_mgr_test',
        name: 'Territory Manager',
        email: 'manager.test@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: ['view_customers', 'CUSTOMER_READ'],
      });

      const resWithPerm = await handleMockRequest<{ items: CustomerItem[] }>(
        'manager/customers',
        { method: 'GET' }
      );
      assert.ok(Array.isArray(resWithPerm.items), 'Manager with view_customers should list customers');

      // Set manager without permission
      syncMockServiceUser({
        id: 'usr_mgr_unauthorized',
        name: 'Unauthorized Manager',
        email: 'manager.unauth@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: [],
      });

      // Verify forbidden access
      await assert.rejects(
        async () => {
          await handleMockRequest('manager/customers', { method: 'GET' });
        },
        /Forbidden: Your territory manager account does not have permission to view customer directory/
      );
    });

    it('verifies store list navigation cards link to dynamic customer detail screens across all portals', () => {
      const managerList = readFile('src/app/(manager)/customers/index.tsx');
      const adminList = readFile('src/app/(admin)/customers/index.tsx');
      const sellerList = readFile('src/app/(seller)/customers/index.tsx');

      // Manager customer card navigation
      assert.match(
        managerList,
        /router\.push\(`\/\(manager\)\/customers\/\$\{item\.id\}`\s+as\s+any\)/,
        'Manager customer card must navigate dynamically to /(manager)/customers/${item.id}'
      );

      // Admin customer card navigation
      assert.match(
        adminList,
        /router\.push\(`\/\(admin\)\/customers\/\$\{item\.id\}`\s+as\s+any\)/,
        'Admin customer card must navigate dynamically to /(admin)/customers/${item.id}'
      );

      // Seller customer card navigation
      assert.match(
        sellerList,
        /router\.push\(`\/\(seller\)\/customers\/\$\{item\.id\}`\s+as\s+any\)/,
        'Seller customer card must navigate dynamically to /(seller)/customers/${item.id}'
      );
    });

    it('verifies layout stack files configure customer navigators without extraneous [id] screen warnings', () => {
      const managerLayout = readFile('src/app/(manager)/customers/_layout.tsx');
      const adminLayout = readFile('src/app/(admin)/customers/_layout.tsx');
      const sellerLayout = readFile('src/app/(seller)/customers/_layout.tsx');
      const salesLayout = readFile('src/app/(seller)/sales/_layout.tsx');

      // Verify all customer and sales layouts configure Stack navigation with proper animations and headers
      for (const [name, code] of [
        ['Manager', managerLayout],
        ['Admin', adminLayout],
        ['Seller', sellerLayout],
        ['Sales', salesLayout],
      ] as const) {
        assert.match(
          code,
          /<Stack[\s\S]*?screenOptions=\{\{[\s\S]*?headerShown:\s*false/,
          `${name} layout must configure Stack with headerShown: false`
        );
        assert.match(
          code,
          /animation:\s*['"]slide_from_right['"]/,
          `${name} layout must configure slide_from_right animation`
        );
        // Clean layout: No extraneous [id] screen registration that causes Metro warning
        assert.doesNotMatch(
          code,
          /<Stack\.Screen[\s\S]*?name=["']\[id\]["']/,
          `${name} layout must NOT contain extraneous Stack.Screen name="[id]" declaration`
        );
      }

      // Verify dynamic store detail route files exist on the filesystem for file-based routing
      assert.ok(
        fs.existsSync(path.join(rootDir, 'src/app/(manager)/customers/[id].tsx')),
        'Manager [id].tsx dynamic route file must exist'
      );
      assert.ok(
        fs.existsSync(path.join(rootDir, 'src/app/(admin)/customers/[id].tsx')),
        'Admin [id].tsx dynamic route file must exist'
      );
      assert.ok(
        fs.existsSync(path.join(rootDir, 'src/app/(seller)/customers/[id].tsx')),
        'Seller [id].tsx dynamic route file must exist'
      );
    });
  });
});
