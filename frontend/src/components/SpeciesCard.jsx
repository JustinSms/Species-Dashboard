import { useNavigate } from 'react-router-dom';
import IUCNBadge from './IUCNBadge';

const SpeciesCard = ({ gbif_key, scientific_name, common_name, iucn_status, iucn_trend }) => {
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
      style={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <h3 style={{ 
        fontSize: '16px', 
        fontWeight: '600', 
        marginBottom: '8px',
        color: '#1a1a1a'
      }}>
        {common_name || scientific_name}
      </h3>
      
      <p style={{ 
        fontStyle: 'italic', 
        color: '#757575', 
        fontSize: '14px',
        marginBottom: '12px'
      }}>
        {scientific_name}
      </p>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {iucn_status && <IUCNBadge status={iucn_status} />}
        {iucn_trend && getTrendDisplay(iucn_trend)}
      </div>
    </div>
  );
};

export default SpeciesCard;
