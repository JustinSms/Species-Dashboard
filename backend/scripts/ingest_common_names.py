"""
Load English common names from the GBIF backbone for search autocomplete.

The backbone archive is ~970MB, but the file holding the names is only ~15MB
compressed, and a ZIP keeps its table of contents at the end. So this reads the
central directory with an HTTP range request, then fetches just that one member
and skips the other 950MB.

Run once, and again whenever GBIF republishes the backbone:

    python scripts/ingest_common_names.py
"""
import gzip
import io
import os
import re
import struct
import sys
import tempfile
import time
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from dotenv import load_dotenv
load_dotenv()

from database import engine, create_tables
# Imported for the side effect of registering the tables on Base.metadata,
# without which create_tables() below has nothing to create.
from models import CommonName, CommonNameWord, Taxon  # noqa: F401


BACKBONE_URL = "https://hosted-datasets.gbif.org/datasets/backbone/current/backbone.zip"
MEMBER_NAME = "VernacularName.tsv"

# The taxon table: rank, status and scientific name for every backbone taxon.
# ~490MB gzipped and streamed, because there is no smaller published form of it.
SIMPLE_URL = "https://hosted-datasets.gbif.org/datasets/backbone/current/simple.txt.gz"

# Column positions in simple.txt.gz, which ships without a header row.
COL_KEY = 0
COL_STATUS = 4
COL_RANK = 5
COL_SCIENTIFIC_NAME = 18
COL_CANONICAL_NAME = 19
COL_COUNT = 20

# Sanity check on those positions, since a silent column shift would poison the
# whole index. Ursus maritimus, the polar bear.
CANARY_KEY = 2433451
CANARY_NAME = "Ursus maritimus"

# GBIF tags English as "en" in the archive, though its web API says "eng".
ENGLISH = "en"

# Enough of the tail to cover the end-of-central-directory records.
TAIL_BYTES = 70000

# Consecutive failures tolerated per request before giving up on the run.
MAX_ATTEMPTS = 8

# Words are what the index is built on, so split on anything that isn't part of
# one. Keeps digits, which carry meaning in names like "13-Spotted Lady Beetle".
WORD_PATTERN = re.compile(r"[^a-z0-9']+")


def _retrying(description: str, operation):
    """
    Run operation, backing off and retrying while the host aborts on us.

    GBIF's host closes connections mid-response often enough, and without
    regard for how much was asked for, that every request here has to expect
    it. A dropped 70KB range request is not worth losing the run over.
    """
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return operation()
        except (httpx.HTTPError, OSError) as error:
            if attempt == MAX_ATTEMPTS:
                raise
            delay = min(30, 2 ** attempt)
            print(f"  {description} failed ({error}); retrying in {delay}s")
            time.sleep(delay)


def _fetch_range(client: httpx.Client, start: int, end: int) -> bytes:
    """Fetch an inclusive byte range, retrying if the host hangs up."""
    def attempt() -> bytes:
        response = client.get(BACKBONE_URL, headers={"Range": f"bytes={start}-{end}"})
        response.raise_for_status()
        # Without the range, this is a 970MB body read into memory.
        if response.status_code != 206:
            raise httpx.HTTPError(
                f"range ignored: asked for bytes {start}-{end}, "
                f"got {response.status_code}"
            )
        return response.content

    return _retrying(f"bytes {start}-{end}", attempt)


def _locate_member(client: httpx.Client) -> tuple[int, int]:
    """
    Find MEMBER_NAME in the remote archive by reading its central directory.

    Resolved at runtime rather than hardcoded, because every offset shifts when
    GBIF republishes the backbone.

    Returns:
        (offset of the local file header, compressed size)
    """
    def head() -> httpx.Response:
        response = client.head(BACKBONE_URL)
        response.raise_for_status()
        return response

    total = int(_retrying("HEAD", head).headers["content-length"])
    tail = _fetch_range(client, max(0, total - TAIL_BYTES), total - 1)

    zip64 = tail.rfind(b"PK\x06\x06")
    if zip64 >= 0:
        cd_size, cd_offset = struct.unpack("<QQ", tail[zip64 + 40:zip64 + 56])
    else:
        eocd = tail.rfind(b"PK\x05\x06")
        cd_size, cd_offset = struct.unpack("<II", tail[eocd + 12:eocd + 20])

    directory = _fetch_range(client, cd_offset, cd_offset + cd_size - 1)

    position = 0
    while position < len(directory) - 4 and directory[position:position + 4] == b"PK\x01\x02":
        compressed_size, = struct.unpack("<I", directory[position + 20:position + 24])
        name_len, extra_len, comment_len = struct.unpack(
            "<HHH", directory[position + 28:position + 34]
        )
        header_offset, = struct.unpack("<I", directory[position + 42:position + 46])
        name = directory[position + 46:position + 46 + name_len].decode("utf-8", "replace")

        if name == MEMBER_NAME:
            return header_offset, compressed_size

        position += 46 + name_len + extra_len + comment_len

    raise LookupError(f"{MEMBER_NAME} not found in {BACKBONE_URL}")


def download_vernacular_names() -> tuple[list[tuple[int, str]], dict[int, int]]:
    """
    Range-fetch VernacularName.tsv.

    Returns:
        (English (key, name) rows, count of names in any language per key)
    """
    with httpx.Client(timeout=180.0, follow_redirects=True) as client:
        header_offset, compressed_size = _locate_member(client)
        print(f"{MEMBER_NAME}: {compressed_size / 1e6:.1f}MB compressed")

        # Skip the local file header to reach the raw deflate stream.
        header = _fetch_range(client, header_offset, header_offset + 29)
        name_len, extra_len = struct.unpack("<HH", header[26:30])
        start = header_offset + 30 + name_len + extra_len

        # A little slack past the stated size; deflate stops at its own marker.
        payload = _fetch_range(client, start, start + compressed_size + 2048)

    raw = zlib.decompressobj(-zlib.MAX_WBITS).decompress(payload)
    print(f"decompressed to {len(raw) / 1e6:.1f}MB")

    names = []
    name_counts: dict[int, int] = {}
    for line in raw.decode("utf-8", "replace").split("\n")[1:]:
        fields = line.split("\t")
        if len(fields) < 3 or not fields[0].isdigit():
            continue

        key = int(fields[0])
        # Every language counts towards fame, only English into the index.
        name_counts[key] = name_counts.get(key, 0) + 1

        if fields[2] != ENGLISH:
            continue
        name = " ".join(fields[1].split())
        if name:
            names.append((key, name))

    return names, name_counts


def _download_with_resume(url: str, destination: str, max_retries: int = 20) -> None:
    """
    Download a large file, resuming with range requests if the host hangs up.

    Downloading to disk first rather than parsing as it arrives is deliberate:
    parsing ten million lines is slow enough that the host times the connection
    out mid-stream. Writing bytes as fast as they come keeps the socket busy,
    and the parse then runs against a local file with no clock on it.
    """
    attempts = 0
    while True:
        done = os.path.getsize(destination) if os.path.exists(destination) else 0
        headers = {"Range": f"bytes={done}-"} if done else {}

        try:
            with httpx.Client(timeout=120.0, follow_redirects=True) as client:
                with client.stream("GET", url, headers=headers) as response:
                    response.raise_for_status()

                    # A host that ignores Range would restart the body at zero.
                    mode = "ab" if done and response.status_code == 206 else "wb"
                    if mode == "wb":
                        done = 0

                    expected = done + int(response.headers.get("content-length", 0))
                    with open(destination, mode) as handle:
                        # Raw and unchunked, on both counts deliberately. Raw
                        # bytes are what the byte offsets in the Range header
                        # count, and asking for fixed-size chunks would hold
                        # them in a buffer that httpx discards when the host
                        # hangs up, so a host dropping the connection below the
                        # chunk size would never make progress.
                        for chunk in response.iter_raw():
                            handle.write(chunk)
                            done += len(chunk)
                            attempts = 0

            if not expected or done >= expected:
                print(f"  downloaded {done / 1e6:.0f}MB")
                return
            raise httpx.HTTPError(f"truncated at {done} of {expected} bytes")

        except (httpx.HTTPError, OSError) as error:
            attempts += 1
            if attempts > max_retries:
                raise
            delay = min(30, 2 ** attempts)
            print(f"  interrupted at {done / 1e6:.0f}MB ({error}); retrying in {delay}s")
            time.sleep(delay)


def stream_taxa(wanted_keys: set[int]) -> dict[int, tuple[str, str, str]]:
    """
    Read simple.txt.gz and keep the taxa we have common names for.

    Only the wanted keys are held; the rest of the ten million rows are parsed
    and dropped, and the downloaded archive is deleted afterwards.

    Returns:
        Mapping of key to (scientific name, rank, status)
    """
    archive = os.path.join(tempfile.gettempdir(), "gbif_backbone_simple.txt.gz")
    taxa: dict[int, tuple[str, str, str]] = {}

    try:
        _download_with_resume(SIMPLE_URL, archive)

        with gzip.open(archive, "rt", encoding="utf-8", errors="replace") as handle:
            for line in handle:
                fields = line.split("\t")
                if len(fields) <= COL_COUNT:
                    continue
                key_text = fields[COL_KEY]
                if not key_text.isdigit():
                    continue
                key = int(key_text)
                if key not in wanted_keys:
                    continue

                canonical = fields[COL_CANONICAL_NAME].strip()
                scientific = fields[COL_SCIENTIFIC_NAME].strip()
                # GBIF writes \N for null.
                name = canonical if canonical not in ("", "\\N") else scientific
                if name in ("", "\\N"):
                    continue

                taxa[key] = (name, fields[COL_RANK], fields[COL_STATUS])
    finally:
        if os.path.exists(archive):
            os.remove(archive)

    print(f"matched {len(taxa)} taxa")

    canary = taxa.get(CANARY_KEY)
    if not canary or canary[0] != CANARY_NAME:
        raise ValueError(
            f"column layout check failed: key {CANARY_KEY} gave {canary!r}, "
            f"expected {CANARY_NAME!r}. simple.txt.gz columns may have changed."
        )

    return taxa


def _copy_rows(cursor, table: str, columns: str, rows) -> None:
    """Bulk load via COPY. Inserting these row counts one by one takes hours."""
    buffer = io.StringIO()
    for row in rows:
        buffer.write("\t".join(str(value) for value in row) + "\n")
    buffer.seek(0)
    cursor.copy_expert(f"COPY {table} ({columns}) FROM STDIN", buffer)


def main() -> None:
    create_tables()

    names, name_counts = download_vernacular_names()
    print(f"{len(names)} English common names")

    taxa = stream_taxa({key for key, _ in names})

    # A name whose taxon the backbone no longer lists cannot be displayed or
    # searched on, so it does not belong in the index.
    names = [(key, name) for key, name in names if key in taxa]
    print(f"{len(names)} names kept after matching against the backbone")

    taxon_rows = [
        (key, scientific_name, rank, status, name_counts.get(key, 0))
        for key, (scientific_name, rank, status) in taxa.items()
    ]

    # Assign ids here so the word rows can reference them without a round trip.
    name_rows = [(index + 1, key, name) for index, (key, name) in enumerate(names)]

    word_rows = []
    for name_id, _, name in name_rows:
        seen = set()
        for word in WORD_PATTERN.split(name.lower()):
            if word and word not in seen:
                seen.add(word)
                word_rows.append((name_id, word))
    print(f"{len(word_rows)} indexed words")

    raw = engine.raw_connection()
    try:
        cursor = raw.cursor()
        # Replace wholesale — this is a mirror of GBIF, not accumulated state.
        cursor.execute(
            "TRUNCATE taxa, common_names, common_name_words RESTART IDENTITY"
        )

        _copy_rows(
            cursor, "taxa",
            "gbif_key, scientific_name, rank, status, name_count", taxon_rows
        )
        _copy_rows(cursor, "common_names", "id, gbif_key, name", name_rows)
        _copy_rows(cursor, "common_name_words", "name_id, word", word_rows)

        # Keep the serial in step with the ids assigned above.
        cursor.execute(
            "SELECT setval('common_names_id_seq', (SELECT max(id) FROM common_names))"
        )
        for table in ("taxa", "common_names", "common_name_words"):
            cursor.execute(f"ANALYZE {table}")
        raw.commit()
    finally:
        raw.close()

    print("done")


if __name__ == "__main__":
    main()
