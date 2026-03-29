import React, { useEffect, useState } from "react";
import PinInfo from "./pin-info";
import LocationResults from "./location-results";
import type LocationLookupResponse from "../types/LocationLookupResponse";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';


interface MapInfoProps {
    clickedLocation: [number, number] | undefined;
}

const MapInfo: React.FC<MapInfoProps> = ({ clickedLocation }) => {
    const [locationData, setLocationData] = useState<LocationLookupResponse | undefined>(undefined);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (!clickedLocation) return;

        setLocationData(undefined);
        setIsError(false);

        fetch(`${API_BASE}/api/getwet/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: clickedLocation[0], longitude: clickedLocation[1] }),
        })
            .then(res => {
                if (!res.ok) throw new Error('Lookup failed');
                return res.json();
            })

            .then(data => setLocationData(data))
            .catch(() => setIsError(true));
    }, [clickedLocation]);

    return (
        <div className="flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-aqua-dark uppercase tracking-wider">Location Info</h2>

            {isError && (
                <p className="text-xs text-red-400">Failed to look up location.</p>
            )}

            <PinInfo
                clickedLocation={clickedLocation}
                locationData={locationData}
            />

            <div className="border-t border-gray-100 pt-4">
                <h2 className="text-sm font-semibold text-aqua-dark uppercase tracking-wider mb-3">Water Quality</h2>
                <LocationResults
                    clickedLocation={clickedLocation}
                    isWaterBody={locationData?.is_water}
                    waterName={locationData?.name}
                />
            </div>
        </div>
    );
};

export default MapInfo;