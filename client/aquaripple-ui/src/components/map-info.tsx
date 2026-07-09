import PinInfo from "./pin-info";
import LocationResults from "./location-results";
import type LocationLookupResponse from "../types/LocationLookupResponse";
import type { AnalysisMode } from "../types/Wateranalysisresponse";
import { useCheckWet } from "../hooks/useApi";

interface MapInfoProps {
    clickedLocation: [number, number] | undefined;
    mode: AnalysisMode;
}

const MapInfo: React.FC<MapInfoProps> = ({ clickedLocation, mode }) => {
    const { data: locationData, isLoading, isError } = useCheckWet(
        clickedLocation?.[0] ?? 0,
        clickedLocation?.[1] ?? 0
    );

    return (
        <div className="flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-aqua-dark uppercase tracking-wider">Location Info</h2>

            {isError && (
                <p className="text-xs text-red-400">Failed to look up location.</p>
            )}

            {isLoading && (
                <p className="text-xs text-gray-400">Loading location data...</p>
            )}

            {/* PinInfo renders its own "drop a pin to get started" empty state when
                clickedLocation is undefined — on mobile this is a tab a user navigates
                to deliberately, so it must never render as a blank screen. */}
            <PinInfo
                clickedLocation={clickedLocation}
                locationData={locationData as LocationLookupResponse}
            />

            {clickedLocation && (
                <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-aqua-dark uppercase tracking-wider">Water Quality</h2>
                    <LocationResults
                        clickedLocation={clickedLocation}
                        isWaterBody={locationData?.is_water}
                        waterName={locationData?.name}
                        mode={mode}
                    />
                </div>
            )}
        </div>
    );
};

export default MapInfo;