"""Ingest IUCN Red List data for threatened species into database and vector store."""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from database import SessionLocal, create_tables
from models import Species
from services.iucn import get_species_assessment, get_species_narrative
from services.gbif import search_species
from services.rag import init_rag, add_documents


# List of threatened species to ingest
# Can use either scientific names (Latin) or common English names
SPECIES_LIST = [
    "Anguilla anguilla",  # European eel
    "Lynx pardinus",  # Iberian lynx
    "Ursus maritimus",  # Polar bear
    "Gorilla beringei beringei",  # Mountain gorilla
    "Panthera pardus orientalis",  # Amur leopard
    "Danaus plexippus",  # Monarch butterfly
    "Ambystoma mexicanum",  # Axolotl
    "Thunnus thynnus",  # Atlantic bluefin tuna
    "Panthera uncia",  # Snow leopard
    "Bison bonasus",  # European bison
    "Phocoena sinus",  # Vaquita
    "Acipenser sturio",  # European sturgeon
    "Monachus monachus",  # Mediterranean monk seal
    "Testudo hermanni",  # Hermann's tortoise
    "Luscinia svecica",  # Bluethroat
    "Mustela lutreola",  # European mink
    "Alosa alosa",  # Allis shad
    "Emys orbicularis",  # European pond turtle
    "Hyla arborea",  # European tree frog
    "Lutra lutra",  # Eurasian otter
    "Martes zibellina",  # Sable
    "Cervus elaphus corsicanus",  # Corsican red deer
    "Gyps fulvus",  # Griffon vulture
    "Aquila adalberti",  # Spanish imperial eagle
    "Ciconia nigra",  # Black stork
]


async def resolve_scientific_name(name: str) -> tuple[str, str] | None:
    """
    Convert a common name or validate a scientific name using GBIF.
    
    Args:
        name: Either a scientific name or common English name
        
    Returns:
        Tuple of (scientific_name, common_name) if found, None if not found
    """
    # Try to match the name using GBIF
    matches = await search_species(name)
    
    if not matches:
        print(f"Could not find species match for '{name}' in GBIF")
        return None
    
    match = matches[0]
    scientific_name = match.get("scientificName")
    common_name = match.get("vernacularName")  # Get common name from GBIF
    
    # If input was a common name, show the conversion
    if name.lower() != scientific_name.lower():
        print(f"  → Resolved '{name}' to '{scientific_name}'")
    
    if common_name:
        print(f"  → Common name: {common_name}")
    
    return scientific_name, common_name


async def ingest_species(name: str, db: Session):
    """
    Ingest a single species from IUCN into database and vector store.
    
    Args:
        name: Scientific name or common English name of the species
        db: Database session
    """
    print(f"Fetching data for {name}...")
    
    # Resolve to scientific name and get common name from GBIF
    result = await resolve_scientific_name(name)
    if not result:
        print(f"Skipping {name} - could not resolve name")
        return
    
    scientific_name, gbif_common_name = result
    
    # Get IUCN assessment (requires scientific name)
    assessment = await get_species_assessment(scientific_name)
    if not assessment:
        print(f"No assessment found for {scientific_name}")
        status = "DD"
        trend = None
    else:
        status = assessment.get("category", "DD")
        trend = assessment.get("population_trend")
        print(f"  Status: {status}, Trend: {trend}")
    
    # Get IUCN narrative
    narrative = await get_species_narrative(scientific_name)
    
    # Build combined text document
    text_parts = [f"Species: {scientific_name}"]
    
    if assessment:
        text_parts.append(f"\nConservation Status: {status}")
        if trend:
            text_parts.append(f"Population Trend: {trend}")
        if assessment.get("main_common_name"):
            text_parts.append(f"Common Name: {assessment['main_common_name']}")
    
    if narrative:
        if narrative.get("habitat"):
            text_parts.append(f"\n\nHABITAT:\n{narrative['habitat']}")
        if narrative.get("threats"):
            text_parts.append(f"\n\nTHREATS:\n{narrative['threats']}")
        if narrative.get("population"):
            text_parts.append(f"\n\nPOPULATION:\n{narrative['population']}")
        if narrative.get("conservationmeasures"):
            text_parts.append(f"\n\nCONSERVATION MEASURES:\n{narrative['conservationmeasures']}")
    
    combined_text = "\n".join(text_parts)
    
    # Determine best common name: prefer IUCN, fallback to GBIF
    common_name = None
    if assessment and assessment.get("main_common_name"):
        common_name = assessment["main_common_name"]
    elif gbif_common_name:
        common_name = gbif_common_name
    
    # Upsert species to database
    existing_species = db.query(Species).filter(
        Species.scientific_name == scientific_name
    ).first()
    
    if existing_species:
        existing_species.iucn_status = status
        existing_species.iucn_trend = trend
        if common_name:
            existing_species.common_name = common_name
        print(f"  Updated existing species record")
    else:
        # Create new species record with a placeholder gbif_key
        new_species = Species(
            gbif_key=hash(scientific_name) % 1000000000,  # Placeholder
            scientific_name=scientific_name,
            common_name=common_name,
            iucn_status=status,
            iucn_trend=trend
        )
        db.add(new_species)
        print(f"  Created new species record")
    
    if common_name:
        print(f"  Common name: {common_name}")
    
    db.commit()
    
    # Add to vector store
    add_documents(
        texts=[combined_text],
        metadatas=[{
            "source": "iucn_narrative",
            "scientific_name": scientific_name,
            "iucn_status": status
        }]
    )
    
    print(f"✓ Ingested {scientific_name}")


async def main():
    """Main ingestion function."""
    print("Starting IUCN data ingestion...")
    print(f"Species to ingest: {len(SPECIES_LIST)}")
    print("=" * 60)
    
    # Initialize database and RAG
    create_tables()
    init_rag()
    
    # Create database session
    db = SessionLocal()
    
    try:
        for i, species_name in enumerate(SPECIES_LIST, 1):
            print(f"\n[{i}/{len(SPECIES_LIST)}] Processing {species_name}")
            
            try:
                await ingest_species(species_name, db)
            except Exception as e:
                print(f"Error ingesting {species_name}: {e}")
            
            # Rate limit: sleep between requests
            if i < len(SPECIES_LIST):
                print("  Waiting 1.5s...")
                await asyncio.sleep(1.5)
        
        print("\n" + "=" * 60)
        print(f"✓ Completed ingestion of {len(SPECIES_LIST)} species")
    
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
