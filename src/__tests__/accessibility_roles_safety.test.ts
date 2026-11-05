import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('React Native Accessibility Roles Safety Suite', () => {
  const VALID_ROLES = new Set([
    'none',
    'button',
    'togglebutton',
    'link',
    'search',
    'image',
    'keyboardkey',
    'text',
    'adjustable',
    'imagebutton',
    'header',
    'summary',
    'alert',
    'checkbox',
    'combobox',
    'menu',
    'menubar',
    'menuitem',
    'progressbar',
    'radio',
    'radiogroup',
    'scrollbar',
    'spinbutton',
    'switch',
    'tab',
    'tabbar',
    'tablist',
    'timer',
    'toolbar',
  ]);

  function getFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        getFiles(filePath, fileList);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  it('ensures no component uses invalid React Native accessibilityRole like "status"', () => {
    const srcDir = path.resolve('src');
    const allFiles = getFiles(srcDir);
    const regex = /accessibilityRole\s*=\s*(?:\{['"]([^'"]+)['"]\}|['"]([^'"]+)['"])/g;

    const invalidOccurrences: Array<{ file: string; role: string }> = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const role = match[1] || match[2];
        if (role && !VALID_ROLES.has(role)) {
          invalidOccurrences.push({ file: path.relative(srcDir, file), role });
        }
      }
    }

    assert.equal(
      invalidOccurrences.length,
      0,
      `Found invalid accessibilityRole values that crash React Native Android: ${JSON.stringify(invalidOccurrences)}`
    );
  });
});

