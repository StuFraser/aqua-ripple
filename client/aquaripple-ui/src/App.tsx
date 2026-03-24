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
                <main className="flex-1 overflow-hidden flex">
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="p-3 border-b border-gray-200 bg-white flex items-center gap-2">
                            <MapSearch onResultSelect={handleSearchSelect} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <MapView ref={mapRef} onLocationSelect={setClickedLocation} />
                        </div>
                    </div>
                    <aside className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
                        <MapInfo clickedLocation={clickedLocation} />
                    </aside>
                </main>
            )}

            <Footer />
        </div>
    );
}

export default App;