const IUCNBadge = ({ status }) => {
  const statusMap = {
    CR: { label: 'Critically Endangered', bg: '#b71c1c', textColor: 'white' },
    EN: { label: 'Endangered', bg: '#e65100', textColor: 'white' },
    VU: { label: 'Vulnerable', bg: '#f57f17', textColor: 'white' },
    NT: { label: 'Near Threatened', bg: '#558b2f', textColor: 'white' },
    LC: { label: 'Least Concern', bg: '#2e7d32', textColor: 'white' },
    DD: { label: 'Data Deficient', bg: '#757575', textColor: 'white' }
  };

  const config = statusMap[status] || {
    label: 'Not Assessed',
    bg: '#bdbdbd',
    textColor: '#333'
  };

  return (
    <span
      style={{
        background: config.bg,
        color: config.textColor,
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-block'
      }}
    >
      {config.label}
    </span>
  );
};

export default IUCNBadge;
