"""
modules/relationship_builder.py
Build relationships between entities using LLM and co-occurrence analysis.
"""
import re
from collections import defaultdict

CO_OCCUR_WINDOW = 100
MIN_CO_OCCUR = 2


class RelationshipBuilder:
    """Build relationships via LLM and co-occurrence analysis."""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    async def build(self, entities: list, text: str) -> list:
        """Build relationships from entities and source text."""
        relationships = {}

        # Stage 1: LLM-based relationship extraction
        if self.llm_client and len(entities) >= 2:
            try:
                llm_rels = await self.llm_client.extract_relationships_prompt(entities, text)
                for rel in llm_rels:
                    validated = self._validate_rel(rel, entities)
                    if validated:
                        key = self._rel_key(validated)
                        relationships[key] = validated
            except Exception as e:
                print(f"LLM relationship extraction error: {e}")

        # Stage 2: Co-occurrence analysis
        co_occur_rels = self._cooccurrence_analysis(entities, text)
        for rel in co_occur_rels:
            key = self._rel_key(rel)
            if key not in relationships:
                relationships[key] = rel

        result = list(relationships.values())
        print(f"Built {len(result)} relationships")
        return result

    def _validate_rel(self, rel: dict, entities: list):
        """Validate and normalize a relationship dict."""
        source = rel.get("source", "").strip()
        target = rel.get("target", "").strip()
        relationship = rel.get("relationship", "RELATED_TO").strip().upper()
        description = rel.get("description", "")

        if not source or not target or source == target:
            return None

        relationship = re.sub(r"[^A-Z0-9_]", "_", relationship)
        relationship = re.sub(r"_+", "_", relationship).strip("_")
        if not relationship:
            relationship = "RELATED_TO"

        source_id = self._find_entity_id(source, entities)
        target_id = self._find_entity_id(target, entities)

        if not source_id or not target_id:
            return None

        return {
            "id": f"{source_id}__{relationship}__{target_id}",
            "source": source,
            "source_id": source_id,
            "target": target,
            "target_id": target_id,
            "relationship": relationship,
            "description": description,
            "weight": 1.0,
            "source_type": "llm",
        }

    def _cooccurrence_analysis(self, entities: list, text: str) -> list:
        """Find entities that co-occur within a sliding text window."""
        if len(entities) < 2:
            return []

        words = text.split()
        entity_positions = defaultdict(list)

        for ent in entities:
            name = ent["name"].lower()
            for i, word in enumerate(words):
                if name in " ".join(words[max(0,i-1):i+3]).lower():
                    entity_positions[ent["id"]].append(i)

        cooccur = defaultdict(int)
        entity_ids = list(entity_positions.keys())

        for i, eid1 in enumerate(entity_ids):
            for eid2 in entity_ids[i+1:]:
                for pos1 in entity_positions[eid1]:
                    for pos2 in entity_positions[eid2]:
                        if abs(pos1 - pos2) <= CO_OCCUR_WINDOW:
                            pair = tuple(sorted([eid1, eid2]))
                            cooccur[pair] += 1

        entity_map = {e["id"]: e for e in entities}
        relationships = []

        for (eid1, eid2), count in cooccur.items():
            if count >= MIN_CO_OCCUR:
                e1 = entity_map.get(eid1)
                e2 = entity_map.get(eid2)
                if e1 and e2:
                    relationships.append({
                        "id": f"{eid1}__COOCCURS_WITH__{eid2}",
                        "source": e1["name"],
                        "source_id": eid1,
                        "target": e2["name"],
                        "target_id": eid2,
                        "relationship": "COOCCURS_WITH",
                        "description": f"Co-occurs {count} times in document",
                        "weight": min(count / 10.0, 1.0),
                        "source_type": "cooccurrence",
                    })

        return relationships

    def _find_entity_id(self, name: str, entities: list):
        """Find entity ID by name (case-insensitive)."""
        name_lower = name.lower().strip()
        for ent in entities:
            if ent["name"].lower().strip() == name_lower:
                return ent["id"]
        for ent in entities:
            if name_lower in ent["name"].lower() or ent["name"].lower() in name_lower:
                return ent["id"]
        return None

    def _rel_key(self, rel: dict) -> str:
        """Generate a dedup key for a relationship."""
        s = rel.get("source_id", "")
        r = rel.get("relationship", "")
        t = rel.get("target_id", "")
        return f"{s}::{r}::{t}"
