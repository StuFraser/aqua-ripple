import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const MapView: React.FC = () => {

    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [clickedMarker, setClickedMarker] = useState<[number, number]>();

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation([
                    position.coords.latitude,
                    position.coords.longitude
                ]);
            },
            (error) => {
                setUserLocation([176.005, -38.68]);
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

    function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
        useMapEvents({
            click: (e) => {
                onMapClick(e.latlng.lat, e.latlng.lng);
            },
        });
        return null; // This component doesn't render anything
    }
    const handleMapClick = (lat: number, lng: number) => {
        setClickedMarker([lat, lng]);
    };

    if (!userLocation) {
        return <div>Loading map...</div>;
    }

    return (
        <MapContainer
            center={userLocation}
            zoom={13}
            style={{ height: '55em', width: '100%' }}
            zoomControl={true} // Disable default zoom control
            scrollWheelZoom={false} // Allow scroll to zoom (default: true)
            doubleClickZoom={true} // Double-click to zoom
            dragging={true}

        >
            <MapClickHandler onMapClick={handleMapClick} />
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
            />
            {clickedMarker && (
                <Marker position={clickedMarker}>
                    <Popup>Clicked location</Popup>
                </Marker>
            )}
        </MapContainer>
    )

}
export default MapView;