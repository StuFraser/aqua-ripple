import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import Toast, { type ToastState } from '../layout/toast';

// ── Icons (module-level constants — created once, never recreated) ──────────

const userPin = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const standardPin = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

// Set default for all markers
L.Marker.prototype.options.icon = standardPin;

// ── Cache warming ───────────────────────────────────────────────────────────

const WARM_THRESHOLD_KM = 5;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function warmCache(lat: number, lng: number): Promise<void> {
    try {
        await fetch(`${API_BASE}/api/getwet/warm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
        });
    } catch (err) {
        console.warn('[AquaRipple] Cache warm failed:', err);
    }
}

// ── Map event handler ───────────────────────────────────────────────────────

interface MapEventHandlerProps {
    onMapClick: (lat: number, lng: number) => void;
    lastWarmedLocationRef: React.MutableRefObject<[number, number] | null>;
    onWarm: (lat: number, lng: number) => void;
}

function MapEventHandler({ onMapClick, lastWarmedLocationRef, onWarm }: MapEventHandlerProps) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
        moveend: (e) => {
            const { lat, lng } = e.target.getCenter();
            const last = lastWarmedLocationRef.current;
            const shouldWarm = last === null ||
                distanceKm(last[0], last[1], lat, lng) >= WARM_THRESHOLD_KM;

            if (shouldWarm) {
                lastWarmedLocationRef.current = [lat, lng];
                onWarm(lat, lng);
            }
        },
    });
    return null;
}

// ── Geolocation helpers ─────────────────────────────────────────────────────

const DEFAULT_LOCATION: [number, number] = [-38.68, 176.005];

function getLocationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
        case GeolocationPositionError.PERMISSION_DENIED:
            return "Location access was denied. Showing default area.";
        case GeolocationPositionError.POSITION_UNAVAILABLE:
            return "Location unavailable on this device. Showing default area.";
        case GeolocationPositionError.TIMEOUT:
            return "Location request timed out. Showing default area.";
        default:
            return "Could not determine your location. Showing default area.";
    }
}

// ── FlyTo controller (lives inside MapContainer) ────────────────────────────

interface FlyToControllerProps {
    flyToRef: React.MutableRefObject<((lat: number, lng: number) => void) | null>;
}

function FlyToController({ flyToRef }: FlyToControllerProps) {
    const map = useMap();
    useEffect(() => {
        flyToRef.current = (lat: number, lng: number) => {
            map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 1.2 });
        };
    }, [map, flyToRef]);
    return null;
}

// ── Public handle ────────────────────────────────────────────────────────────

export interface MapViewHandle {
    flyTo: (lat: number, lng: number) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

interface MapViewProps {
    onLocationSelect: (location: [number, number]) => void;
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(({ onLocationSelect }, ref) => {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [clickedMarker, setClickedMarker] = useState<[number, number] | undefined>(undefined);
    const [locationError, setLocationError] = useState<GeolocationPositionError | null>(null);
    const [warmState, setWarmState] = useState<ToastState>("hidden");
    const lastWarmedLocationRef = useRef<[number, number] | null>(null);
    const flyToFnRef = useRef<((lat: number, lng: number) => void) | null>(null);
    const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({
        flyTo: (lat, lng) => flyToFnRef.current?.(lat, lng),
    }));

    // Trigger a warming cycle and show the toast
    const triggerWarm = async (lat: number, lng: number) => {
        if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
        setWarmState("warming");
        await warmCache(lat, lng);
        setWarmState("done");
        // Reset state after toast has had time to hide itself
        warmTimerRef.current = setTimeout(() => setWarmState("hidden"), 4000);
    };

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
                setUserLocation(loc);
                lastWarmedLocationRef.current = loc;
                triggerWarm(loc[0], loc[1]);
            },
            (error) => {
                setLocationError(error);
                setUserLocation(DEFAULT_LOCATION);
                lastWarmedLocationRef.current = DEFAULT_LOCATION;
                triggerWarm(DEFAULT_LOCATION[0], DEFAULT_LOCATION[1]);
            }
        );
        return () => {
            if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
        };
    }, []);

    const handleMapClick = (lat: number, lng: number) => {
        const location: [number, number] = [lat, lng];
        setClickedMarker(location);
        onLocationSelect(location);
    };

    if (!userLocation) {
        return (
            <div className="h-full flex items-center justify-center text-aqua-dark font-medium">
                Loading map...
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            {locationError && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg shadow-md">
                    <span>⚠️</span>
                    <span>{getLocationErrorMessage(locationError)}</span>
                </div>
            )}

            <Toast state={warmState} />

            <MapContainer
                center={userLocation}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={false}
                doubleClickZoom={true}
                dragging={true}
            >
                <FlyToController flyToRef={flyToFnRef} />
                <MapEventHandler
                    onMapClick={handleMapClick}
                    lastWarmedLocationRef={lastWarmedLocationRef}
                    onWarm={triggerWarm}
                />
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />
                <Marker position={userLocation} icon={userPin}>
                    <Popup>You are here</Popup>
                </Marker>
                {clickedMarker && (
                    <Marker position={clickedMarker}>
                        <Popup>Clicked location</Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
});

MapView.displayName = 'MapView';

export default MapView;