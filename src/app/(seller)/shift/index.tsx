import { Redirect } from 'expo-router';
import React from 'react';

/**
 * Unified into the single detailed Attendance & Duty page (`/(seller)/attendance`).
 * Any deep-links targeting `/(seller)/shift` redirect straight into Attendance.
 */
export default function LegacyShiftRedirect() {
  return <Redirect href="/(seller)/attendance" />;
}
