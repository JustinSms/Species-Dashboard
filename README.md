# Biodiversity Intelligence

AI-powered species occurrence tracking, population trend analysis, and biodiversity Q&A using LangChain RAG over IUCN Red List data.

**Stack:** React · FastAPI · uv · LangChain · pgvector · PostgreSQL · GBIF API · IUCN Red List API · Anthropic Claude · Railway

## Local Development

1. `cp .env.example .env` — fill in DATABASE_URL, ANTHROPIC_API_KEY, IUCN_API_KEY
2. Start PostgreSQL with pgvector:
   ```bash
   docker run -p 5432:5432 -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=biodiversity ankane/pgvector
   ```
3. `cd backend && uv sync`
4. `uv run python scripts/ingest_iucn.py` — ingest IUCN species narratives into pgvector
5. `uv run uvicorn main:app --reload` — backend on http://localhost:8000
6. In a second terminal: `cd frontend && npm install && npm run dev` — frontend on http://localhost:5173

Optionally: drop PDF reports into `backend/data/corpus/` and run `uv run python scripts/ingest_pdfs.py`

## Railway Deployment

1. Create a new Railway project
2. Add the PostgreSQL plugin — DATABASE_URL is injected automatically
3. Set environment variables: ANTHROPIC_API_KEY, IUCN_API_KEY
4. Connect your GitHub repository
5. Railway auto-detects railway.toml and deploys on every push to main

## API Reference

- `GET  /api/health`
- `GET  /api/species/search?q=`
- `GET  /api/species/{gbif_key}`
- `GET  /api/species/{gbif_key}/occurrences`
- `GET  /api/species/{gbif_key}/occurrence-points`
- `GET  /api/analysis/trends/{gbif_key}`
- `GET  /api/analysis/region/{iso2}`
- `POST /api/chat`
- `GET  /api/chat/suggestions`