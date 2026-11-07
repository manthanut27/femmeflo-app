import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Bottom Sheet Modal Keyboard Resilience Suite', () => {
  const rootDir = process.cwd();

  const readComponent = (relPath: string) => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  it('verifies (admin)/categories/index.tsx uses KeyboardAvoidingView with height behavior and statusBarTranslucent', () => {
    const code = readComponent('src/app/(admin)/categories/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Admin categories modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Admin categories modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Admin categories modal must provide backdrop dismiss');
  });

  it('verifies (admin)/products/index.tsx uses KeyboardAvoidingView with height behavior and statusBarTranslucent', () => {
    const code = readComponent('src/app/(admin)/products/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Admin products modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Admin products modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Admin products modal must provide backdrop dismiss');
  });

  it('verifies (admin)/incentives/index.tsx wraps all input modals in KeyboardAvoidingView with height behavior', () => {
    const code = readComponent('src/app/(admin)/incentives/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Admin incentives modals must have statusBarTranslucent');
    const matches = code.match(/behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/g);
    assert.ok(matches && matches.length >= 4, 'Must have height behavior for all rule/rate/adj/payout input modals');
    assert.match(code, /backdropDismiss/, 'Admin incentives modal must provide backdrop dismiss');
  });

  it('verifies (admin)/users/index.tsx wraps user management modals with height behavior and statusBarTranslucent', () => {
    const code = readComponent('src/app/(admin)/users/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Admin users modals must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Admin users modal must use height behavior on Android'
    );
  });

  it('verifies (admin)/index.tsx filter modal uses KeyboardAvoidingView with height behavior and statusBarTranslucent', () => {
    const code = readComponent('src/app/(admin)/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Admin dashboard filter modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Admin dashboard filter modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Admin dashboard filter modal must provide backdrop dismiss');
  });

  it('verifies (manager)/sales/index.tsx rejected order price revision modal uses KeyboardAvoidingView with height behavior', () => {
    const code = readComponent('src/app/(manager)/sales/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Manager price edit modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Manager price edit modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Manager price edit modal must provide backdrop dismiss');
  });

  it('verifies (manager)/profile/index.tsx uses KeyboardAvoidingView with height behavior and statusBarTranslucent', () => {
    const code = readComponent('src/app/(manager)/profile/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Manager profile edit modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Manager profile edit modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Manager profile edit modal must provide backdrop dismiss');
  });

  it('verifies (manager)/sellers/index.tsx uses KeyboardAvoidingView with height behavior and statusBarTranslucent', () => {
    const code = readComponent('src/app/(manager)/sellers/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Manager seller edit modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Manager seller edit modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Manager seller edit modal must provide backdrop dismiss');
  });

  it('verifies (seller)/profile/index.tsx uses KeyboardAvoidingView with height behavior and statusBarTranslucent', () => {
    const code = readComponent('src/app/(seller)/profile/index.tsx');
    assert.match(code, /statusBarTranslucent/, 'Seller profile edit modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Seller profile edit modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Seller profile edit modal must provide backdrop dismiss');
  });

  it('verifies (seller)/sales/[id].tsx payment and price revision modals use KeyboardAvoidingView with height behavior', () => {
    const code = readComponent('src/app/(seller)/sales/[id].tsx');
    assert.match(code, /statusBarTranslucent/, 'Seller sales detail modals must have statusBarTranslucent');
    const matches = code.match(/behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/g);
    assert.ok(matches && matches.length >= 3, 'All seller sales [id] input modals must avoid keyboard');
  });

  it('verifies (seller)/sales/pending.tsx payment modal uses KeyboardAvoidingView with height behavior', () => {
    const code = readComponent('src/app/(seller)/sales/pending.tsx');
    assert.match(code, /statusBarTranslucent/, 'Seller sales pending payment modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Seller sales pending modal must use height behavior on Android'
    );
  });

  it('verifies components/customers/BatchCustomerOnboarding.tsx import modal avoids keyboard', () => {
    const code = readComponent('src/components/customers/BatchCustomerOnboarding.tsx');
    assert.match(code, /statusBarTranslucent/, 'Batch customer onboarding modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Batch customer onboarding modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Batch customer onboarding modal must provide backdrop dismiss');
  });

  it('verifies components/common/VoiceFeedbackTranslator.tsx edit modal avoids keyboard', () => {
    const code = readComponent('src/components/common/VoiceFeedbackTranslator.tsx');
    assert.match(code, /statusBarTranslucent/, 'Voice feedback translator edit modal must have statusBarTranslucent');
    assert.match(
      code,
      /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
      'Voice feedback translator edit modal must use height behavior on Android'
    );
    assert.match(code, /backdropDismiss/, 'Voice feedback translator modal must provide backdrop dismiss');
  });
});

