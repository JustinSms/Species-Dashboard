// Get React utilities
const { useState, useEffect, useRef } = React;
const { BrowserRouter, Routes, Route, NavLink, useNavigate, useParams } = window.ReactRouterDOM;

// API Configuration
const API_BASE_URL = '/api';

// API Client
const api = {
  searchSpecies: async (q) => {
    const response = await axios.get(`${API_BASE_URL}/species/search`, { params: { q } });
    return response.data;
  },
  getSpecies: async (gbifKey) => {
    const response = await axios.get(`${API_BASE_URL}/species/${gbifKey}`);
    return response.data;
  },
  getOccurrencePoints: async (gbifKey, limit = 500) => {
    const response = await axios.get(`${API_BASE_URL}/species/${gbifKey}/occurrence-points`, { params: { limit } });
    return response.data;
  },
  getTrends: async (gbifKey) => {
    const response = await axios.get(`${API_BASE_URL}/analysis/trends/${gbifKey}`);
    return response.data;
  },
  getRegion: async (iso2) => {
    const response = await axios.get(`${API_BASE_URL}/analysis/region/${iso2}`);
    return response.data;
  },
  sendChat: async (question, speciesContext = null, filterByStatus = null) => {
    const response = await axios.post(`${API_BASE_URL}/chat`, {
      question,
      species_context: speciesContext,
      filter_by_status: filterByStatus
    });
    return response.data;
  },
  getChatSuggestions: async () => {
    const response = await axios.get(`${API_BASE_URL}/chat/suggestions`);
    return response.data;
  }
};

// IUCN Badge Component
function IUCNBadge({ status }) {
  const statusConfig = {
    'CR': { label: 'Critically Endangered', bg: '#b71c1c', textColor: 'white' },
    'EN': { label: 'Endangered', bg: '#e65100', textColor: 'white' },
    'VU': { label: 'Vulnerable', bg: '#f57f17', textColor: 'white' },
    'NT': { label: 'Near Threatened', bg: '#558b2f', textColor: 'white' },
    'LC': { label: 'Least Concern', bg: '#2e7d32', textColor: 'white' },
    'DD': { label: 'Data Deficient', bg: '#757575', textColor: 'white' }
  };
  
  const config = statusConfig[status] || { label: 'Not Assessed', bg: '#bdbdbd', textColor: '#333' };
  
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      background: config.bg,
      color: config.textColor
    }}>
      {config.label}
    </span>
  );
}

// Species Card Component
function SpeciesCard({ gbif_key, scientific_name, common_name, iucn_status, iucn_trend }) {
  const navigate = useNavigate();
  
  const getTrendDisplay = (trend) => {
    if (!trend) return null;
    const trendLower = trend.toLowerCase();
    if (trendLower === 'decreasing') {
      return <span style={{ color: '#d32f2f', fontSize: '18px', marginLeft: '8px' }}>↓</span>;
    } else if (trendLower === 'increasing') {
      return <span style={{ color: '#2e7d32', fontSize: '18px', marginLeft: '8px' }}>↑</span>;
    } else {
      return <span style={{ color: '#757575', fontSize: '18px', marginLeft: '8px' }}>→</span>;
    }
  };
  
  return (
    <div
      className="card"
      onClick={() => navigate(`/map/${gbif_key}`)}
      style={{ cursor: 'pointer', transition: 'box-shadow 0.2s ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
    >
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1a1a1a' }}>
        {common_name || scientific_name}
      </h3>
      <p style={{ fontStyle: 'italic', color: '#757575', fontSize: '14px', marginBottom: '12px' }}>
        {scientific_name}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {iucn_status && <IUCNBadge status={iucn_status} />}
        {iucn_trend && getTrendDisplay(iucn_trend)}
      </div>
    </div>
  );
}

// Discover Page Component
function Discover() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const featuredIds = [2374413, 2435099, 2433551, 5219404];
        const promises = featuredIds.map(id => api.getSpecies(id).catch(() => null));
        const species = await Promise.all(promises);
        setFeatured(species.filter(s => s !== null));
      } catch (err) {
        console.error('Error fetching featured species:', err);
      }
    };
    fetchFeatured();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Please enter a species name');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.searchSpecies(query);
      setResults(data.results || []);
    } catch (err) {
      setError('Error searching for species. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasSearched = results.length > 0 || loading || error;

  return (
    <div>
      <h1 className="page-title">Discover Species</h1>
      
      <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by scientific or common name..."
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-primary">Search</button>
        </div>
      </form>

      {error && <div style={{ color: '#d32f2f', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading && <div style={{ color: '#757575', marginBottom: '16px' }}>Searching...</div>}

      {hasSearched && !loading && (
        <div>
          {results.length > 0 ? (
            <>
              <p style={{ marginBottom: '16px', color: '#555' }}>Found {results.length} species</p>
              <div className="grid-2col">
                {results.map((species) => (
                  <SpeciesCard key={species.gbif_key} {...species} />
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#757575' }}>No species found for '{query}' — try the scientific name</p>
          )}
        </div>
      )}

      {!hasSearched && featured.length > 0 && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
            Featured Threatened Species
          </h2>
          <div className="grid-2col">
            {featured.map((species) => (
              <SpeciesCard key={species.gbif_key} {...species} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder components for other pages
function OccurrenceMap() {
  return (
    <div>
      <h1 className="page-title">Occurrence Map</h1>
      <div className="card">
        <p className="text-center text-gray">Map visualization coming soon...</p>
        <p className="text-center text-gray text-sm">This requires Leaflet integration</p>
      </div>
    </div>
  );
}

function TrendAnalysis() {
  return (
    <div>
      <h1 className="page-title">Population Trends</h1>
      <div className="card">
        <p className="text-center text-gray">Trend analysis coming soon...</p>
        <p className="text-center text-gray text-sm">This requires Recharts integration</p>
      </div>
    </div>
  );
}

function Chat() {
  return (
    <div>
      <h1 className="page-title">Biodiversity Chat</h1>
      <div className="card">
        <p className="text-center text-gray">Chat interface coming soon...</p>
        <p className="text-center text-gray text-sm">RAG-powered Q&A system</p>
      </div>
    </div>
  );
}

function RegionalView() {
  return (
    <div>
      <h1 className="page-title">Regional Biodiversity</h1>
      <div className="card">
        <p className="text-center text-gray">Regional analysis coming soon...</p>
        <p className="text-center text-gray text-sm">Country-based species assessment</p>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <BrowserRouter>
      <div className="sidebar">
        <div className="sidebar-title">
          🌿 Biodiversity Intelligence
        </div>
        <nav>
          <NavLink to="/" className="nav-link">🔍 Discover</NavLink>
          <NavLink to="/map" className="nav-link">🗺️ Occurrence Map</NavLink>
          <NavLink to="/trends" className="nav-link">📈 Trend Analysis</NavLink>
          <NavLink to="/chat" className="nav-link">💬 Chat</NavLink>
          <NavLink to="/region" className="nav-link">🌍 Regional View</NavLink>
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

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
