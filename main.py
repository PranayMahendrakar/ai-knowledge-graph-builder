print("hello")"""
AI Knowledge Graph Builder - Main FastAPI Application
"""
import os
import json
import uuid
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from modules.document_processor import DocumentProcessor
from modules.entity_extractor import EntityExtractor
from modules.relationship_builder import RelationshipBuilder
from modules.neo4j_client import Neo4jClient
from modules.graph_analytics import GraphAnalytics
from modules.llm_client import LLMClient

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────

app = FastAPI(
    title="AI Knowledge Graph Builder",
    description="Upload documents and build intelligent knowledge graphs with LLM + NLP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_path = Path("static")
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ─────────────────────────────────────────────
# Module Initialization
# ─────────────────────────────────────────────

neo4j_client = Neo4jClient(
    uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
    username=os.getenv("NEO4J_USER", "neo4j"),
    password=os.getenv("NEO4J_PASSWORD", "password"),
)

llm_client = LLMClient(
    provider=os.getenv("LLM_PROVIDER", "openai"),
    api_key=os.getenv("OPENAI_API_KEY", ""),
    model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
)

doc_processor = DocumentProcessor()
entity_extractor = EntityExtractor(llm_client=llm_client)
relationship_builder = RelationshipBuilder(llm_client=llm_client)
graph_analytics = GraphAnalytics()

# ─────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str
    limit: Optional[int] = 20

class GraphResponse(BaseModel):
    nodes: list
    edges: list
    stats: dict

# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main UI."""
    html_file = Path("static/index.html")
    if html_file.exists():
        return HTMLResponse(html_file.read_text())
    return HTMLResponse("<h1>AI Knowledge Graph Builder</h1><p>Static files not found.</p>")


@app.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a document (PDF, TXT, DOCX, MD) and process it into the knowledge graph.
    Processing runs in the background.
    """
    allowed_types = {
        "application/pdf", "text/plain", "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    
    # Accept by extension if content type is generic
    filename_lower = file.filename.lower()
    valid_ext = any(filename_lower.endswith(ext) for ext in [".pdf", ".txt", ".md", ".docx"])
    
    if file.content_type not in allowed_types and not valid_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Supported: PDF, TXT, DOCX, MD"
        )

    doc_id = str(uuid.uuid4())
    content = await file.read()

    background_tasks.add_task(
        process_document,
        doc_id=doc_id,
        filename=file.filename,
        content=content,
    )

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "status": "processing",
        "message": "Document is being processed. Check /status/{doc_id} for updates.",
    }


async def process_document(doc_id: str, filename: str, content: bytes):
    """Background task: extract text → entities → relationships → store in Neo4j."""
    try:
        # 1. Extract text from document
        text = doc_processor.extract_text(filename, content)

        # 2. Extract entities using LLM + spaCy
        entities = await entity_extractor.extract(text, doc_id=doc_id)

        # 3. Build relationships
        relationships = await relationship_builder.build(entities, text)

        # 4. Store in Neo4j
        await neo4j_client.store_graph(
            doc_id=doc_id,
            filename=filename,
            entities=entities,
            relationships=relationships,
        )
        
        print(f"[OK] Processed {filename}: {len(entities)} entities, {len(relationships)} relationships")

    except Exception as e:
        print(f"[ERROR] Failed to process {filename}: {e}")


@app.get("/graph", response_model=GraphResponse)
async def get_graph(limit: int = 500):
    """Retrieve the full knowledge graph."""
    graph = await neo4j_client.get_full_graph(limit=limit)
    stats = graph_analytics.compute_stats(graph["nodes"], graph["edges"])
    return {**graph, "stats": stats}


@app.post("/query")
async def query_graph(request: QueryRequest):
    """Natural language query over the knowledge graph."""
    cypher = await llm_client.nl_to_cypher(request.query)
    results = await neo4j_client.run_cypher(cypher, limit=request.limit)
    return {
        "query": request.query,
        "cypher": cypher,
        "results": results,
        "count": len(results),
    }


@app.get("/entities")
async def list_entities(
    entity_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    """List all extracted entities, optionally filtered by type."""
    entities = await neo4j_client.get_entities(
        entity_type=entity_type, limit=limit, offset=offset
    )
    return {"entities": entities, "count": len(entities)}


@app.get("/entity/{entity_id}")
async def get_entity(entity_id: str, depth: int = 2):
    """Get a single entity with its relationships (up to `depth` hops)."""
    entity = await neo4j_client.get_entity_subgraph(entity_id, depth=depth)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@app.delete("/graph")
async def clear_graph():
    """Clear the entire knowledge graph (all nodes and relationships)."""
    await neo4j_client.clear_graph()
    return {"message": "Knowledge graph cleared successfully"}


@app.get("/export/{format}")
async def export_graph(format: str):
    """Export the knowledge graph in the requested format (json | csv | graphml)."""
    valid_formats = {"json", "csv", "graphml"}
    if format not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Format must be one of: {valid_formats}")

    graph = await neo4j_client.get_full_graph()
    
    if format == "json":
        return JSONResponse(content=graph)
    elif format == "csv":
        csv_data = graph_analytics.to_csv(graph["nodes"], graph["edges"])
        return JSONResponse(content={"csv": csv_data})
    elif format == "graphml":
        graphml = graph_analytics.to_graphml(graph["nodes"], graph["edges"])
        return JSONResponse(content={"graphml": graphml})


@app.get("/analytics")
async def get_analytics():
    """Get graph analytics: centrality, clusters, statistics."""
    graph = await neo4j_client.get_full_graph()
    analytics = graph_analytics.full_analysis(graph["nodes"], graph["edges"])
    return analytics


@app.get("/status/{doc_id}")
async def get_status(doc_id: str):
    """Check the processing status of a document."""
    status = await neo4j_client.get_doc_status(doc_id)
    if not status:
        raise HTTPException(status_code=404, detail="Document not found")
    return status


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    neo4j_ok = await neo4j_client.ping()
    return {
        "status": "healthy" if neo4j_ok else "degraded",
        "neo4j": "connected" if neo4j_ok else "disconnected",
        "version": "1.0.0",
    }


# ─────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
