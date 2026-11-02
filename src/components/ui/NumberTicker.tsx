import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

export interface NumberTickerProps {
  value: string | number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}

/**
 * NumberTicker (adapted from 21st.dev Number Ticker / Money Flow)
 * Smoothly interpolates and rolls numbers, metrics, and currency with high fidelity.
 */
export function NumberTicker({
  value,
  duration = 700,
  style,
  numberOfLines = 1,
  adjustsFontSizeToFit = true,
  minimumFontScale = 0.75,
}: NumberTickerProps) {
  const rawStr = String(value ?? '');
  // Matches prefix (e.g. ₹ or $), number with commas/decimals, and suffix (e.g. pkts, km)
  const match = rawStr.match(/^([^0-9.-]*)([0-9,]+(?:\.[0-9]+)?)(.*)$/);

  if (!match) {
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

  const [, prefix, numStr, suffix] = match;
  const hasComma = numStr.includes(',');
  const decimalParts = numStr.replace(/,/g, '').split('.');
  const decimalPlaces = decimalParts.length > 1 ? decimalParts[1].length : 0;
  const targetNum = parseFloat(numStr.replace(/,/g, ''));

  const [displayValue, setDisplayValue] = useState<number>(0);
  const prevTargetRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isNaN(targetNum)) return;

    const startNum = prevTargetRef.current;
    const diff = targetNum - startNum;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease-out cubic: 1 - (1 - progress)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startNum + diff * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevTargetRef.current = targetNum;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetNum, duration]);

  // Format current animated number
  let formattedNumber = displayValue.toFixed(decimalPlaces);
  if (hasComma) {
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
      {prefix}{formattedNumber}{suffix}
    </Text>
  );
}
