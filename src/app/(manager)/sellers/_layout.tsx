import { Stack } from 'expo-router';
import React from 'react';

export default function ManagerSellersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ headerShown: false }} />
    </Stack>
  );
}
