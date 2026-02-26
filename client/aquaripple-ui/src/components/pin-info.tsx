import React from "react";
import { useQuery } from "@tanstack/react-query";

interface LocationLookupResponse {
    isWaterBody: boolean;
    waterBodyName: string | null;
    message: string | null;
}

interface PinInfoProps {
    clickedLocation: [number, number] | undefined;
}

const fetchLocationInfo = async (lat: number, lng: number): Promise<LocationLookupResponse> => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
    });

    if (!response.ok) {
        throw new Error('Location lookup failed');
    }

    return response.json();
};

const PinInfo: React.FC<PinInfoProps> = ({ clickedLocation }) => {

    const { data, isFetching, isError } = useQuery({
        queryKey: ['location', clickedLocation],
        queryFn: () => fetchLocationInfo(clickedLocation![0], clickedLocation![1]),
        enabled: !!clickedLocation
    });

    if (!clickedLocation) {
        return <p className="text-sm text-gray-400">Drop a pin on the map to get started.</p>;
    }

    if (isFetching) {
        return <p className="text-sm text-gray-500">Looking up location...</p>;
    }

    if (isError) {
        return <p className="text-sm text-red-500">Failed to look up location. Please try again.</p>;
    }

    return (
        <div className="text-sm">
            <p className="font-medium">{data?.isWaterBody ? `💧 ${data.waterBodyName ?? 'Water Body'}` : '🏝 Not a water body'}</p>
            {data?.message && <p className="text-gray-500 mt-1">{data.message}</p>}
        </div>
    );
}

export default PinInfo;