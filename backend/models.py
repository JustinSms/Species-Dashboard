from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, func
from database import Base


class Species(Base):
    """Species model for storing biodiversity information."""
    __tablename__ = "species"
    
    gbif_key = Column(Integer, primary_key=True)
    scientific_name = Column(String, nullable=False)
    common_name = Column(String, nullable=True)
    iucn_status = Column(String, nullable=True)
    iucn_trend = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Occurrence(Base):
    """Occurrence model for storing species observation counts by year."""
    __tablename__ = "occurrences"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    gbif_key = Column(Integer, ForeignKey("species.gbif_key"), nullable=False)
    year = Column(Integer, nullable=False)
    count = Column(Integer, nullable=False)
    
    __table_args__ = (
        UniqueConstraint("gbif_key", "year", name="uq_species_year"),
    )
