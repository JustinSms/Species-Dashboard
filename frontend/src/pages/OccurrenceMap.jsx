import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getSpecies, getOccurrencePoints, searchSpecies } from '../api';
import IUCNBadge from '../components/IUCNBadge';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const OccurrenceMap = () => {
  const { gbifKey } = useParams();
  const navigate = useNavigate();

  const [points, setPoints] = useState([]);
  const [species, setSpecies] = useState(null);
  const [yearFilter, setYearFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch species data and occurrence points
  useEffect(() => {
    if (!gbifKey) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [speciesData, pointsData] = await Promise.all([
          getSpecies(gbifKey),
          getOccurrencePoints(gbifKey)
        ]);
        setSpecies(speciesData);
        setPoints(pointsData.points || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gbifKey]);

  // Calculate year range
  const years = points.map(p => p.year).filter(y => y != null);
  const minYear = years.length > 0 ? Math.min(...years) : 2000;
  const maxYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();

  // Filter points by year
  const filteredPoints = yearFilter === null 
    ? points 
    : points.filter(p => p.year === yearFilter);

  // Color interpolation from blue (oldest) to red (most recent)
  const colorByYear = (year) => {
    if (!year || maxYear === minYear) return '#1565c0';
    const ratio = (year - minYear) / (maxYear - minYear);
    
    // Interpolate from blue (#1565c0) to red (#c62828)
    const startR = 0x15, startG = 0x65, startB = 0xc0;
    const endR = 0xc6, endG = 0x28, endB = 0x28;
    
    const r = Math.round(startR + (endR - startR) * ratio);
    const g = Math.round(startG + (endG - startG) * ratio);
    const b = Math.round(startB + (endB - startB) * ratio);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Handle species search
  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      const data = await searchSpecies(query);
      setSearchResults(data.results || []);
      setShowDropdown(true);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // Select species from search results
  const selectSpecies = (key) => {
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/map/${key}`);
  };

  return (
    <div>
      <h1 className="page-title">Occurrence Map</h1>

      {/* Species Search Bar */}
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search for a species..."
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: '14px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            outline: 'none'
          }}
        />
        
        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            marginTop: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {searchResults.map((result) => (
              <div
                key={result.gbif_key}
                onClick={() => selectSpecies(result.gbif_key)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f5f5f5'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <div style={{ fontWeight: '500' }}>
                  {result.common_name || result.scientific_name}
                </div>
                <div style={{ fontSize: '12px', color: '#757575', fontStyle: 'italic' }}>
                  {result.scientific_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ color: '#757575' }}>Loading map data...</div>}

      {/* Species Header */}
      {species && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
            {species.common_name || species.scientific_name}
          </h2>
          <p style={{ fontStyle: 'italic', color: '#757575', marginBottom: '12px' }}>
            {species.scientific_name}
          </p>
          {species.iucn_status && <IUCNBadge status={species.iucn_status} />}
        </div>
      )}

      {/* Year Filter Controls */}
      {points.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={yearFilter === null}
                onChange={(e) => setYearFilter(e.target.checked ? null : maxYear)}
              />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>All years</span>
            </label>
          </div>

          {yearFilter !== null && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Year: {yearFilter}
              </label>
              <input
                type="range"
                min={minYear}
                max={maxYear}
                value={yearFilter || maxYear}
                onChange={(e) => setYearFilter(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#757575' }}>
                <span>{minYear}</span>
                <span>{maxYear}</span>
              </div>
            </div>
          )}

          <p style={{ marginTop: '12px', fontSize: '14px', color: '#555' }}>
            Showing {filteredPoints.length} of {points.length} occurrences
          </p>
        </div>
      )}

      {/* Map */}
      {points.length > 0 ? (
        <div className="card">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '500px', borderRadius: '8px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredPoints.map((point, idx) => (
              <CircleMarker
                key={idx}
                center={[point.lat, point.lng]}
                radius={4}
                fillColor={colorByYear(point.year)}
                fillOpacity={0.75}
                stroke={false}
              >
                <Popup>
                  <div>
                    <strong>Year:</strong> {point.year || 'Unknown'}<br />
                    <strong>Country:</strong> {point.countryCode || 'Unknown'}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      ) : (
        !loading && gbifKey && (
          <div className="card">
            <p style={{ color: '#757575' }}>No occurrence data available for this species.</p>
          </div>
        )
      )}

      {!gbifKey && !loading && (
        <div className="card">
          <p style={{ color: '#757575' }}>Search for a species to view its occurrence map.</p>
        </div>
      )}
    </div>
  );
};

export default OccurrenceMap;
