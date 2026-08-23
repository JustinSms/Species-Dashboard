"""GBIF API client for fetching biodiversity data."""
import httpx
from typing import Optional


BASE_URL = "https://api.gbif.org/v1"
client = httpx.AsyncClient(timeout=30.0)


async def search_species(name: str) -> list[dict]:
    """
    Search for species by name using GBIF species match API.
    
    Args:
        name: Scientific or common name to search for
        
    Returns:
        List of matching species with keys: usageKey, scientificName, 
        canonicalName, vernacularName, status, confidence, rank
    """
    try:
        response = await client.get(
            f"{BASE_URL}/species/match",
            params={"name": name, "verbose": "true"}
        )
        response.raise_for_status()
        data = response.json()
        
        # GBIF match endpoint returns a single match, wrap in list
        if data and "usageKey" in data:
            return [{
                "usageKey": data.get("usageKey"),
                "scientificName": data.get("scientificName"),
                "canonicalName": data.get("canonicalName"),
                "vernacularName": data.get("vernacularName"),
                "status": data.get("status"),
                "confidence": data.get("confidence"),
                "rank": data.get("rank"),
            }]
        return []
    except httpx.HTTPError:
        return []


async def get_occurrence_points(species_key: int, limit: int = 500) -> list[dict]:
    """
    Get occurrence points with coordinates for a species.
    
    Args:
        species_key: GBIF species key
        limit: Maximum number of results (default 500)
        
    Returns:
        List of occurrence points with lat, lng, year, and countryCode
    """
    try:
        response = await client.get(
            f"{BASE_URL}/occurrence/search",
            params={
                "speciesKey": species_key,
                "hasCoordinate": "true",
                "limit": limit
            }
        )
        response.raise_for_status()
        data = response.json()
        
        results = []
        for record in data.get("results", []):
            lat = record.get("decimalLatitude")
            lng = record.get("decimalLongitude")
            
            # Skip records without coordinates
            if lat is None or lng is None:
                continue
                
            results.append({
                "lat": lat,
                "lng": lng,
                "year": record.get("year"),
                "countryCode": record.get("countryCode"),
            })
        
        return results
    except httpx.HTTPError:
        return []


async def get_occurrence_counts_by_year(species_key: int) -> list[dict]:
    """
    Get aggregated occurrence counts by year for a species.
    
    Args:
        species_key: GBIF species key
        
    Returns:
        List of {year: int, count: int} sorted by year ascending
    """
    try:
        response = await client.get(
            f"{BASE_URL}/occurrence/search",
            params={
                "speciesKey": species_key,
                "facet": "year",
                "facetMinCount": "1",
                "limit": "0"
            }
        )
        response.raise_for_status()
        data = response.json()
        
        # Parse facet counts
        facets = data.get("facets", [])
        if not facets:
            return []
        
        year_counts = []
        for count_obj in facets[0].get("counts", []):
            try:
                year = int(count_obj.get("name"))
                count = count_obj.get("count", 0)
                year_counts.append({"year": year, "count": count})
            except (ValueError, TypeError):
                # Skip invalid year values
                continue
        
        # Sort by year ascending
        year_counts.sort(key=lambda x: x["year"])
        return year_counts
    except httpx.HTTPError:
        return []
