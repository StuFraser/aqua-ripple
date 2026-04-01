import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type LocationLookupResponse from '../types/LocationLookupResponse'

// Analysis endpoint
export const useAnalysis = (latitude: number, longitude: number) => {
  return useQuery({
    queryKey: ['analysis', latitude, longitude],
    queryFn: () =>
      apiClient.post('/api/analysis/analyse', {
        latitude,
        longitude,
      }),
    enabled: latitude !== undefined && longitude !== undefined,
  });
};

// GetWet warm cache
export const useWarmCache = () => {
  return useMutation({
    mutationFn: (data: { latitude: number; longitude: number }) =>
      apiClient.post('/api/getwet/warm', data),
  });
};


export const useCheckWet = (latitude: number, longitude: number) => {
  return useQuery({
    queryKey: ['getwet-check', latitude, longitude],
    queryFn: () =>
      apiClient.post<LocationLookupResponse>('/api/getwet/check', {
        latitude,
        longitude,
      }),
    enabled: !!latitude && !!longitude,
  });
};

// GeoNames lookup
export const useGeoNames = (latitude: number, longitude: number) => {
  return useQuery({
    queryKey: ['geonames', latitude, longitude],
    queryFn: () =>
      apiClient.post('/api/geonames/lookup', {
        latitude,
        longitude,
      }),
    enabled: latitude !== undefined && longitude !== undefined,
  });
};