import './App.css'
import 'leaflet/dist/leaflet.css'
import { useState } from 'react'
import Header from './layout/header'
import Footer from './layout/footer'
import MapSearch from './components/map-search'
import MapView from './components/map-view'
import MapInfo from './components/map-info'

function App() {
    const [clickedLocation, setClickedLocation] = useState<[number, number] | undefined>(undefined);

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 flex gap-4">
                <div className="flex-1 min-w-0">
                    <MapSearch />
                    <MapView onLocationSelect={setClickedLocation} />
                </div>
                <div className="w-80 shrink-0">
                    <MapInfo clickedLocation={clickedLocation} />
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default App