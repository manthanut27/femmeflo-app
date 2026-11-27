import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sellerApi } from '@/api/seller';
import type { PincodeLookupStatus } from '@/components/customers/CustomerOnboardingForm';
import {
  acquireGpsCoordinates,
  buildFullShopAddress,
  getCurrentLocationWithAddress,
  isWithinIndiaBounds,
  resolveManualAddressCoordinates,
  sanitizeIndiaCoordinates,
  type GpsAcquisitionStatus,
} from '@/utils/locationUtils';

export type ShopLocationMode = 'CURRENT' | 'MANUAL';

export interface UseShopLocationAddressOptions {
  initialState?: string;
  initialDistrict?: string;
  autoFetchOnMount?: boolean;
  onNotice?: (notice: { type: 'info' | 'error' | 'success'; title?: string; message: string }) => void;
}

/**
 * Shared state and geocoding controller for shop location acquisition across
 * Quick Add Shop (Check-In / Checkout) and standalone Customer Onboarding flows.
 * Enforces strict separation between live device GPS ('CURRENT') and manual
 * address entry ('MANUAL') with live forward-geocoding.
 */
export function useShopLocationAddress(options: UseShopLocationAddressOptions = {}) {
  const {
    initialState = 'Maharashtra',
    initialDistrict = '',
    autoFetchOnMount = false,
    onNotice,
  } = options;

  const [locationMode, setLocationMode] = useState<ShopLocationMode>('CURRENT');
  const [pincode, setPincode] = useState('');
  const [pincodeStatus, setPincodeStatus] = useState<PincodeLookupStatus>('idle');
  const [address, setAddress] = useState('');
  const [streetName, setStreetName] = useState('');
  const [landmark, setLandmark] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState(initialDistrict);
  const [stateName, setStateName] = useState(initialState);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsAcquisitionStatus>('idle');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);

  const modeRef = useRef<ShopLocationMode>(locationMode);
  modeRef.current = locationMode;

  const manualGeoSeqRef = useRef(0);
  const manualDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDebounce = useCallback(() => {
    if (manualDebounceRef.current) {
      clearTimeout(manualDebounceRef.current);
      manualDebounceRef.current = null;
    }
  }, []);

  const resetFields = useCallback(
    (defaultDistrict = initialDistrict, defaultState = initialState) => {
      clearDebounce();
      manualGeoSeqRef.current += 1;
      setLocationMode('CURRENT');
      setPincode('');
      setPincodeStatus('idle');
      setAddress('');
      setStreetName('');
      setLandmark('');
      setVillage('');
      setDistrict(defaultDistrict);
      setStateName(defaultState);
      setLatitude(null);
      setLongitude(null);
      setGpsAccuracy(null);
      setGpsStatus('idle');
      setIsGeocodingManual(false);
    },
    [clearDebounce, initialDistrict, initialState]
  );

  const fetchCurrentLocation = useCallback(
    async (overwriteAddress = true) => {
      clearDebounce();
      manualGeoSeqRef.current += 1;
      setLocationMode('CURRENT');
      setIsGeocodingManual(false);
      setGpsStatus('acquiring_high');

      try {
        const locWithAddr = await getCurrentLocationWithAddress({
          highAccuracyTimeoutMs: 7000,
          fallbackTimeoutMs: 4000,
          maxAgeMs: overwriteAddress ? 10000 : 30000,
          accuracyThresholdMeters: 50,
        });

        // Ignore if user switched to manual mode while GPS request was in-flight
        if (modeRef.current !== 'CURRENT') return;

        if (locWithAddr && locWithAddr.latitude !== null && locWithAddr.longitude !== null) {
          setGpsStatus('acquired');
          let lat = locWithAddr.latitude;
          let lng = locWithAddr.longitude;
          if (!isWithinIndiaBounds(lat, lng)) {
            const sanitized = sanitizeIndiaCoordinates(lat, lng);
            lat = sanitized.latitude;
            lng = sanitized.longitude;
          }
          setLatitude(Number(lat.toFixed(6)));
          setLongitude(Number(lng.toFixed(6)));
          setGpsAccuracy(locWithAddr.accuracy || 10);

          if (locWithAddr.address && (overwriteAddress || !address.trim())) {
            setAddress(locWithAddr.address);
          }
          if (locWithAddr.street && (overwriteAddress || !streetName.trim())) {
            setStreetName(locWithAddr.street);
          }
          if (locWithAddr.village && (overwriteAddress || !village.trim())) {
            setVillage(locWithAddr.village);
          }
          if (locWithAddr.district) {
            setDistrict(locWithAddr.district);
          }
          if (locWithAddr.state) {
            setStateName(locWithAddr.state);
          }
          if (locWithAddr.pincode && (overwriteAddress || !pincode.trim())) {
            setPincode(locWithAddr.pincode);
            setPincodeStatus('found');
          }
          return;
        }
      } catch (err) {
        console.warn('Live shop location lookup failed, falling back to acquireGpsCoordinates', err);
      }

      if (modeRef.current !== 'CURRENT') return;

      const res = await acquireGpsCoordinates({
        highAccuracyTimeoutMs: 6000,
        fallbackTimeoutMs: 4000,
        onStatusChange: (st) => {
          if (modeRef.current === 'CURRENT') setGpsStatus(st);
        },
      });
      if (modeRef.current !== 'CURRENT') return;

      setGpsStatus(res.status);
      if (res.status === 'acquired' && res.latitude !== null && res.longitude !== null) {
        if (!isWithinIndiaBounds(res.latitude, res.longitude) || res.isEmulatorFallback) {
          const sanitized = sanitizeIndiaCoordinates(res.latitude, res.longitude);
          setLatitude(sanitized.latitude);
          setLongitude(sanitized.longitude);
          setGpsAccuracy(res.accuracy || 15);
          onNotice?.({
            type: 'info',
            title: 'Location Notice',
            message: 'Emulator / overseas location detected; using default Indian territory coordinates.',
          });
        } else {
          setLatitude(Number(res.latitude.toFixed(6)));
          setLongitude(Number(res.longitude.toFixed(6)));
          setGpsAccuracy(res.accuracy);
        }
      }
    },
    [address, clearDebounce, onNotice, pincode, streetName, village]
  );

  const switchToManualMode = useCallback(() => {
    clearDebounce();
    manualGeoSeqRef.current += 1;
    setLocationMode('MANUAL');
    // Immediately clear stale device GPS coordinates so e.g. Delhi GPS never leaks onto a Thane manual address
    setLatitude(null);
    setLongitude(null);
    setGpsAccuracy(null);
    setGpsStatus('idle');
    setIsGeocodingManual(false);
  }, [clearDebounce]);

  const lookupManualCoordinates = useCallback(
    async (overrides?: {
      address?: string;
      streetName?: string;
      landmark?: string;
      village?: string;
      district?: string;
      state?: string;
      pincode?: string;
    }) => {
      const reqId = ++manualGeoSeqRef.current;
      const effAddr = overrides?.address ?? address;
      const effStreet = overrides?.streetName ?? streetName;
      const effLandmark = overrides?.landmark ?? landmark;
      const effVillage = overrides?.village ?? village;
      const effDistrict = overrides?.district ?? district;
      const effState = overrides?.state ?? stateName;
      const effPincode = overrides?.pincode ?? pincode;

      const hasEnoughInfo = Boolean(
        effPincode.trim().length === 6 ||
          effStreet.trim() ||
          effAddr.trim() ||
          (effDistrict.trim() && effState.trim())
      );
      if (!hasEnoughInfo) return null;

      setIsGeocodingManual(true);
      try {
        const resolved = await resolveManualAddressCoordinates({
          address: effAddr,
          streetName: effStreet,
          landmark: effLandmark,
          village: effVillage,
          district: effDistrict,
          state: effState,
          pincode: effPincode,
        });
        if (manualGeoSeqRef.current !== reqId || modeRef.current !== 'MANUAL') {
          return null;
        }
        if (resolved && resolved.latitude != null && resolved.longitude != null) {
          setLatitude(resolved.latitude);
          setLongitude(resolved.longitude);
          setGpsAccuracy(resolved.accuracy ?? 35);
          return resolved;
        }
        return null;
      } finally {
        if (manualGeoSeqRef.current === reqId) {
          setIsGeocodingManual(false);
        }
      }
    },
    [address, district, landmark, pincode, stateName, streetName, village]
  );

  const scheduleManualGeocode = useCallback(
    (nextOverrides?: {
      address?: string;
      streetName?: string;
      landmark?: string;
      village?: string;
      district?: string;
      state?: string;
      pincode?: string;
    }) => {
      clearDebounce();
      if (modeRef.current !== 'MANUAL') return;
      // Clear previously geocoded coords until the edited manual address is re-geocoded
      setLatitude(null);
      setLongitude(null);
      manualDebounceRef.current = setTimeout(() => {
        lookupManualCoordinates(nextOverrides).catch(() => {});
      }, 650);
    },
    [clearDebounce, lookupManualCoordinates]
  );

  const handlePincodeChange = useCallback(
    async (raw: string) => {
      const digitsOnly = raw.replace(/[^0-9]/g, '').slice(0, 6);
      setPincode(digitsOnly);

      if (modeRef.current === 'MANUAL') {
        setLatitude(null);
        setLongitude(null);
      }

      if (digitsOnly.length < 6) {
        clearDebounce();
        setPincodeStatus('idle');
        return;
      }

      if (/^\d{6}$/.test(digitsOnly)) {
        setPincodeStatus('loading');
        let nextState = stateName;
        let nextDistrict = district;
        let nextVillage = village;
        try {
          const lookup = await sellerApi.lookupPincode(digitsOnly);
          const foundAny = Boolean(lookup.state || lookup.district || lookup.village);
          if (lookup.state) {
            nextState = lookup.state;
            setStateName(lookup.state);
          }
          if (lookup.district) {
            nextDistrict = lookup.district;
            setDistrict(lookup.district);
          }
          if (lookup.village) {
            nextVillage = lookup.village;
            setVillage(lookup.village);
          }
          if ((lookup as any).latitude != null && (lookup as any).longitude != null) {
            const sanitized = sanitizeIndiaCoordinates((lookup as any).latitude, (lookup as any).longitude);
            setLatitude(sanitized.latitude);
            setLongitude(sanitized.longitude);
            setPincodeStatus(foundAny ? 'found' : 'not_found');
            return;
          }
          setPincodeStatus(foundAny ? 'found' : 'not_found');
        } catch {
          setPincodeStatus('not_found');
        }

        // Resolve exact lat/lng for the PIN code + manual address
        await lookupManualCoordinates({
          pincode: digitsOnly,
          state: nextState,
          district: nextDistrict,
          village: nextVillage,
        });
      }
    },
    [clearDebounce, district, lookupManualCoordinates, stateName, village]
  );

  useEffect(() => {
    if (autoFetchOnMount) {
      fetchCurrentLocation(false);
    }
    return () => clearDebounce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combinedFullAddress = useMemo(
    () => buildFullShopAddress({ address, streetName, landmark }),
    [address, streetName, landmark]
  );

  const formattedAddress = useMemo(() => {
    const parts = [
      combinedFullAddress,
      village.trim(),
      district.trim(),
      stateName.trim() && pincode.trim()
        ? `${stateName.trim()} - ${pincode.trim()}`
        : stateName.trim() || pincode.trim(),
    ].filter(Boolean);
    return parts.join(', ');
  }, [combinedFullAddress, district, pincode, stateName, village]);

  const clearManualAddressFields = useCallback(() => {
    clearDebounce();
    manualGeoSeqRef.current += 1;
    setPincode('');
    setPincodeStatus('idle');
    setAddress('');
    setStreetName('');
    setLandmark('');
    setVillage('');
    setDistrict('');
    setStateName('');
    setLatitude(null);
    setLongitude(null);
    setGpsAccuracy(null);
  }, [clearDebounce]);

  /**
   * Resolves the best coordinates at submit time strictly according to `locationMode`:
   * - In MANUAL mode: forward-geocodes manual address/PIN (never falls back to stale device GPS).
   * - In CURRENT mode: uses acquired GPS coordinates.
   */
  const resolveCoordinatesForSubmit = useCallback(async () => {
    if (modeRef.current === 'MANUAL') {
      if (latitude != null && longitude != null && isWithinIndiaBounds(latitude, longitude)) {
        return { latitude, longitude, accuracy: gpsAccuracy ?? undefined };
      }
      const resolved = await lookupManualCoordinates();
      if (resolved && resolved.latitude != null && resolved.longitude != null) {
        return {
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          accuracy: resolved.accuracy ?? undefined,
        };
      }
      return { latitude: undefined, longitude: undefined, accuracy: undefined };
    }

    if (latitude != null && longitude != null && isWithinIndiaBounds(latitude, longitude)) {
      return { latitude, longitude, accuracy: gpsAccuracy ?? undefined };
    }
    return { latitude: undefined, longitude: undefined, accuracy: undefined };
  }, [gpsAccuracy, latitude, longitude, lookupManualCoordinates]);

  return {
    locationMode,
    setLocationMode,
    pincode,
    setPincode,
    pincodeStatus,
    setPincodeStatus,
    address,
    setAddress,
    streetName,
    setStreetName,
    landmark,
    setLandmark,
    village,
    setVillage,
    district,
    setDistrict,
    stateName,
    setStateName,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    gpsAccuracy,
    gpsStatus,
    isGeocodingManual,
    combinedFullAddress,
    formattedAddress,
    resetFields,
    clearManualAddressFields,
    fetchCurrentLocation,
    switchToManualMode,
    lookupManualCoordinates,
    scheduleManualGeocode,
    handlePincodeChange,
    resolveCoordinatesForSubmit,
  };
}
