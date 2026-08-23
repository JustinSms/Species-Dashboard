import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

export const searchSpecies = async (q) => {
  try {
    const response = await instance.get('/species/search', { params: { q } });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getSpecies = async (gbifKey) => {
  try {
    const response = await instance.get(`/species/${gbifKey}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getOccurrences = async (gbifKey) => {
  try {
    const response = await instance.get(`/species/${gbifKey}/occurrences`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getOccurrencePoints = async (gbifKey, limit = 500) => {
  try {
    const response = await instance.get(`/species/${gbifKey}/occurrence-points`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getTrends = async (gbifKey) => {
  try {
    const response = await instance.get(`/analysis/trends/${gbifKey}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getRegion = async (iso2) => {
  try {
    const response = await instance.get(`/analysis/region/${iso2}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const sendChat = async (question, speciesContext = null, filterByStatus = null) => {
  try {
    const response = await instance.post('/chat', {
      question,
      species_context: speciesContext,
      filter_by_status: filterByStatus
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getChatSuggestions = async () => {
  try {
    const response = await instance.get('/chat/suggestions');
    return response.data;
  } catch (error) {
    throw error;
  }
};
