import PinInfo from "./pin-info";
import LocationResults from "./location-results";
import type LocationLookupResponse from "../types/LocationLookupResponse";
import { useCheckWet } from "../hooks/useApi";

interface MapInfoProps {
    clickedLocation: [number, number] | undefined;
}

const MapInfo: React.FC<MapInfoProps> = ({ clickedLocation }) => {
    const { data: locationData, isLoading, isError } = useCheckWet(
        clickedLocation?.[0] ?? 0,
        clickedLocation?.[1] ?? 0
    );

    if (!clickedLocation) return null;

    return (
        <div className="flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-aqua-dark uppercase tracking-wider">Location Info</h2>

            {isError && (
                <p className="text-xs text-red-400">Failed to look up location.</p>
            )}

            {isLoading && (
                <p className="text-xs text-gray-400">Loading location data...</p>
            )}

            <PinInfo
                clickedLocation={clickedLocation}
                locationData={locationData as LocationLookupResponse}
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