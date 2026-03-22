import React from "react";
import Badge from "./primitives/badge";
import type LocationLookupResponse from "../types/LocationLookupResponse";


interface PinInfoProps {
    clickedLocation: [number, number] | undefined;
    locationData: LocationLookupResponse | undefined;
}

const PinInfo: React.FC<PinInfoProps> = ({ clickedLocation, locationData: data }) => {
    const isFetching = !!clickedLocation && !data;
    const isError = false; // errors handled in MapInfo

    if (!clickedLocation) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-aqua-brand/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-400">Drop a pin on the map to get started.</p>
            </div>
        );
    }

    if (isFetching) {
        return (
            <div className="flex items-center gap-2 py-4 text-sm text-aqua-dark">
                <svg className="animate-spin h-4 w-4 text-aqua-brand" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Looking up location...
            </div>
        );
    }

    if (isError) {
        return <Badge variant="warning">⚠ Failed to look up location</Badge>;
    }

    return (
        <div className="flex flex-col gap-2">
            <Badge variant={data?.is_water ? "water" : "land"}>
                {data?.is_water ? "💧 " : "🏝 "}
                {data?.is_water ? (data.name ?? "Water Body") : "Not a water body"}
            </Badge>
            {/* {data?.message && (
                <p className="text-xs text-gray-500 leading-relaxed">{data.message}</p>
            )} */}
            <p className="text-xs text-gray-300 font-mono">
                {clickedLocation[0].toFixed(5)}, {clickedLocation[1].toFixed(5)}
            </p>
        </div>
    );
};

export default PinInfo;