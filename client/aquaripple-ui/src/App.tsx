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
        <div className="flex flex-col h-screen bg-gray-50">
            <Header />
            <main className="flex-1 overflow-hidden flex">
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-3 border-b border-gray-200 bg-white">
                        <MapSearch />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <MapView onLocationSelect={setClickedLocation} />
                    </div>
                </div>
                <aside className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
                    <MapInfo clickedLocation={clickedLocation} />
                </aside>
            </main>
            <Footer />
        </div>
    );
}

export default App;