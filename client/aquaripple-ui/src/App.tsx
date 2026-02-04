import './App.css'
import 'leaflet/dist/leaflet.css'
import Header from './layout/header'
import Footer from './layout/footer'
import MapSearch from './components/map-search'
import MapView from './components/map-view'

function App() {

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      
      <Header />

      <main className="flex-1 overflow-y-auto p-4">
        <MapSearch />
        <MapView />
      </main>

      <Footer />
      
    </div>
  );
}

export default App
