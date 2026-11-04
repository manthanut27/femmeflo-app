import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

export interface NumberTickerProps {
  value: number | string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
  animate?: boolean;
}

/**
 * Animated numeric ticker component for Indian FMCG metrics.
 * Gracefully parses prefix (e.g. ₹), integer with commas (e.g. 14,800), and decimal/suffix.
 * Uses pure primitive dependencies to prevent infinite re-render / glitch loops.
 */
export function NumberTicker({
  value,
  duration = 800,
  style,
  numberOfLines = 1,
  adjustsFontSizeToFit = true,
  minimumFontScale = 0.75,
  animate = true,
}: NumberTickerProps) {
  const rawStr = String(value ?? '');

  const parsed = useMemo(() => {
    // Matches prefix (e.g. ₹ or $), number with commas/decimals, and suffix (e.g. pkts, km, Low)
    const match = rawStr.match(/^([^0-9.-]*)([0-9,]+(?:\.[0-9]+)?)(.*)$/);
    if (!match) {
      return {
        isNumeric: false,
        prefix: '',
        numStr: '',
        suffix: '',
        hasComma: false,
        decimalPlaces: 0,
        targetNum: NaN,
      };
    }

    const prefix = match[1];
    const numStr = match[2];
    const suffix = match[3];
    const hasComma = numStr.includes(',');
    const decimalParts = numStr.replace(/,/g, '').split('.');
    const decimalPlaces = decimalParts.length > 1 ? decimalParts[1].length : 0;
    const targetNum = parseFloat(numStr.replace(/,/g, ''));
    const isNumeric = !isNaN(targetNum) && isFinite(targetNum);

    return {
      isNumeric,
      prefix,
      numStr,
      suffix,
      hasComma,
      decimalPlaces,
      targetNum,
    };
  }, [rawStr]);

  const targetNum = parsed.targetNum;
  const isNumeric = parsed.isNumeric;

  const [displayValue, setDisplayValue] = useState<number>(isNumeric ? targetNum : 0);
  const currentDisplayRef = useRef<number>(isNumeric ? targetNum : 0);
  const animationFrameRef = useRef<number | null>(null);

  // Sync ref when state changes
  useEffect(() => {
    currentDisplayRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (!animate || !isNumeric) {
      if (isNumeric) {
        setDisplayValue(targetNum);
        currentDisplayRef.current = targetNum;
      }
      return;
    }

    const startNum = currentDisplayRef.current;
    const diff = targetNum - startNum;

    // Already at target, no animation necessary
    if (diff === 0) {
      return;
    }

    const startTime = Date.now();

    const animateFrame = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease-out cubic: 1 - (1 - progress)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startNum + diff * ease;

      if (progress < 1) {
        setDisplayValue(current);
        animationFrameRef.current = requestAnimationFrame(animateFrame);
      } else {
        currentDisplayRef.current = targetNum;
        setDisplayValue(targetNum);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [targetNum, duration, animate, isNumeric]);

  if (!parsed.isNumeric) {
    return (
      <Text
        style={style}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        minimumFontScale={minimumFontScale}
      >
        {rawStr}
      </Text>
    );
  }

  // Format current animated number
  let formattedNumber = displayValue.toFixed(parsed.decimalPlaces);
  if (parsed.hasComma) {
    const [intPart, decPart] = formattedNumber.split('.');
    const formattedInt = Number(intPart).toLocaleString('en-IN');
    formattedNumber = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  }

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
    >
      {parsed.prefix}{formattedNumber}{parsed.suffix}
    </Text>
  );
}
