test content# 🧠 AI Knowledge Graph Builder

Upload documents → system builds knowledge graph with entity extraction and relationship visualization.

[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green)](https://fastapi.tiangolo.com)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.x-blue)](https://neo4j.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://PranayMahendrakar.github.io/ai-knowledge-graph-builder)

---

## 🚀 Live Demo

👉 [View Interactive Knowledge Graph Demo](https://PranayMahendrakar.github.io/ai-knowledge-graph-builder)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📄 **Document Upload** | PDF, TXT, DOCX, MD support |
| 🔍 **Entity Extraction** | LLM + spaCy NER pipeline |
| 🔗 **Relationship Building** | Automatic co-occurrence & semantic linking |
| 🌐 **Graph Visualization** | Interactive D3.js force-directed graph |
| 🗄️ **Neo4j Backend** | Persistent graph database storage |
| 📊 **Graph Analytics** | Centrality, clustering, path finding |
| 🔎 **Query Interface** | Natural language graph queries |
| 📤 **Export** | JSON, CSV, GraphML export |

---

## 🏗️ Architecture

```
+----------------------------------------------------------+
|                    Frontend (HTML/JS)                     |
|  +-----------------+  +--------------+  +-------------+  |
|  | Document Upload |  | D3.js Graph  |  | Query Panel |  |
|  +-----------------+  +--------------+  +-------------+  |
+-----------------------------+----------------------------+
                              | REST API
+-----------------------------v----------------------------+
|                    FastAPI Backend                        |
|  +-----------------+  +--------------+  +-------------+  |
|  | Doc Processor   |  | NLP Extractor|  | Graph Builder|  |
|  +-----------------+  +--------------+  +-------------+  |
|  +-----------------+  +--------------+  +-------------+  |
|  | LLM Client      |  | Neo4j Driver |  | Analytics   |  |
|  +-----------------+  +--------------+  +-------------+  |
+----------------------------------------------------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
    +----------+      +------------+     +-----------+
    |  Neo4j   |      | OpenAI /   |     | spaCy NLP |
    | Graph DB |      | Anthropic  |     | Pipeline  |
    +----------+      +------------+     +-----------+
```

---

## 🧪 Example Knowledge Graph

```
Einstein --[DEVELOPED]--> Theory of Relativity
    |                           |
    |                      [BELONGS_TO]
    |                           |
[WON]                        Physics
    |                           |
    v                      [HAS_FIELD]
Nobel Prize <--[AWARDED_IN]-- Quantum Mechanics
    |
[SHARED_WITH]
    |
    v
  Bohr --[DEBATED]--> Einstein
```

---

## Tech Stack

- **LLM**: OpenAI GPT-4 / Anthropic Claude for intelligent entity extraction
- **NLP**: spaCy (en_core_web_sm) for Named Entity Recognition
- **Graph DB**: Neo4j 5.x with Cypher query language
- **Backend**: FastAPI + Python 3.10+
- **Frontend**: Vanilla JS + D3.js for graph visualization
- **Document Processing**: PyMuPDF, python-docx, pdfplumber
- **Graph Analytics**: NetworkX for in-memory graph algorithms

---

## 📁 Project Structure

```
ai-knowledge-graph-builder/
├── main.py                     # FastAPI application entry point
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
├── docker-compose.yml          # Neo4j + App deployment
├── modules/
│   ├── __init__.py
│   ├── document_processor.py   # PDF/DOCX/TXT parsing
│   ├── entity_extractor.py     # LLM + spaCy NER pipeline
│   ├── relationship_builder.py # Relationship detection
│   ├── neo4j_client.py         # Neo4j database client
│   ├── graph_analytics.py      # Graph algorithms
│   └── llm_client.py           # LLM API abstraction
├── static/
│   ├── index.html              # Main UI
│   ├── graph.js                # D3.js visualization
│   ├── app.js                  # Frontend logic
│   └── style.css               # Styles
└── docs/
    └── examples/               # Sample knowledge graphs
```

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/PranayMahendrakar/ai-knowledge-graph-builder.git
cd ai-knowledge-graph-builder
cp .env.example .env
# Edit .env with your API keys
docker-compose up -d
open http://localhost:8000
```

### Option 2: Local Setup

```bash
git clone https://github.com/PranayMahendrakar/ai-knowledge-graph-builder.git
cd ai-knowledge-graph-builder
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env
uvicorn main:app --reload --port 8000
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /upload | Upload document for processing |
| GET | /graph | Get full knowledge graph |
| POST | /query | Natural language graph query |
| GET | /entities | List all entities |
| GET | /entity/{id} | Get entity details + relationships |
| DELETE | /graph | Clear the knowledge graph |
| GET | /export/{format} | Export graph (json/csv/graphml) |
| GET | /analytics | Graph statistics and metrics |

---

## 🧩 Entity Types Supported

- PERSON - People, historical figures, scientists
- ORG - Organizations, companies, institutions
- GPE - Countries, cities, locations
- CONCEPT - Abstract ideas, theories, fields
- DATE - Time periods and dates
- TECHNOLOGY - Tools, methods, innovations
- AWARD - Prizes, honors, recognitions
- WORK - Books, papers, publications

---

## 📝 License

MIT License - see LICENSE for details.

*Built with FastAPI, Neo4j, spaCy, OpenAI, and D3.js*
