"""Ingest PDF documents from corpus directory into vector store."""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import fitz  # PyMuPDF
from services.rag import init_rag, add_documents


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping chunks.
    
    Args:
        text: Text to chunk
        chunk_size: Size of each chunk in characters
        overlap: Number of overlapping characters between chunks
        
    Returns:
        List of text chunks
    """
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Only add non-empty chunks
        if chunk.strip():
            chunks.append(chunk)
        
        # Move start position (with overlap)
        start = end - overlap
    
    return chunks


def ingest_pdf(pdf_path: Path):
    """
    Ingest a single PDF file into the vector store.
    
    Args:
        pdf_path: Path to the PDF file
    """
    print(f"\nProcessing: {pdf_path.name}")
    
    try:
        # Open PDF
        doc = fitz.open(pdf_path)
        total_chunks = 0
        
        # Process each page
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            # Skip empty pages
            if not text.strip():
                continue
            
            # Chunk the page text
            chunks = chunk_text(text, chunk_size=500, overlap=50)
            
            # Prepare metadata for each chunk
            metadatas = [
                {
                    "source": "pdf",
                    "filename": pdf_path.name,
                    "page": page_num + 1  # 1-indexed for user-friendliness
                }
                for _ in chunks
            ]
            
            # Add to vector store
            if chunks:
                add_documents(chunks, metadatas)
                total_chunks += len(chunks)
            
            print(f"  Page {page_num + 1}/{len(doc)}: {len(chunks)} chunks")
        
        doc.close()
        print(f"✓ Ingested {pdf_path.name}: {total_chunks} total chunks")
        
    except Exception as e:
        print(f"Error processing {pdf_path.name}: {e}")


def main():
    """Main ingestion function for PDFs."""
    print("Starting PDF corpus ingestion...")
    print("=" * 60)
    
    # Initialize RAG system
    init_rag()
    
    # Find all PDFs in corpus directory
    corpus_dir = Path(__file__).parent.parent / "data" / "corpus"
    
    if not corpus_dir.exists():
        print(f"Directory not found: {corpus_dir}")
        return
    
    pdf_files = list(corpus_dir.glob("*.pdf"))
    
    if not pdf_files:
        print(f"No PDF files found in {corpus_dir}")
        print("Place PDF documents in backend/data/corpus/ to ingest them.")
        return
    
    print(f"Found {len(pdf_files)} PDF file(s)")
    print("=" * 60)
    
    # Process each PDF
    for i, pdf_path in enumerate(pdf_files, 1):
        print(f"\n[{i}/{len(pdf_files)}]")
        ingest_pdf(pdf_path)
    
    print("\n" + "=" * 60)
    print(f"Completed ingestion of {len(pdf_files)} PDF file(s)")


if __name__ == "__main__":
    main()
