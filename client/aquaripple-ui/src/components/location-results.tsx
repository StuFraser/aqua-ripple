import React from "react";
import { useQuery } from "@tanstack/react-query";
import Badge from "./primitives/badge";

interface WaterQualityResponse {
    ndwi: number | null;
    chlorophyllA: number | null;
    qualityLabel: string | null;
    message: string | null;
    capturedAt: string | null;
}

interface LocationResultsProps {
    clickedLocation: [number, number] | undefined;
    isWaterBody: boolean | undefined;
}

const fetchWaterQuality = async (lat: number, lng: number): Promise<WaterQualityResponse> => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/getwet/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
    });
    if (!response.ok) throw new Error('Water quality lookup failed');
    return response.json();
};

function ndwiLabel(ndwi: number): { label: string; variant: "water" | "warning" | "land" } {
    if (ndwi > 0.3)  return { label: "Clear water",       variant: "water" };
    if (ndwi > 0)    return { label: "Moderate water",    variant: "info" as any };
    if (ndwi > -0.1) return { label: "Turbid / shallow",  variant: "warning" };
    return               { label: "Non-water surface",   variant: "land" };
}

function chlorophyllLabel(chl: number): { label: string; variant: "water" | "warning" | "land" } {
    if (chl < 2)   return { label: "Low (healthy)",     variant: "water" };
    if (chl < 10)  return { label: "Moderate",          variant: "info" as any };
    if (chl < 50)  return { label: "Elevated (algae?)", variant: "warning" };
    return              { label: "High (bloom risk)",  variant: "land" };
}

interface MetricRowProps {
    label: string;
    value: string;
    subLabel?: string;
    variant?: "water" | "warning" | "land" | "info";
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, subLabel, variant = "info" }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-aqua-dark">{value}</span>
            {subLabel && <Badge variant={variant}>{subLabel}</Badge>}
        </div>
    </div>
);

const LocationResults: React.FC<LocationResultsProps> = ({ clickedLocation, isWaterBody }) => {

    const { data, isFetching, isError } = useQuery({
        queryKey: ['water-quality', clickedLocation],
        queryFn: () => fetchWaterQuality(clickedLocation![0], clickedLocation![1]),
        enabled: !!clickedLocation && isWaterBody === true,
    });

    // No pin dropped yet
    if (!clickedLocation) return null;

    // Pin on land — no water quality data to show
    if (isWaterBody === false) {
        return (
            <div className="py-4 text-center">
                <p className="text-xs text-gray-400">Pin a location on a water body to see quality data.</p>
            </div>
        );
    }

    // Still waiting on the isWaterBody check
    if (isWaterBody === undefined) return null;

    if (isFetching) {
        return (
            <div className="flex items-center gap-2 py-4 text-sm text-aqua-dark">
                <svg className="animate-spin h-4 w-4 text-aqua-brand" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Fetching water quality data...
            </div>
        );
    }

    if (isError) {
        return <Badge variant="warning">⚠ Water quality data unavailable</Badge>;
    }

    const ndwi = data?.ndwi;
    const chl  = data?.chlorophyllA;

    return (
        <div className="flex flex-col gap-1">
            {data?.qualityLabel && (
                <div className="mb-2">
                    <Badge variant="water">{data.qualityLabel}</Badge>
                </div>
            )}

            {ndwi !== null && ndwi !== undefined && (
                <MetricRow
                    label="NDWI"
                    value={ndwi.toFixed(3)}
                    subLabel={ndwiLabel(ndwi).label}
                    variant={ndwiLabel(ndwi).variant}
                />
            )}

            {chl !== null && chl !== undefined && (
                <MetricRow
                    label="Chlorophyll-a"
                    value={`${chl.toFixed(1)} µg/L`}
                    subLabel={chlorophyllLabel(chl).label}
                    variant={chlorophyllLabel(chl).variant}
                />
            )}

            {data?.message && (
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{data.message}</p>
            )}

            {data?.capturedAt && (
                <p className="text-xs text-gray-300 mt-1">
                    Satellite pass: {new Date(data.capturedAt).toLocaleDateString()}
                </p>
            )}
        </div>
    );
};

export default LocationResults;