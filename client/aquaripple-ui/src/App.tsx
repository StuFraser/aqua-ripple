import './App.css'
import 'leaflet/dist/leaflet.css'
import { useRef, useState } from 'react'
import Header from './layout/header'
import Footer from './layout/footer'
import About from './layout/about'
import MapSearch from './components/map-search'
import MapView, { type MapViewHandle } from './components/map-view'
import MapInfo from './components/map-info'

function App() {
    const [currentView, setCurrentView] = useState<"map" | "about">("map");
    const [clickedLocation, setClickedLocation] = useState<[number, number] | undefined>(undefined);
    const mapRef = useRef<MapViewHandle>(null);
    const [mobileTab, setMobileTab] = useState<"map" | "info">("map");

    const handleSearchSelect = (lat: number, lng: number) => {
        mapRef.current?.flyTo(lat, lng);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <Header currentView={currentView} onNavigate={setCurrentView} />

            {currentView === "about" ? (
                <main className="flex-1 overflow-y-auto bg-white">
                    <div className="max-w-screen-2xl mx-auto px-4 py-8">
                        <About />
                    </div>
                </main>
            ) : (
                <main className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Mobile tab bar */}
                    <div className="flex md:hidden border-b border-gray-200 bg-white shrink-0">
                        <button
                            onClick={() => setMobileTab("map")}
                            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mobileTab === "map" ? "text-aqua-brand border-b-2 border-aqua-brand" : "text-gray-400"}`}
                        >
                            🗺 Map
                        </button>
                        <button
                            onClick={() => setMobileTab("info")}
                            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mobileTab === "info" ? "text-aqua-brand border-b-2 border-aqua-brand" : "text-gray-400"}`}
                        >
                            📍 Location Info
                        </button>
                    </div>

                    {/* Map column */}
                    <div className={`flex-1 flex flex-col min-w-0 ${mobileTab === "info" ? "hidden md:flex" : "flex"}`}>
                        <div className="p-3 border-b border-gray-200 bg-white flex items-center gap-2">
                            <MapSearch onResultSelect={handleSearchSelect} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <MapView ref={mapRef} onLocationSelect={(loc) => {
                                setClickedLocation(loc);
                                setMobileTab("info"); // auto-switch to info after pin drop
                            }} />
                        </div>
                    </div>

                    {/* Sidebar — full width on mobile, fixed 320px on desktop */}
                    <aside className={`
        md:w-80 md:shrink-0 md:border-l md:border-gray-200 md:block
        w-full overflow-y-auto bg-white
        ${mobileTab === "map" ? "hidden md:block" : "block flex-1"}
    `}>
                        <MapInfo clickedLocation={clickedLocation} />
                    </aside>

                </main>
            )}

            <Footer />
        </div>
    );
}

export default App;