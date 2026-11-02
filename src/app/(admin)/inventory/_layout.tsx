import { Stack } from 'expo-router';
import React from 'react';

export default function AdminInventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="transfer" options={{ headerShown: false }} />
    </Stack>
  );
}

