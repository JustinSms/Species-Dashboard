from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from database import get_db
from models import Species, Occurrence
from services import gbif, iucn

router = APIRouter(tags=["species"])


@router.get("/species/search")
async def search_species(q: str = Query(..., description="Search query"), db: Session = Depends(get_db)):
    """
    Search for species by name using GBIF API.
    Fetches IUCN assessment for top 3 results and upserts to database.
    """
    # Search GBIF
    gbif_results = await gbif.search_species(q)
    
    if not gbif_results:
        return {"results": []}
    
    # Process top 3 results
    results = []
    for match in gbif_results[:3]:
        gbif_key = match.get("usageKey")
        scientific_name = match.get("scientificName")
        common_name = match.get("vernacularName")
        confidence = match.get("confidence")
        
        if not gbif_key or not scientific_name:
            continue
        
        # Fetch IUCN assessment
        iucn_status = None
        iucn_trend = None
        assessment = await iucn.get_species_assessment(scientific_name)
        if assessment:
            iucn_status = assessment.get("category")
            iucn_trend = assessment.get("population_trend")
            if not common_name and assessment.get("main_common_name"):
                common_name = assessment["main_common_name"]
        
        # Upsert to database
        existing = db.query(Species).filter(Species.gbif_key == gbif_key).first()
        if existing:
            existing.scientific_name = scientific_name
            if common_name:
                existing.common_name = common_name
            if iucn_status:
                existing.iucn_status = iucn_status
            if iucn_trend:
                existing.iucn_trend = iucn_trend
        else:
            new_species = Species(
                gbif_key=gbif_key,
                scientific_name=scientific_name,
                common_name=common_name,
                iucn_status=iucn_status,
                iucn_trend=iucn_trend
            )
            db.add(new_species)
        
        db.commit()
        
        results.append({
            "gbif_key": gbif_key,
            "scientific_name": scientific_name,
            "common_name": common_name,
            "display_name": common_name or scientific_name,
            "iucn_status": iucn_status,
            "iucn_trend": iucn_trend,
            "confidence": confidence
        })
    
    return {"results": results}


@router.get("/species/{gbif_key}")
async def get_species(gbif_key: int, db: Session = Depends(get_db)):
    """Get detailed species information including IUCN narrative."""
    species = db.query(Species).filter(Species.gbif_key == gbif_key).first()
    
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    
    # Fetch IUCN narrative
    narrative = await iucn.get_species_narrative(species.scientific_name)
    
    # Build response with species data + narrative
    response = {
        "gbif_key": species.gbif_key,
        "scientific_name": species.scientific_name,
        "common_name": species.common_name,
        "display_name": species.common_name or species.scientific_name,
        "iucn_status": species.iucn_status,
        "iucn_trend": species.iucn_trend,
        "created_at": species.created_at.isoformat() if species.created_at else None,
    }
    
    # Add narrative fields if available
    if narrative:
        response.update({
            "habitat": narrative.get("habitat"),
            "threats": narrative.get("threats"),
            "population": narrative.get("population"),
            "conservation_measures": narrative.get("conservationmeasures"),
        })
    
    return response


@router.get("/species/{gbif_key}/occurrences")
async def get_species_occurrences(gbif_key: int, db: Session = Depends(get_db)):
    """
    Get occurrence count data by year for a species.
    Fetches from GBIF and caches in database if not enough data exists.
    """
    # Check if species exists
    species = db.query(Species).filter(Species.gbif_key == gbif_key).first()
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    
    # Query existing occurrence records
    existing_occurrences = db.query(Occurrence).filter(
        Occurrence.gbif_key == gbif_key
    ).all()
    
    # If we have fewer than 3 records, fetch from GBIF
    if len(existing_occurrences) < 3:
        year_counts = await gbif.get_occurrence_counts_by_year(gbif_key)
        
        # Bulk insert (ignore conflicts for existing year records)
        if year_counts:
            for yc in year_counts:
                # Use INSERT ... ON CONFLICT DO NOTHING pattern
                stmt = pg_insert(Occurrence).values(
                    gbif_key=gbif_key,
                    year=yc["year"],
                    count=yc["count"]
                ).on_conflict_do_nothing(constraint="uq_species_year")
                
                db.execute(stmt)
            
            db.commit()
            
            # Re-query to get all occurrences
            existing_occurrences = db.query(Occurrence).filter(
                Occurrence.gbif_key == gbif_key
            ).order_by(Occurrence.year).all()
    
    # Return ordered by year
    return {
        "gbif_key": gbif_key,
        "scientific_name": species.scientific_name,
        "common_name": species.common_name,
        "display_name": species.common_name or species.scientific_name,
        "occurrences": [
            {"year": occ.year, "count": occ.count}
            for occ in sorted(existing_occurrences, key=lambda x: x.year)
        ]
    }


@router.get("/species/{gbif_key}/occurrence-points")
async def get_occurrence_points(
    gbif_key: int,
    limit: int = Query(500, ge=1, le=5000, description="Maximum number of points"),
    db: Session = Depends(get_db)
):
    """
    Get occurrence points with coordinates for mapping.
    Fetches directly from GBIF (not cached).
    """
    # Check if species exists
    species = db.query(Species).filter(Species.gbif_key == gbif_key).first()
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    
    # Fetch occurrence points from GBIF
    points = await gbif.get_occurrence_points(gbif_key, limit=limit)
    
    return {
        "gbif_key": gbif_key,
        "scientific_name": species.scientific_name,
        "common_name": species.common_name,
        "display_name": species.common_name or species.scientific_name,
        "points": points
    }
