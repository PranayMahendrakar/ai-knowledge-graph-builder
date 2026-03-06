"""
modules/neo4j_client.py
Neo4j database client for storing and querying the knowledge graph.
"""
import asyncio
from typing import Optional
from datetime import datetime


class Neo4jClient:
    """Async-compatible Neo4j client using the official neo4j driver."""

    def __init__(self, uri: str, username: str, password: str):
        self.uri = uri
        self.username = username
        self.password = password
        self._driver = None

    def _get_driver(self):
        """Lazy-initialize the Neo4j driver."""
        if self._driver is None:
            from neo4j import GraphDatabase
            self._driver = GraphDatabase.driver(
                self.uri, auth=(self.username, self.password)
            )
        return self._driver

    def _run_sync(self, cypher: str, params: dict = None):
        """Run a Cypher query synchronously."""
        driver = self._get_driver()
        with driver.session() as session:
            result = session.run(cypher, params or {})
            return result.data()

    async def _run(self, cypher: str, params: dict = None) -> list:
        """Run a Cypher query asynchronously (via thread executor)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self._run_sync(cypher, params)
        )

    async def ping(self) -> bool:
        """Check if Neo4j is reachable."""
        try:
            await self._run("RETURN 1 as ping")
            return True
        except Exception:
            return False

    async def store_graph(self, doc_id: str, filename: str, entities: list, relationships: list):
        """Store entities and relationships in Neo4j."""
        # Create document node
        await self._run(
            "MERGE (d:Document {id: $id}) SET d.filename = $filename, d.created_at = $ts",
            {"id": doc_id, "filename": filename, "ts": datetime.utcnow().isoformat()}
        )

        # Create entity nodes
        for ent in entities:
            cypher = (
                "MERGE (e {id: $id}) "
                "ON CREATE SET e.name = $name, e.type = $type, e.description = $desc, e.created_at = $ts "
                "ON MATCH SET e.description = CASE WHEN e.description = \"\" THEN $desc ELSE e.description END "
                "WITH e "
                "CALL apoc.create.addLabels(e, [$type]) YIELD node "
                "MERGE (d:Document {id: $doc_id}) "
                "MERGE (d)-[:CONTAINS]->(e)"
            )
            try:
                await self._run(cypher, {
                    "id": ent["id"],
                    "name": ent["name"],
                    "type": ent.get("type", "OTHER"),
                    "desc": ent.get("description", ""),
                    "ts": datetime.utcnow().isoformat(),
                    "doc_id": doc_id,
                })
            except Exception:
                # Fallback without APOC
                await self._store_entity_no_apoc(ent, doc_id)

        # Create relationships
        for rel in relationships:
            await self._store_relationship(rel)

    async def _store_entity_no_apoc(self, ent: dict, doc_id: str):
        """Store entity without APOC (standard Neo4j)."""
        ent_type = ent.get("type", "Entity").replace(" ", "_")
        cypher = (
            f"MERGE (e:Entity {{id: $id}}) "
            f"SET e.name = $name, e.type = $type, e.description = $desc "
            f"MERGE (d:Document {{id: $doc_id}}) "
            f"MERGE (d)-[:CONTAINS]->(e)"
        )
        await self._run(cypher, {
            "id": ent["id"],
            "name": ent["name"],
            "type": ent.get("type", "OTHER"),
            "desc": ent.get("description", ""),
            "doc_id": doc_id,
        })

    async def _store_relationship(self, rel: dict):
        """Store a relationship between two entities."""
        rel_type = rel.get("relationship", "RELATED_TO")
        cypher = (
            f"MATCH (s:Entity {{id: $source_id}}), (t:Entity {{id: $target_id}}) "
            f"MERGE (s)-[r:{rel_type} {{id: $rel_id}}]->(t) "
            f"SET r.description = $desc, r.weight = $weight, r.source_type = $st"
        )
        try:
            await self._run(cypher, {
                "source_id": rel["source_id"],
                "target_id": rel["target_id"],
                "rel_id": rel.get("id", ""),
                "desc": rel.get("description", ""),
                "weight": rel.get("weight", 1.0),
                "st": rel.get("source_type", ""),
            })
        except Exception as e:
            print(f"Failed to store relationship: {e}")

    async def get_full_graph(self, limit: int = 500) -> dict:
        """Retrieve all entities and relationships."""
        nodes_data = await self._run(
            "MATCH (e:Entity) RETURN e.id AS id, e.name AS name, e.type AS type, "
            "e.description AS description LIMIT $limit",
            {"limit": limit}
        )
        edges_data = await self._run(
            "MATCH (s:Entity)-[r]->(t:Entity) "
            "RETURN s.id AS source, t.id AS target, type(r) AS relationship, "
            "r.description AS description, r.weight AS weight LIMIT $limit",
            {"limit": limit}
        )
        return {"nodes": nodes_data, "edges": edges_data}

    async def get_entities(self, entity_type: str = None, limit: int = 100, offset: int = 0) -> list:
        """List entities with optional type filter."""
        if entity_type:
            result = await self._run(
                "MATCH (e:Entity) WHERE e.type = $type RETURN e SKIP $offset LIMIT $limit",
                {"type": entity_type.upper(), "offset": offset, "limit": limit}
            )
        else:
            result = await self._run(
                "MATCH (e:Entity) RETURN e SKIP $offset LIMIT $limit",
                {"offset": offset, "limit": limit}
            )
        return [r["e"] for r in result]

    async def get_entity_subgraph(self, entity_id: str, depth: int = 2) -> dict:
        """Get entity and its neighborhood."""
        result = await self._run(
            "MATCH path = (e:Entity {id: $id})-[*1..$depth]-(n) "
            "RETURN path",
            {"id": entity_id, "depth": depth}
        )
        if not result:
            entity = await self._run(
                "MATCH (e:Entity {id: $id}) RETURN e", {"id": entity_id}
            )
            return entity[0]["e"] if entity else None
        return {"paths": result}

    async def run_cypher(self, cypher: str, limit: int = 20) -> list:
        """Run arbitrary Cypher query with limit injection."""
        if "LIMIT" not in cypher.upper():
            cypher = cypher.rstrip(";") + f" LIMIT {limit}"
        try:
            return await self._run(cypher)
        except Exception as e:
            return [{"error": str(e)}]

    async def clear_graph(self):
        """Delete all nodes and relationships."""
        await self._run("MATCH (n) DETACH DELETE n")

    async def get_doc_status(self, doc_id: str):
        """Get document processing status."""
        result = await self._run(
            "MATCH (d:Document {id: $id}) RETURN d", {"id": doc_id}
        )
        if not result:
            return None
        doc = result[0]["d"]
        # Count entities
        count = await self._run(
            "MATCH (d:Document {id: $id})-[:CONTAINS]->(e) RETURN count(e) AS cnt",
            {"id": doc_id}
        )
        return {
            "doc_id": doc_id,
            "filename": doc.get("filename", ""),
            "created_at": doc.get("created_at", ""),
            "entity_count": count[0]["cnt"] if count else 0,
            "status": "completed",
        }

    def close(self):
        """Close the driver connection."""
        if self._driver:
            self._driver.close()
            self._driver = None
