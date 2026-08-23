from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.rag import query_rag


router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    species_context: str | None = None  # scientific name of currently viewed species
    filter_by_status: str | None = None  # e.g. "CR" to filter RAG corpus


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    question: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat endpoint for RAG-powered biodiversity questions."""
    
    # Validate question
    if not request.question or len(request.question.strip()) < 3:
        raise HTTPException(
            status_code=400,
            detail="Question must be at least 3 characters long"
        )
    
    # Build filter metadata if status filter provided
    filter_metadata = None
    if request.filter_by_status:
        filter_metadata = {"iucn_status": request.filter_by_status}
    
    # Query RAG system
    result = await query_rag(
        question=request.question,
        filter_metadata=filter_metadata,
        species_context=request.species_context
    )
    
    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
        question=request.question
    )


@router.get("/chat/suggestions")
async def get_chat_suggestions():
    """Get suggested starter questions for the chat interface."""
    return {
        "suggestions": [
            "Why is the European eel critically endangered?",
            "What are the main threats to polar bear habitats?",
            "What conservation measures protect the Iberian lynx?",
            "How does habitat loss affect amphibian populations in Europe?",
            "What does the WWF Living Planet Report say about freshwater biodiversity loss?",
            "Which European species have shown population recovery in recent decades?"
        ]
    }
