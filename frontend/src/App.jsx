import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
import Discover from './pages/Discover';
import OccurrenceMap from './pages/OccurrenceMap';
import TrendAnalysis from './pages/TrendAnalysis';
import Chat from './pages/Chat';
import RegionalView from './pages/RegionalView';

function App() {
  return (
    <BrowserRouter>
      <div className="sidebar">
        <div style={{ padding: '20px', fontSize: '18px', fontWeight: '600', color: '#2e7d32' }}>
          🌿 Biodiversity Intelligence
        </div>
        
        <nav>
          <NavLink to="/" className="nav-link">
            🔍 Discover
          </NavLink>
          <NavLink to="/map" className="nav-link">
            🗺️ Occurrence Map
          </NavLink>
          <NavLink to="/trends" className="nav-link">
            📈 Trend Analysis
          </NavLink>
          <NavLink to="/chat" className="nav-link">
            💬 Chat
          </NavLink>
          <NavLink to="/region" className="nav-link">
            🌍 Regional View
          </NavLink>
        </nav>
      </div>

      <main className="main">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/map" element={<OccurrenceMap />} />
          <Route path="/map/:gbifKey" element={<OccurrenceMap />} />
          <Route path="/trends" element={<TrendAnalysis />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/region" element={<RegionalView />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
