import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateOnboardingPassword } from '../utils/passwordValidation.ts';

describe('Manager and Seller Onboarding Password Validation Suite', () => {
  it('rejects empty or whitespace passwords', () => {
    assert.equal(validateOnboardingPassword('').isValid, false);
    assert.equal(validateOnboardingPassword('   ').isValid, false);
    assert.equal(validateOnboardingPassword(undefined).isValid, false);
    assert.equal(validateOnboardingPassword(null).isValid, false);
  });

  it('rejects passwords shorter than 7 characters', () => {
    // 6 characters with letter, number, and symbol
    const res = validateOnboardingPassword('Pa@123');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least 7 characters/i);
  });

  it('rejects passwords missing letters', () => {
    const res = validateOnboardingPassword('123456@#$');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least one letter/i);
  });

  it('rejects passwords missing numbers', () => {
    const res = validateOnboardingPassword('Password@#$');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least one number/i);
  });

  it('rejects passwords missing symbols', () => {
    const res = validateOnboardingPassword('Password123');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least one symbol/i);
  });

  it('accepts passwords with minimum 7 characters containing letter, symbol, and number', () => {
    const res = validateOnboardingPassword('Pass@12');
    assert.equal(res.isValid, true);
    assert.equal(res.error, undefined);
  });

  it('accepts valid passwords of varying lengths and complex symbols', () => {
    assert.equal(validateOnboardingPassword('FemmeFlo@2026').isValid, true);
    assert.equal(validateOnboardingPassword('Admin#1').isValid, true);
    assert.equal(validateOnboardingPassword('k@9mZ!q').isValid, true);
    assert.equal(validateOnboardingPassword('Test$999').isValid, true);
  });
});
