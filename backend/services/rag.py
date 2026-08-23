"""RAG (Retrieval Augmented Generation) service for biodiversity intelligence."""
import os
from typing import Optional
from langchain_postgres import PGVector
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from utils.ai_client import AIClient


# Global vector store (lazy initialization)
vector_store = None


def init_rag():
    """Initialize the RAG system with vector store and embeddings."""
    global vector_store
    
    print("Initializing RAG system...")
    
    # Get database URL (should already be validated in database.py)
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError(
            "DATABASE_URL environment variable is not set. "
            "Please configure it in your Railway project settings."
        )
    
    vector_store = PGVector(
        embeddings=AIClient.get_embeddings(),
        collection_name="biodiversity_docs",
        connection=database_url,
        use_jsonb=True,
    )
    
    print("RAG system initialized")


def get_retriever(filter_metadata: Optional[dict] = None):
    """
    Get a retriever for similarity search.
    
    Args:
        filter_metadata: Optional metadata filters for search
        
    Returns:
        Configured retriever instance
    """
    kwargs = {"k": 5}
    if filter_metadata:
        kwargs["filter"] = filter_metadata
    
    return vector_store.as_retriever(
        search_type="similarity",
        search_kwargs=kwargs
    )


def format_docs(docs):
    """Format retrieved documents into a single string."""
    return "\n\n".join(doc.page_content for doc in docs)


async def query_rag(
    question: str,
    filter_metadata: Optional[dict] = None,
    species_context: Optional[str] = None
) -> dict:
    """
    Query the RAG system with a question.
    
    Args:
        question: The user's question
        filter_metadata: Optional metadata filters for document retrieval
        species_context: Optional species-specific context to include
        
    Returns:
        Dictionary with 'answer' (str) and 'sources' (list of source names)
    """
    # Build system instructions
    system_instructions = """You are a biodiversity expert assistant. Your task is to answer questions using ONLY the information provided in the retrieved documents.

IMPORTANT RULES:
1. Answer ONLY based on the retrieved documents - do not use external knowledge
2. ALWAYS cite the source document name in your answer
3. If the retrieved documents don't contain enough information to answer the question, respond with "I don't have enough information in the available documents to answer this question."
4. Be precise and factual - never hallucinate or make up information
5. When multiple sources are relevant, cite all of them"""

    if species_context:
        system_instructions += f"\n\nCurrent species context: {species_context}"
    
    # Create prompt template using modern LangChain
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_instructions),
        ("human", """Retrieved Context:
{context}

Question: {question}

Answer (with source citations):""")
    ])
    
    # Get LLM from AIClient
    llm = AIClient.get_llm(temperature=0)
    
    # Get retriever
    retriever = get_retriever(filter_metadata=filter_metadata)
    
    # Build RAG chain using LCEL (LangChain Expression Language)
    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    
    # Get documents for source tracking
    docs = retriever.get_relevant_documents(question)
    
    # Execute query
    answer = rag_chain.invoke(question)
    
    # Extract sources from documents
    sources = []
    for doc in docs:
        source = doc.metadata.get("source")
        if source and source not in sources:
            sources.append(source)
    
    return {
        "answer": answer,
        "sources": sources
    }


def add_documents(texts: list[str], metadatas: list[dict]):
    """
    Add documents to the vector store.
    
    Args:
        texts: List of document texts to add
        metadatas: List of metadata dictionaries (one per text)
    """
    if not vector_store:
        raise RuntimeError("Vector store not initialized. Call init_rag() first.")
    
    vector_store.add_texts(texts, metadatas=metadatas)
