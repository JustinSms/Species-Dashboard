import { useState } from 'react';
import { getRegion, sendChat } from '../api';
import IUCNBadge from '../components/IUCNBadge';

const EU_COUNTRIES = [
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'CZ', name: 'Czechia', flag: '🇨🇿' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'GB', name: 'UK', flag: '🇬🇧' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' }
];

const RegionalView = () => {
  const [selected, setSelected] = useState(null);
  const [regionData, setRegionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Handle country selection
  const selectCountry = async (country) => {
    setSelected(country);
    setRegionData(null);
    setAiSummary('');
    setLoading(true);

    try {
      const data = await getRegion(country.code);
      setRegionData(data);
    } catch (error) {
      console.error('Error fetching region data:', error);
      setRegionData({ species: [], total_assessed: 0, threatened_count: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Generate AI conservation brief
  const generateBrief = async () => {
    if (!selected) return;

    setSummaryLoading(true);
    try {
      const response = await sendChat(
        `Write a regional biodiversity conservation brief for ${selected.name}. Summarise the key threatened species, their main threats, and relevant Kunming-Montreal targets.`,
        null,
        null
      );
      setAiSummary(response.answer);
    } catch (error) {
      console.error('Error generating brief:', error);
      setAiSummary('Error generating conservation brief. Please try again.');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Sort species by threat level
  const sortedSpecies = regionData?.species ? [...regionData.species].sort((a, b) => {
    const order = { 'CR': 1, 'EN': 2, 'VU': 3 };
    return (order[a.category] || 999) - (order[b.category] || 999);
  }) : [];

  // Calculate percentage
  const threatenedPct = regionData && regionData.total_assessed > 0
    ? ((regionData.threatened_count / regionData.total_assessed) * 100).toFixed(1)
    : 0;

  // Calculate progress bar width
  const progressWidth = regionData && regionData.total_assessed > 0
    ? (regionData.threatened_count / regionData.total_assessed) * 100
    : 0;

  return (
    <div>
      <h1 className="page-title">Regional Biodiversity</h1>

      {/* Country Grid */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '12px',
        marginBottom: '24px'
      }}>
        {EU_COUNTRIES.map((country) => (
          <button
            key={country.code}
            onClick={() => selectCountry(country)}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '500',
              background: selected?.code === country.code ? '#e8f5e9' : 'white',
              border: selected?.code === country.code ? '2px solid #2e7d32' : '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (selected?.code !== country.code) {
                e.currentTarget.style.background = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              if (selected?.code !== country.code) {
                e.currentTarget.style.background = 'white';
              }
            }}
          >
            <span style={{ fontSize: '20px' }}>{country.flag}</span>
            <span>{country.name}</span>
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#757575' }}>Loading regional data...</div>}

      {/* Empty State */}
      {!selected && !loading && (
        <div className="card">
          <p style={{ color: '#757575', textAlign: 'center', padding: '40px 20px' }}>
            Select a country to explore its threatened species
          </p>
        </div>
      )}

      {/* Region Data */}
      {selected && regionData && !loading && (
        <div>
          {/* Country Header */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '48px' }}>{selected.flag}</span>
              <h2 style={{ fontSize: '28px', fontWeight: '600', margin: 0 }}>
                {selected.name}
              </h2>
            </div>

            {/* Stats Row */}
            <div style={{ 
              display: 'flex', 
              gap: '24px', 
              marginBottom: '12px',
              fontSize: '14px',
              color: '#555'
            }}>
              <div>
                <strong>Total assessed:</strong> {regionData.total_assessed}
              </div>
              <div>
                <strong>Threatened:</strong> {regionData.threatened_count} ({threatenedPct}%)
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ 
              width: '100%', 
              height: '6px', 
              background: '#f5f5f5',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressWidth}%`,
                height: '100%',
                background: '#c62828',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Species Table */}
          {sortedSpecies.length > 0 ? (
            <div className="card" style={{ marginBottom: '24px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '12px 8px',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      Species
                    </th>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '12px 8px',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      IUCN Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSpecies.map((species, idx) => (
                    <tr 
                      key={idx}
                      style={{ 
                        borderBottom: '1px solid #f5f5f5'
                      }}
                    >
                      <td style={{ 
                        padding: '12px 8px',
                        fontStyle: 'italic',
                        fontSize: '14px'
                      }}>
                        {species.scientific_name}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <IUCNBadge status={species.category} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: '24px' }}>
              <p style={{ color: '#757575', textAlign: 'center', padding: '20px' }}>
                No threatened species data available for {selected.name}
              </p>
            </div>
          )}

          {/* AI Brief Button */}
          <button
            onClick={generateBrief}
            disabled={summaryLoading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              fontWeight: '600',
              color: 'white',
              background: summaryLoading ? '#bdbdbd' : '#2e7d32',
              border: 'none',
              borderRadius: '8px',
              cursor: summaryLoading ? 'not-allowed' : 'pointer',
              marginBottom: '16px'
            }}
          >
            {summaryLoading ? 'Generating Brief...' : 'Generate AI Conservation Brief'}
          </button>

          {/* Loading Spinner */}
          {summaryLoading && (
            <div style={{ 
              textAlign: 'center', 
              color: '#757575',
              marginBottom: '16px'
            }}>
              Generating brief...
            </div>
          )}

          {/* AI Summary */}
          {aiSummary && (
            <div 
              className="card"
              style={{
                borderLeft: '3px solid #2e7d32',
                padding: '16px'
              }}
            >
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600',
                marginBottom: '12px',
                color: '#2e7d32'
              }}>
                Conservation Brief
              </h3>
              <div style={{ 
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                color: '#333'
              }}>
                {aiSummary}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RegionalView;
