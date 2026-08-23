import { useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { searchSpecies, getTrends } from '../api';
import IUCNBadge from '../components/IUCNBadge';

const COLORS = ['#1565c0', '#b71c1c', '#2e7d32'];

const TrendAnalysis = () => {
  const [compared, setCompared] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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

  // Add species to comparison
  const addSpecies = async (species) => {
    // Check if already added
    if (compared.some(s => s.gbif_key === species.gbif_key)) {
      setShowDropdown(false);
      setSearchQuery('');
      return;
    }

    // Check limit
    if (compared.length >= 3) {
      alert('Maximum 3 species can be compared');
      return;
    }

    setLoading(true);
    try {
      const trendData = await getTrends(species.gbif_key);
      setCompared([...compared, {
        gbif_key: species.gbif_key,
        scientific_name: species.scientific_name,
        common_name: species.common_name,
        iucn_status: species.iucn_status,
        trendData
      }]);
      setShowDropdown(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error fetching trends:', error);
      alert('Could not fetch trend data for this species');
    } finally {
      setLoading(false);
    }
  };

  // Remove species from comparison
  const removeSpecies = (gbifKey) => {
    setCompared(compared.filter(s => s.gbif_key !== gbifKey));
  };

  // Prepare chart data by merging all species' yearly data
  const prepareChartData = () => {
    if (compared.length === 0) return [];

    const allYears = new Set();
    compared.forEach(species => {
      species.trendData.yearly_data?.forEach(d => allYears.add(d.year));
    });

    const years = Array.from(allYears).sort((a, b) => a - b);
    
    return years.map(year => {
      const dataPoint = { year };
      compared.forEach((species, idx) => {
        const yearData = species.trendData.yearly_data?.find(d => d.year === year);
        const displayName = species.common_name || species.scientific_name;
        dataPoint[displayName] = yearData ? yearData.count : null;
      });
      return dataPoint;
    });
  };

  const chartData = prepareChartData();

  // Get trend display
  const getTrendDisplay = (trend) => {
    const trendLower = trend?.toLowerCase() || '';
    if (trendLower === 'decreasing') {
      return { icon: '↓', text: 'Decreasing', color: '#d32f2f' };
    } else if (trendLower === 'increasing') {
      return { icon: '↑', text: 'Increasing', color: '#2e7d32' };
    } else {
      return { icon: '→', text: 'Stable', color: '#757575' };
    }
  };

  return (
    <div>
      <h1 className="page-title">Population Trends</h1>

      {/* Species Search Bar */}
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search for a species to add to comparison..."
          disabled={compared.length >= 3}
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: '14px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            outline: 'none',
            opacity: compared.length >= 3 ? 0.6 : 1
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
                onClick={() => addSpecies(result)}
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

      {/* Species Chips */}
      {compared.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {compared.map((species, idx) => (
            <div
              key={species.gbif_key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'white',
                border: `2px solid ${COLORS[idx]}`,
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              <span style={{ color: COLORS[idx] }}>●</span>
              <span>{species.common_name || species.scientific_name}</span>
              <button
                onClick={() => removeSpecies(species.gbif_key)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#757575',
                  padding: 0,
                  marginLeft: '4px'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ color: '#757575', marginBottom: '16px' }}>Loading trend data...</div>}

      {/* Chart */}
      {compared.length > 0 && chartData.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis label={{ value: 'Observations', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {compared.map((species, idx) => {
                const displayName = species.common_name || species.scientific_name;
                return (
                  <Line
                    key={species.gbif_key}
                    type="monotone"
                    dataKey={displayName}
                    stroke={COLORS[idx]}
                    strokeWidth={2}
                    dot={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stat Cards */}
      {compared.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {compared.map((species, idx) => {
            const trend = getTrendDisplay(species.trendData.trend);
            const isSignificant = species.trendData.significant;
            const slope = species.trendData.slope || 0;

            return (
              <div
                key={species.gbif_key}
                className="card"
                style={{ 
                  flex: '1 1 300px',
                  borderLeft: `4px solid ${COLORS[idx]}`
                }}
              >
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  {species.common_name || species.scientific_name}
                </h3>
                <p style={{ 
                  fontStyle: 'italic', 
                  color: '#757575', 
                  fontSize: '14px',
                  marginBottom: '12px'
                }}>
                  {species.scientific_name}
                </p>

                {species.iucn_status && (
                  <div style={{ marginBottom: '12px' }}>
                    <IUCNBadge status={species.iucn_status} />
                  </div>
                )}

                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ fontSize: '14px' }}>Trend:</strong>{' '}
                  <span style={{ color: trend.color, fontSize: '16px' }}>
                    {trend.icon}
                  </span>{' '}
                  <span style={{ color: trend.color, fontWeight: '500' }}>
                    {trend.text}
                  </span>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: isSignificant ? '#e8f5e9' : '#f5f5f5',
                      color: isSignificant ? '#2e7d32' : '#757575'
                    }}
                  >
                    {isSignificant 
                      ? `Significant (p=${species.trendData.p_value?.toFixed(4) || 'N/A'})` 
                      : 'Not significant'}
                  </span>
                </div>

                <div style={{ fontSize: '14px' }}>
                  <strong>Slope:</strong>{' '}
                  {slope > 0 ? '+' : ''}{slope.toFixed(2)} obs/year
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {compared.length === 0 && !loading && (
        <div className="card">
          <p style={{ color: '#757575', textAlign: 'center', padding: '40px 20px' }}>
            Search for a species above to analyse its population trend
          </p>
        </div>
      )}
    </div>
  );
};

export default TrendAnalysis;
