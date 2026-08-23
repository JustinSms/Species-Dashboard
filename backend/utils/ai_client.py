
"""Centralized AI client for LLM and embedding models."""
import os
from typing import Optional
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_anthropic import ChatAnthropic


class AIClient:
    """Singleton class for managing AI models (LLM and embeddings)."""
    
    _embeddings: Optional[HuggingFaceEmbeddings] = None
    _llm: Optional[ChatAnthropic] = None
    
    @classmethod
    def get_embeddings(cls) -> HuggingFaceEmbeddings:
        """
        Get the embeddings model instance (singleton).
        
        Returns:
            HuggingFaceEmbeddings instance using all-MiniLM-L6-v2
        """
        if cls._embeddings is None:
            cls._embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
        return cls._embeddings
    
    @classmethod
    def get_llm(cls, temperature: float = 0) -> ChatAnthropic:
        """
        Get the LLM instance.
        
        Args:
            temperature: Model temperature (default 0 for deterministic)
            
        Returns:
            ChatAnthropic instance
        """
        if cls._llm is None or cls._llm.temperature != temperature:
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError(
                    "ANTHROPIC_API_KEY environment variable is not set. "
                    "Please configure it in your Railway project settings or .env file."
                )
            
            cls._llm = ChatAnthropic(
                model="claude-3-5-sonnet-20241022",
                temperature=temperature,
                api_key=api_key
            )
        return cls._llm
    
    @classmethod
    def reset(cls):
        """Reset all cached model instances (useful for testing)."""
        cls._embeddings = None
        cls._llm = None
    