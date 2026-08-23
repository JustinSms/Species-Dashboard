import { useState, useEffect } from 'react';
import { searchSpecies, getSpecies } from '../api';
import SpeciesCard from '../components/SpeciesCard';

const Discover = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    // Fetch featured species on mount
    const fetchFeatured = async () => {
      try {
        const featuredIds = [2374413, 2435099, 2433551, 5219404]; // European eel, Iberian lynx, Polar bear, Mountain gorilla
        const promises = featuredIds.map(id => 
          getSpecies(id).catch(() => null) // Silently ignore 404s
        );
        const species = await Promise.all(promises);
        setFeatured(species.filter(s => s !== null));
      } catch (err) {
        // Silently ignore errors
        console.error('Error fetching featured species:', err);
      }
    };

    fetchFeatured();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    // Validate query
    if (!query.trim()) {
      setError('Please enter a species name');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const data = await searchSpecies(query);
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

      {/* Search Form */}
      <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by scientific or common name..."
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '14px',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              background: '#2e7d32',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div style={{ color: '#d32f2f', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ color: '#757575', marginBottom: '16px' }}>
          Searching...
        </div>
      )}

      {/* Search Results */}
      {hasSearched && !loading && (
        <div>
          {results.length > 0 ? (
            <>
              <p style={{ marginBottom: '16px', color: '#555' }}>
                Found {results.length} species
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px'
              }}>
                {results.map((species) => (
                  <SpeciesCard
                    key={species.gbif_key}
                    gbif_key={species.gbif_key}
                    scientific_name={species.scientific_name}
                    common_name={species.common_name}
                    iucn_status={species.iucn_status}
                    iucn_trend={species.iucn_trend}
                  />
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#757575' }}>
              No species found for '{query}' — try the scientific name
            </p>
          )}
        </div>
      )}

      {/* Featured Species (shown when no search) */}
      {!hasSearched && featured.length > 0 && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1a1a1a' }}>
            Featured Threatened Species
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px'
          }}>
            {featured.map((species) => (
              <SpeciesCard
                key={species.gbif_key}
                gbif_key={species.gbif_key}
                scientific_name={species.scientific_name}
                common_name={species.common_name}
                iucn_status={species.iucn_status}
                iucn_trend={species.iucn_trend}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Discover;
