import { Stack } from 'expo-router';
import React from 'react';

export default function SharedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
    </Stack>
  );
}
