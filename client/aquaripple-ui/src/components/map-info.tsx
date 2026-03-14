import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Card from "./primitives/card";
import PinInfo from "./pin-info";
import LocationResults from "./location-results";

interface LocationLookupResponse {
    isWaterBody: boolean;
    waterBodyName: string | null;
    message: string | null;
}

interface MapInfoProps {
    clickedLocation: [number, number] | undefined;
}

const fetchLocationInfo = async (lat: number, lng: number): Promise<LocationLookupResponse> => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
    });
    if (!response.ok) throw new Error('Location lookup failed');
    return response.json();
};

const MapInfo: React.FC<MapInfoProps> = ({ clickedLocation }) => {

    // Single source of truth for the location lookup — shared down to children
    const { data: locationData } = useQuery({
        queryKey: ['location', clickedLocation],
        queryFn: () => fetchLocationInfo(clickedLocation![0], clickedLocation![1]),
        enabled: !!clickedLocation,
    });

    return (
        <div className="flex flex-col gap-4 p-4">
            <Card title="Pin Info">
                <PinInfo
                    clickedLocation={clickedLocation}
                    locationData={locationData}
                />
            </Card>

            {clickedLocation && (
                <Card title="Water Quality">
                    <LocationResults
                        clickedLocation={clickedLocation}
                        isWaterBody={locationData?.isWaterBody}
                    />
                </Card>
            )}
        </div>
    );
};

export default MapInfo;