from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
import pandas as pd
import pymannkendall as mk
from database import get_db
from models import Species, Occurrence
from services import gbif, iucn

router = APIRouter(tags=["analysis"])


@router.get("/analysis/trends/{gbif_key}")
async def get_trend_analysis(gbif_key: int, db: Session = Depends(get_db)):
    """
    Perform Mann-Kendall trend analysis on species occurrence data.
    Fetches data from GBIF if insufficient records exist in database.
    """
    # Check if species exists
    species = db.query(Species).filter(Species.gbif_key == gbif_key).first()
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    
    # Query existing occurrence records
    occurrences = db.query(Occurrence).filter(
        Occurrence.gbif_key == gbif_key
    ).order_by(Occurrence.year).all()
    
    # If fewer than 5 records, fetch from GBIF
    if len(occurrences) < 5:
        year_counts = await gbif.get_occurrence_counts_by_year(gbif_key)
        
        # Upsert to database
        if year_counts:
            for yc in year_counts:
                stmt = pg_insert(Occurrence).values(
                    gbif_key=gbif_key,
                    year=yc["year"],
                    count=yc["count"]
                ).on_conflict_do_nothing(constraint="uq_species_year")
                
                db.execute(stmt)
            
            db.commit()
            
            # Re-query to get all occurrences
            occurrences = db.query(Occurrence).filter(
                Occurrence.gbif_key == gbif_key
            ).order_by(Occurrence.year).all()
    
    # Check if we have sufficient data for analysis
    if len(occurrences) < 3:
        raise HTTPException(
            status_code=404,
            detail="Insufficient data for trend analysis (minimum 3 years required)"
        )
    
    # Build pandas Series for Mann-Kendall test
    years = [occ.year for occ in occurrences]
    counts = [occ.count for occ in occurrences]
    series = pd.Series(data=counts, index=years)
    
    # Run Mann-Kendall trend test
    mk_result = mk.original_test(series.values)
    
    # Map trend string
    trend_map = {
        "decreasing": "decreasing",
        "no trend": "stable",
        "increasing": "increasing"
    }
    trend = trend_map.get(mk_result.trend, "stable")
    
    # Build response
    return {
        "gbif_key": gbif_key,
        "scientific_name": species.scientific_name,
        "common_name": species.common_name,
        "display_name": species.common_name or species.scientific_name,
        "yearly_data": [
            {"year": occ.year, "count": occ.count}
            for occ in occurrences
        ],
        "trend": trend,
        "p_value": round(mk_result.p, 4),
        "significant": mk_result.p < 0.05,
        "slope": round(mk_result.slope, 2) if mk_result.slope is not None else 0.0
    }


@router.get("/analysis/region/{iso2}")
async def get_regional_analysis(iso2: str):
    """
    Get threatened species assessment for a specific country/region.
    Filters to critically endangered (CR), endangered (EN), and vulnerable (VU) species.
    """
    # Validate ISO2 code length
    if len(iso2) != 2:
        raise HTTPException(status_code=400, detail="ISO2 code must be 2 characters")
    
    iso2_upper = iso2.upper()
    
    # Fetch species by country from IUCN
    all_species = await iucn.get_species_by_country(iso2_upper)
    
    if not all_species:
        return {
            "country": iso2_upper,
            "species": [],
            "threatened_count": 0,
            "total_assessed": 0
        }
    
    # Filter to threatened categories
    threatened_categories = {"CR", "EN", "VU"}
    threatened_species = [
        sp for sp in all_species
        if sp.get("category") in threatened_categories
    ]
    
    # Sort by threat level: CR → EN → VU
    category_order = {"CR": 0, "EN": 1, "VU": 2}
    threatened_species.sort(key=lambda x: category_order.get(x.get("category"), 99))
    
    return {
        "country": iso2_upper,
        "species": [
            {
                "scientific_name": sp.get("scientific_name"),
                "category": sp.get("category")
            }
            for sp in threatened_species
        ],
        "threatened_count": len(threatened_species),
        "total_assessed": len(all_species)
    }
