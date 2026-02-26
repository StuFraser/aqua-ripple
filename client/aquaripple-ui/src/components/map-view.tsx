import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

const getLocationErrorMessage = (error: GeolocationPositionError): string => {
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

interface MapViewProps {
    onLocationSelect: (location: [number, number]) => void;
}

const MapView: React.FC<MapViewProps> = ({ onLocationSelect }) => {

    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [clickedMarker, setClickedMarker] = useState<[number, number] | undefined>(undefined);
    const [locationError, setLocationError] = useState<GeolocationPositionError | null>(null);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation([
                    position.coords.latitude,
                    position.coords.longitude
                ]);
            },
            (error) => {
                setLocationError(error);
                setUserLocation([-38.68, 176.005]);
            }
        );
    }, []);

    const userPin = L.icon({
        iconUrl: icon,
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });

    const standardPin = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
    });
    L.Marker.prototype.options.icon = standardPin;

    const handleMapClick = (lat: number, lng: number) => {
        const location: [number, number] = [lat, lng];
        setClickedMarker(location);
        onLocationSelect(location);
    };

    if (!userLocation) {
        return <div>Loading map...</div>;
    }

    return (
        <>
            {locationError && (
                <div className="flex items-center gap-2 px-4 py-2 mb-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-300 rounded-md">
                    <span>⚠️</span>
                    <span>{getLocationErrorMessage(locationError)}</span>
                </div>
            )}
            <MapContainer
                center={userLocation}
                zoom={13}
                style={{ height: '55em', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={false}
                doubleClickZoom={true}
                dragging={true}
            >
                <MapClickHandler onMapClick={handleMapClick} />
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />
                {userLocation && (
                    <Marker position={userLocation} icon={userPin}>
                        <Popup>You are here</Popup>
                    </Marker>
                )}
                {clickedMarker && (
                    <Marker position={clickedMarker}>
                        <Popup>Clicked location</Popup>
                    </Marker>
                )}
            </MapContainer>
        </>
    )
}

export default MapView;