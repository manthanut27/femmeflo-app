import { apiRequest } from './client';
import type { ReverseGeocodeResult } from './types';

export const geoApi = {
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
    try {
      const data = await apiRequest<ReverseGeocodeResult>('geo/reverse', {
        method: 'GET',
        params: { latitude, longitude },
        skipAuth: false,
      });
      return data;
    } catch (err) {
      console.warn('[geoApi] Reverse geocoding failed', err);
      return null;
    }
  },

  async lookupAddress(address: string): Promise<ReverseGeocodeResult | null> {
    try {
      const data = await apiRequest<ReverseGeocodeResult>('geo/lookup', {
        method: 'GET',
        params: { address },
        skipAuth: false,
      });
      return data;
    } catch (err) {
      console.warn('[geoApi] Address lookup failed', err);
      return null;
    }
  },
};

