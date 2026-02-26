import React from "react";
import PinInfo from "./pin-info";
import LocationResults from "./location-results";

interface MapInfoProps {
    clickedLocation: [number, number] | undefined;
}

const MapInfo: React.FC<MapInfoProps> = ({ clickedLocation }) => {

    return (
        <div>
            <PinInfo clickedLocation={clickedLocation} />
            <LocationResults />
        </div>
    )

}
export default MapInfo;