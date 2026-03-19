import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

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

type CacheStatus = 'idle' | 'warming' | 'ready';

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

async function warmCache(
    lat: number,
    lng: number,
    onStart: () => void,
    onComplete: () => void,
): Promise<void> {
    onStart();
    try {
        console.log('ApiBase: ', API_BASE)
        await fetch(`${API_BASE}/api/getwet/warm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
        });
    } catch (err) {
        console.warn('[AquaRipple] Cache warm failed:', err);
    } finally {
        onComplete();
    }
}

// ── Cache toast overlay ─────────────────────────────────────────────────────

interface CacheToastProps {
    status: CacheStatus;
}

function CacheToast({ status }: CacheToastProps) {
    const visible = status !== 'idle';

    return (
        <div
            className="absolute bottom-6 left-1/2 z-[1000] pointer-events-none"
            style={{
                transform: `translateX(-50%) translateY(${visible ? '0' : '120%'})`,
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
                    backdropFilter: 'blur(6px)',
                    whiteSpace: 'nowrap',
                    // Swap colours based on status
                    background: status === 'ready'
                        ? 'rgba(140, 198, 63, 0.92)'   // --color-ripple (green)
                        : 'rgba(0, 156, 222, 0.92)',    // --color-aqua-brand (blue)
                    color: '#fff',
                    transition: 'background 0.3s ease',
                }}
            >
                {status === 'warming' ? (
                    <>
                        <WarmingSpinner />
                        Warming cache
                    </>
                ) : (
                    <>
                        <CheckIcon />
                        Cache ready
                    </>
                )}
            </div>
        </div>
    );
}

function WarmingSpinner() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}
        >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
            <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
        >
            <polyline
                points="2.5,7 5.5,10 11.5,4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// ── Map event handler ───────────────────────────────────────────────────────

interface MapEventHandlerProps {
    onMapClick: (lat: number, lng: number) => void;
    lastWarmedLocationRef: React.MutableRefObject<[number, number] | null>;
    onWarmStart: () => void;
    onWarmComplete: () => void;
}

function MapEventHandler({ onMapClick, lastWarmedLocationRef, onWarmStart, onWarmComplete }: MapEventHandlerProps) {
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
                warmCache(lat, lng, onWarmStart, onWarmComplete);
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

// ── Component ───────────────────────────────────────────────────────────────

interface MapViewProps {
    onLocationSelect: (location: [number, number]) => void;
}

const MapView: React.FC<MapViewProps> = ({ onLocationSelect }) => {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [clickedMarker, setClickedMarker] = useState<[number, number] | undefined>(undefined);
    const [locationError, setLocationError] = useState<GeolocationPositionError | null>(null);
    const [cacheStatus, setCacheStatus] = useState<CacheStatus>('idle');
    const lastWarmedLocationRef = useRef<[number, number] | null>(null);
    const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleWarmStart = () => {
        // Cancel any pending "idle" timer from a previous warm cycle
        if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
        setCacheStatus('warming');
        console.log("Cache Starting")
    };

    const handleWarmComplete = () => {
        setCacheStatus('ready');
        readyTimerRef.current = setTimeout(() => setCacheStatus('idle'), 2000);
        console.log("Cache complete")
    };

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
                setUserLocation(loc);
                lastWarmedLocationRef.current = loc;
                warmCache(loc[0], loc[1], handleWarmStart, handleWarmComplete);
            },
            (error) => {
                setLocationError(error);
                setUserLocation(DEFAULT_LOCATION);
                lastWarmedLocationRef.current = DEFAULT_LOCATION;
                warmCache(DEFAULT_LOCATION[0], DEFAULT_LOCATION[1], handleWarmStart, handleWarmComplete);
            }
        );

        return () => {
            if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
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
            <MapContainer
                center={userLocation}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={false}
                doubleClickZoom={true}
                dragging={true}
            >
                <MapEventHandler
                    onMapClick={handleMapClick}
                    lastWarmedLocationRef={lastWarmedLocationRef}
                    onWarmStart={handleWarmStart}
                    onWarmComplete={handleWarmComplete}
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

            <CacheToast status={cacheStatus} />
        </div>
    );
};

export default MapView;