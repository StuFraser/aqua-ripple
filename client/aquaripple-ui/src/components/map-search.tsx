import React from "react";

const MapSearch: React.FC = () => {
    return (
        <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <span className="absolute inset-y-0 left-3 flex items-center text-aqua-brand pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                </span>
                <input
                    type="text"
                    placeholder="Search for a location..."
                    disabled
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-400 placeholder-gray-400 cursor-not-allowed focus:outline-none"
                />
            </div>
            <span className="text-xs text-gray-400 italic whitespace-nowrap">Coming soon</span>
        </div>
    );
};

export default MapSearch;