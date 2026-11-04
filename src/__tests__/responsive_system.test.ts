import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getDeviceType,
  getGridColumns,
  getMaxContainerWidth,
  getResponsiveFontSize,
  getResponsiveSize,
  getResponsiveSpacing
} from '../utils/responsiveCore.ts';

describe('Responsive Design System Foundation Suite', () => {
  it('correctly maps screen widths to device type categories', () => {
    // Small mobile (<360px)
    assert.equal(getDeviceType(320), 'smallMobile');
    assert.equal(getDeviceType(359), 'smallMobile');

    // Standard mobile (360-430px)
    assert.equal(getDeviceType(360), 'mobile');
    assert.equal(getDeviceType(393), 'mobile');
    assert.equal(getDeviceType(430), 'mobile');

    // Large mobile (431-599px)
    assert.equal(getDeviceType(431), 'largeMobile');
    assert.equal(getDeviceType(500), 'largeMobile');
    assert.equal(getDeviceType(599), 'largeMobile');

    // Small tablet (600-767px)
    assert.equal(getDeviceType(600), 'smallTablet');
    assert.equal(getDeviceType(700), 'smallTablet');
    assert.equal(getDeviceType(767), 'smallTablet');

    // Tablet (768-1023px)
    assert.equal(getDeviceType(768), 'tablet');
    assert.equal(getDeviceType(900), 'tablet');
    assert.equal(getDeviceType(1023), 'tablet');

    // Large tablet (1024px+)
    assert.equal(getDeviceType(1024), 'largeTablet');
    assert.equal(getDeviceType(1280), 'largeTablet');
  });

  it('calculates responsive sizes within stable boundaries', () => {
    const baseSize = 40;

    // Small phone scales down slightly but doesn't shrink below 0.85x
    const smallSize = getResponsiveSize(baseSize, 320);
    assert.ok(smallSize >= 34 && smallSize <= 40);

    // Standard baseline width gives exact base size
    const standardSize = getResponsiveSize(baseSize, 390);
    assert.equal(standardSize, baseSize);

    // Tablet scales up smoothly without inflating out of control
    const tabletSize = getResponsiveSize(baseSize, 768);
    assert.ok(tabletSize > baseSize && tabletSize <= 54);
  });

  it('calculates responsive font sizes preventing text clipping', () => {
    const baseFont = 16;

    // Small mobile font is adjusted so titles do not overflow
    const smallFont = getResponsiveFontSize(baseFont, 320);
    assert.ok(smallFont <= baseFont && smallFont >= 14);

    // Standard mobile retains exact font size
    assert.equal(getResponsiveFontSize(baseFont, 390), baseFont);

    // Tablet font scales up moderately for comfortable reading distance
    assert.equal(getResponsiveFontSize(baseFont, 768), Math.round(baseFont * 1.08));
    assert.equal(getResponsiveFontSize(baseFont, 1024), Math.round(baseFont * 1.15));
  });

  it('calculates responsive spacing for margins, paddings, and gaps', () => {
    const baseSpacing = 16;

    // Compact spacing on tiny screens
    const smallSpacing = getResponsiveSpacing(baseSpacing, 320);
    assert.ok(smallSpacing < baseSpacing && smallSpacing >= 12);

    // Preserves zero and negative spacing on small mobile
    assert.equal(getResponsiveSpacing(0, 320), 0);
    assert.equal(getResponsiveSpacing(-8, 320), -8);

    // Baseline spacing on standard phones
    assert.equal(getResponsiveSpacing(baseSpacing, 390), baseSpacing);

    // Spacious paddings on tablets
    assert.equal(getResponsiveSpacing(baseSpacing, 768), 20);
  });

  it('calculates optimal grid column counts for adaptive multi-column layouts', () => {
    assert.equal(getGridColumns(320), 1);
    assert.equal(getGridColumns(390), 1);
    assert.equal(getGridColumns(500), 1);
    assert.equal(getGridColumns(600), 2);
    assert.equal(getGridColumns(768), 3);
    assert.equal(getGridColumns(1024), 4);
  });

  it('determines balanced maximum container widths preventing stretched layouts', () => {
    assert.equal(getMaxContainerWidth(360), 360);
    assert.equal(getMaxContainerWidth(600), 680);
    assert.equal(getMaxContainerWidth(768), 860);
    assert.equal(getMaxContainerWidth(1024), 1080);
  });
});