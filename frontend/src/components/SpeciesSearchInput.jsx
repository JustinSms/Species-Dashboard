import { useState, useEffect, useRef } from 'react';
import { suggestSpecies } from '../api';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

const SpeciesSearchInput = ({ value, onChange, onSearch }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const abortRef = useRef(null);
  // Picking a suggestion rewrites the input; that shouldn't reopen the dropdown.
  const skipFetchRef = useRef(false);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }

    const term = value.trim();
    // Too short to suggest on. Nothing to reset — showDropdown below already
    // hides stale results while the term is this short.
    if (term.length < MIN_QUERY_LENGTH) {
      return;
    }

    const timer = setTimeout(async () => {
      // Drop the in-flight request so a slow 'be' can't land after 'bear'.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await suggestSpecies(term, controller.signal);
        setSuggestions(data.suggestions || []);
        setHighlighted(-1);
        setOpen(true);
      } catch {
        // Suggestions are a convenience. On failure leave the dropdown closed
        // and let the user search by hand, exactly as before.
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setHighlighted(-1);
          setOpen(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value]);

  // Abort whatever is in flight when the input goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setHighlighted(-1);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const closeDropdown = () => {
    setOpen(false);
    setHighlighted(-1);
  };

  const selectSuggestion = (suggestion) => {
    skipFetchRef.current = true;
    onChange(suggestion.scientific_name);
    setSuggestions([]);
    closeDropdown();
    // Search by scientific name so GBIF resolves it exactly.
    onSearch(suggestion.scientific_name);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    closeDropdown();
    onSearch(value);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      closeDropdown();
      return;
    }

    if (!open || suggestions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && highlighted >= 0) {
      // Only intercept Enter when a row is highlighted; otherwise submit.
      event.preventDefault();
      selectSuggestion(suggestions[highlighted]);
    }
  };

  const showDropdown =
    open && suggestions.length > 0 && value.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '24px' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by scientific or common name..."
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls="species-suggestions"
            autoComplete="off"
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

      {showDropdown && (
        <ul
          id="species-suggestions"
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: '96px',
            zIndex: 10,
            margin: '4px 0 0',
            padding: '4px 0',
            listStyle: 'none',
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
            maxHeight: '320px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.gbif_key}
              role="option"
              aria-selected={index === highlighted}
              onMouseDown={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setHighlighted(index)}
              style={{
                padding: '8px 14px',
                cursor: 'pointer',
                background: index === highlighted ? '#f1f8f2' : 'transparent'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>
                {suggestion.common_name}
              </div>
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#757575' }}>
                {suggestion.scientific_name}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SpeciesSearchInput;
