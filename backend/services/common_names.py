"""
Common-name search for autocomplete, backed by the common_names tables.

GBIF's API cannot do this. Its vernacular search matches whole word tokens, so
"bear" works but "be" returns nothing, and it has no wildcard. Substring
matching therefore needs a local copy of the names, which
scripts/ingest_common_names.py loads from the GBIF backbone.
"""
import re

from sqlalchemy import text
from sqlalchemy.orm import Session


MIN_QUERY_LENGTH = 2

# Below this, a query is treated as a fragment rather than a word. See the
# rank_by_word note in search().
_WORD_RANKING_MIN_LENGTH = 3

# Ranking signals, in priority order. Each is a boolean except the last two.
#
#   exact   The name is the query. "Bear" itself leads a search for bear.
#   head    The name *ends* with the query, making the query its head noun.
#           This is the signal that matters: in an English compound the last
#           word is the thing itself, so a Polar Bear is a bear while a Bear
#           Oak is an oak. Without it, a search for "bear" returns shrubs.
#   word    The query is a whole word somewhere in the name, which still beats
#           merely sharing opening letters — Bearded Seal over bearbind.
#   starts  The name begins with the query, so "polar be" finds Polar Bear.
#   species Prefer a species over a genus or family bearing the same name.
#   fame    Vernacular names across all languages, as a proxy for how well
#           known a taxon is: it separates Killer Whale from an obscure sedge.
#
# Length and alphabetical order only break remaining ties. Short names are the
# general ones, which is what a two-letter query wants: Bee, Bear, Beetle.
_RANK_ORDER = """
    is_exact DESC, is_head DESC, is_word DESC, is_start DESC,
    -- For a fragment, shortest wins: "be" should reach Bee and Bear, not the
    -- well-documented cod that happens to be called Berry fish.
    CASE WHEN :rank_by_word THEN 0 ELSE length(name) END,
    -- Fame before rank, so an exact match lands on the animal everyone means
    -- rather than an obscure fish that shares the word.
    name_count DESC,
    is_species DESC,
    length(name),
    lower(name)
"""

# Three layers, each dropping a different kind of duplicate:
#
#   per_taxon  One row per taxon, choosing which of its names to show. Many
#              sharks are all called just "Shark", so preferring a name that
#              says more than the query turns eight identical rows into Fox
#              Shark, Blue Shark, Tiger Shark.
#   per_name   One row per name, since unrelated taxa share names and a
#              dropdown reading "bean | Bean | bean" looks broken. The
#              best-ranked taxon keeps the name.
#   outer      Ranks what survives and takes the top few.
_SEARCH_SQL = text(f"""
    SELECT gbif_key, name, scientific_name, rank
    FROM (
      SELECT DISTINCT ON (lower(name)) *
      FROM (
        SELECT DISTINCT ON (cn.gbif_key)
               cn.gbif_key,
               cn.name,
               t.scientific_name,
               t.rank,
               (lower(cn.name) = ANY(:exact_forms)) AS is_exact,
               (:rank_by_word AND lower(cn.name) ~ :head_regex) AS is_head,
               (:rank_by_word AND lower(cn.name) ~ :word_regex) AS is_word,
               (lower(cn.name) LIKE :starts_with) AS is_start,
               (t.rank = 'SPECIES') AS is_species,
               t.name_count
        FROM common_name_words w
        JOIN common_names cn ON cn.id = w.name_id
        JOIN taxa t ON t.gbif_key = cn.gbif_key
        WHERE w.word LIKE :prefix
          AND t.status = 'ACCEPTED'
          AND (:phrase IS NULL OR lower(cn.name) LIKE :phrase)
        ORDER BY
            cn.gbif_key,
            is_head DESC,
            is_word DESC,
            -- Prefer a name that identifies the species over the bare group
            -- word it shares with everything else that matched.
            is_exact,
            is_start DESC,
            length(cn.name),
            lower(cn.name)
      ) per_taxon
      ORDER BY lower(name), {_RANK_ORDER}
    ) per_name
    ORDER BY {_RANK_ORDER}
    LIMIT :limit
""")


def _escape_like(value: str) -> str:
    """Escape LIKE metacharacters so a typed % or _ is matched literally."""
    for char in ("\\", "%", "_"):
        value = value.replace(char, f"\\{char}")
    return value


def search(db: Session, q: str, limit: int = 8) -> list[dict]:
    """
    Find species by English common name.

    A name matches when the query appears at the start of any word in it, so
    "be" finds Bee and Bear. For a multi-word query only the first word drives
    the indexed lookup and the rest narrows it, which is what makes "polar be"
    find Polar Bear without scanning every name.

    Returns:
        List of {gbif_key, common_name, scientific_name, rank}, best first
    """
    query = " ".join(q.lower().split())
    if len(query) < MIN_QUERY_LENGTH:
        return []

    escaped_like = _escape_like(query)
    escaped_regex = re.escape(query)
    first_word = escaped_like.split(" ")[0]

    rows = db.execute(
        _SEARCH_SQL,
        {
            "prefix": f"{first_word}%",
            # Only constrain on the full phrase when there is more than one word.
            "phrase": f"%{escaped_like}%" if " " in query else None,
            "starts_with": f"{escaped_like}%",
            # A trailing plural still names the same thing: Bears, Eagles.
            "exact_forms": [query, f"{query}s"],
            # \y is Postgres' word boundary.
            "head_regex": rf"\y{escaped_regex}s?$",
            "word_regex": rf"\y{escaped_regex}\y",
            # Two letters is a fragment being typed, not a word. Treating it as
            # one lets any name with a short word in it win: "be" would return
            # the Nosy Be geckos of Madagascar instead of bears and bees.
            "rank_by_word": len(query) >= _WORD_RANKING_MIN_LENGTH,
            "limit": limit,
        }
    ).all()

    return [
        {
            "gbif_key": row.gbif_key,
            "common_name": row.name,
            "scientific_name": row.scientific_name,
            "rank": row.rank,
        }
        for row in rows
    ]
