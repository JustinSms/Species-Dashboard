"""IUCN Red List API client for fetching conservation status and species assessments."""
import os
import re
import httpx
import logging
from typing import Optional


BASE_URL = "https://api.iucnredlist.org/api/v4"
client = httpx.AsyncClient(timeout=30.0)

# Get API key from environment
IUCN_API_KEY = os.environ.get("IUCN_API_KEY")

if not IUCN_API_KEY:
    logging.warning("IUCN_API_KEY not found in environment variables")

logger = logging.getLogger(__name__)


def _strip_html(text: Optional[str]) -> str:
    """Remove HTML tags from text."""
    if not text:
        return ""
    return re.sub(r'<[^>]+>', '', text)


async def get_species_assessment(name: str) -> Optional[dict]:
    """
    Get species assessment information from IUCN Red List.
    
    Args:
        name: Scientific name of the species
        
    Returns:
        Dictionary with taxonid, scientific_name, category, population_trend,
        and main_common_name, or None if not found
    """
    if not IUCN_API_KEY:
        logger.warning("Cannot fetch IUCN assessment without API key")
        return None
    
    try:
        response = await client.get(
            f"{BASE_URL}/species/{name}",
            params={"token": IUCN_API_KEY}
        )
        response.raise_for_status()
        data = response.json()
        
        results = data.get("result", [])
        if not results:
            return None
        
        result = results[0]
        return {
            "taxonid": result.get("taxonid"),
            "scientific_name": result.get("scientific_name"),
            "category": result.get("category"),
            "population_trend": result.get("population_trend"),
            "main_common_name": result.get("main_common_name"),
        }
    except httpx.HTTPError as e:
        logger.error(f"Error fetching IUCN assessment for {name}: {e}")
        return None


async def get_species_narrative(name: str) -> Optional[dict]:
    """
    Get species narrative information (habitat, threats, population, conservation).
    
    Args:
        name: Scientific name of the species
        
    Returns:
        Dictionary with habitat, threats, population, and conservationmeasures
        (with HTML tags stripped), or None if not found
    """
    if not IUCN_API_KEY:
        logger.warning("Cannot fetch IUCN narrative without API key")
        return None
    
    try:
        response = await client.get(
            f"{BASE_URL}/species/narrative/{name}",
            params={"token": IUCN_API_KEY}
        )
        response.raise_for_status()
        data = response.json()
        
        results = data.get("result", [])
        if not results:
            return None
        
        result = results[0]
        return {
            "habitat": _strip_html(result.get("habitat")),
            "threats": _strip_html(result.get("threats")),
            "population": _strip_html(result.get("population")),
            "conservationmeasures": _strip_html(result.get("conservationmeasures")),
        }
    except httpx.HTTPError as e:
        logger.error(f"Error fetching IUCN narrative for {name}: {e}")
        return None


async def get_species_by_country(iso2: str) -> list[dict]:
    """
    Get list of species found in a specific country.
    
    Args:
        iso2: Two-letter ISO country code (e.g., "US", "BR")
        
    Returns:
        List of species with scientific_name and category
    """
    if not IUCN_API_KEY:
        logger.warning("Cannot fetch IUCN country species without API key")
        return []
    
    try:
        response = await client.get(
            f"{BASE_URL}/country/getspecies/{iso2}",
            params={"token": IUCN_API_KEY}
        )
        response.raise_for_status()
        data = response.json()
        
        results = data.get("result", [])
        return [
            {
                "scientific_name": species.get("scientific_name"),
                "category": species.get("category"),
            }
            for species in results
        ]
    except httpx.HTTPError as e:
        logger.error(f"Error fetching IUCN species for country {iso2}: {e}")
        return []
