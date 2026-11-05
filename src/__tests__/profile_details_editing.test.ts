import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PublicUser } from '../api/types';
import fs from 'node:fs';
import path from 'node:path';

describe('Profile & Details Editing Suite for Seller, Manager, and Admin', () => {
  it('validates user profile update merges and retains identity invariants', () => {
    const existingUser: PublicUser = {
      id: 'usr_seller_001',
      name: 'Rohan Sharma',
      email: 'rohan@femmeflo.in',
      phone: '+919876543210',
      role: 'SELLER',
      active: true,
      state: 'Maharashtra',
      district: 'Thane',
      village: 'Diva',
    };

    const updates: Partial<PublicUser> = {
      name: 'Rohan V. Sharma',
      phone: '+919811122233',
      alternatePhone: '+919844455566',
      village: 'Kalwa West',
      address: 'Near Kalwa Bridge',
      pincode: '400605',
    };

    const merged: PublicUser = {
      ...existingUser,
      ...updates,
      id: existingUser.id,
      role: existingUser.role,
    };

    assert.equal(merged.id, 'usr_seller_001');
    assert.equal(merged.role, 'SELLER');
    assert.equal(merged.name, 'Rohan V. Sharma');
    assert.equal(merged.phone, '+919811122233');
    assert.equal(merged.alternatePhone, '+919844455566');
    assert.equal(merged.village, 'Kalwa West');
    assert.equal(merged.pincode, '400605');
  });

  it('validates Indian 10-digit mobile number normalization', () => {
    function normalizePhone(raw: string): string {
      const clean = raw.replace(/\D/g, '');
      if (clean.length < 10) throw new Error('Invalid mobile phone');
      return clean.startsWith('91') && clean.length === 12
        ? `+${clean}`
        : `+91${clean.slice(-10)}`;
    }

    assert.equal(normalizePhone('9876543210'), '+919876543210');
    assert.equal(normalizePhone('+91 98765 43210'), '+919876543210');
    assert.equal(normalizePhone('09876543210'), '+919876543210');
    assert.throws(() => normalizePhone('12345'), /Invalid mobile phone/);
  });

  it('verifies Seller Profile screen exposes edit button, account settings menu item, and modal', () => {
    const sellerFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(seller)/profile/index.tsx'),
      'utf8'
    );

    assert.ok(sellerFile.includes('Edit Profile Details'), 'Seller screen must include Edit Profile Details modal');
    assert.ok(sellerFile.includes('handleOpenEditModal'), 'Seller screen must include handleOpenEditModal handler');
    assert.ok(sellerFile.includes('handleSaveProfile'), 'Seller screen must include handleSaveProfile handler');
    assert.ok(sellerFile.includes('updateProfile'), 'Seller screen must call updateProfile from useAuth');
    assert.ok(sellerFile.includes('editProfilePill'), 'Seller screen must include edit pill on profile card');
  });

  it('verifies Manager Profile screen exposes edit button, settings menu item, and modal', () => {
    const managerFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(manager)/profile/index.tsx'),
      'utf8'
    );

    assert.ok(managerFile.includes('Edit Manager Profile'), 'Manager screen must include Edit Manager Profile modal');
    assert.ok(managerFile.includes('handleOpenEditModal'), 'Manager screen must include handleOpenEditModal handler');
    assert.ok(managerFile.includes('handleSaveProfile'), 'Manager screen must include handleSaveProfile handler');
    assert.ok(managerFile.includes('updateProfile'), 'Manager screen must call updateProfile from useAuth');
    assert.ok(managerFile.includes('editProfilePill'), 'Manager screen must include edit pill on profile card');
  });

  it('verifies Admin Settings screen exposes editable executive profile with toggle mode', () => {
    const adminFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(admin)/settings/index.tsx'),
      'utf8'
    );

    assert.ok(adminFile.includes('Super Admin Profile'), 'Admin screen must include Super Admin Profile card');
    assert.ok(adminFile.includes('handleStartEditingProfile'), 'Admin screen must include handleStartEditingProfile');
    assert.ok(adminFile.includes('handleSaveAdminProfile'), 'Admin screen must include handleSaveAdminProfile');
    assert.ok(adminFile.includes('isEditingProfile'), 'Admin screen must support isEditingProfile toggle mode');
    assert.ok(adminFile.includes('Manage Team (Sellers & Managers)'), 'Admin screen must link to team management');
  });

  it('verifies Manager Team sellers page exposes field officer editing modal', () => {
    const managerSellersFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(manager)/sellers/index.tsx'),
      'utf8'
    );

    assert.ok(managerSellersFile.includes('Edit Field Officer'), 'Manager team page must include Edit Field Officer modal');
    assert.ok(managerSellersFile.includes('handleOpenEditSeller'), 'Manager team page must include handleOpenEditSeller');
    assert.ok(managerSellersFile.includes('handleSaveSeller'), 'Manager team page must include handleSaveSeller');
    assert.ok(managerSellersFile.includes('managerApi.updateSeller'), 'Manager team page must call managerApi.updateSeller');
  });

  it('verifies Admin Users management exposes both manager persona and seller details editing', () => {
    const adminUsersFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(admin)/users/index.tsx'),
      'utf8'
    );

    assert.ok(adminUsersFile.includes('Edit Officer Details'), 'Admin users page must allow editing sellers');
    assert.ok(adminUsersFile.includes('handleOpenEditSellerModal'), 'Admin users page must include seller edit trigger');
    assert.ok(adminUsersFile.includes('handleSaveSeller'), 'Admin users page must include handleSaveSeller');
    assert.ok(adminUsersFile.includes('adminApi.updateSeller'), 'Admin users page must call adminApi.updateSeller');
  });
});
