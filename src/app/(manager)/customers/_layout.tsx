import { Stack } from 'expo-router';
import React from 'react';

export default function ManagerCustomersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="bulk" />
    </Stack>
  );
}

