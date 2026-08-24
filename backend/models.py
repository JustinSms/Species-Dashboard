from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Index, UniqueConstraint, func
)
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


class Taxon(Base):
    """
    A GBIF backbone taxon, holding what the common-name index needs to rank and
    display a match: its scientific name, its rank, and how well known it is.

    Separate from Species, which is the app's own working set of looked-up
    species. This is a read-only mirror of GBIF covering every taxon that has an
    English common name.
    """
    __tablename__ = "taxa"

    gbif_key = Column(Integer, primary_key=True)
    scientific_name = Column(String, nullable=False)
    rank = Column(String, nullable=True)
    status = Column(String, nullable=True)

    # Vernacular names across all languages. A stand-in for fame: a polar bear
    # collects names in dozens of languages, an obscure sedge in one.
    name_count = Column(Integer, nullable=False, default=0)


class CommonName(Base):
    """
    An English common name from the GBIF backbone, for search autocomplete.

    Deliberately not a foreign key to species: this covers every species GBIF
    knows a name for, not the handful the app has looked up so far.
    """
    __tablename__ = "common_names"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gbif_key = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)


class CommonNameWord(Base):
    """
    One word of a common name, so a prefix can be matched against any word.

    "Polar Bear" is stored twice, as "polar" and "bear", which is what lets a
    search for "be" reach it. Matching this with LIKE on the name itself would
    mean a full scan of every name on every keystroke.
    """
    __tablename__ = "common_name_words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name_id = Column(
        Integer, ForeignKey("common_names.id", ondelete="CASCADE"), nullable=False
    )
    word = Column(String, nullable=False)

    __table_args__ = (
        # text_pattern_ops so LIKE 'be%' uses the index regardless of collation.
        Index(
            "ix_common_name_words_word",
            "word",
            postgresql_ops={"word": "text_pattern_ops"}
        ),
    )
