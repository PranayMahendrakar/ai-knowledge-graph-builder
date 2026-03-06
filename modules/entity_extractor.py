"""
modules/entity_extractor.py
Entity extraction pipeline combining LLM and spaCy NER.
"""
import hashlib
import re
from typing import Optional


# Entity type mapping from spaCy labels to our types
SPACY_TYPE_MAP = {
    "PERSON": "PERSON",
    "ORG": "ORG",
    "GPE": "GPE",
    "LOC": "GPE",
    "DATE": "DATE",
    "TIME": "DATE",
    "PRODUCT": "TECHNOLOGY",
    "EVENT": "EVENT",
    "WORK_OF_ART": "WORK",
    "LAW": "CONCEPT",
    "LANGUAGE": "CONCEPT",
    "NORP": "ORG",
    "FAC": "GPE",
    "MONEY": "OTHER",
    "PERCENT": "OTHER",
    "QUANTITY": "OTHER",
    "ORDINAL": "OTHER",
    "CARDINAL": "OTHER",
}

# Stopwords to filter out
STOP_ENTITIES = {
    "the", "a", "an", "this", "that", "these", "those",
    "it", "he", "she", "they", "we", "you", "i",
}


class EntityExtractor:
    """
    Extracts named entities using a two-stage pipeline:
    1. spaCy NER for fast, rule-based extraction
    2. LLM for semantic enrichment and concept detection
    """

    def __init__(self, llm_client=None, use_spacy: bool = True):
        self.llm_client = llm_client
        self.use_spacy = use_spacy
        self._nlp = None

    def _get_nlp(self):
        """Lazy-load spaCy model."""
        if self._nlp is not None:
            return self._nlp
        try:
            import spacy
            try:
                self._nlp = spacy.load("en_core_web_trf")
            except OSError:
                try:
                    self._nlp = spacy.load("en_core_web_sm")
                except OSError:
                    print("No spaCy model found. Install: python -m spacy download en_core_web_sm")
                    self._nlp = None
        except ImportError:
            print("spaCy not installed.")
            self._nlp = None
        return self._nlp

    async def extract(self, text: str, doc_id: str = "") -> list:
        """
        Full extraction pipeline: spaCy + LLM.
        Returns deduplicated list of entity dicts.
        """
        entities = {}

        # Stage 1: spaCy NER
        if self.use_spacy:
            spacy_entities = self._extract_spacy(text)
            for ent in spacy_entities:
                key = self._entity_key(ent["name"])
                entities[key] = ent

        # Stage 2: LLM extraction (for concepts, technologies, relationships)
        if self.llm_client:
            try:
                llm_entities = await self.llm_client.extract_entities_prompt(text)
                for ent in llm_entities:
                    if self._is_valid_entity(ent):
                        key = self._entity_key(ent.get("name", ""))
                        if key not in entities:
                            entities[key] = {
                                "id": self._generate_id(ent.get("name", ""), doc_id),
                                "name": ent.get("name", "").strip(),
                                "type": ent.get("type", "OTHER").upper(),
                                "description": ent.get("description", ""),
                                "source": "llm",
                                "doc_id": doc_id,
                            }
                        else:
                            # Enrich existing with LLM description
                            if not entities[key].get("description"):
                                entities[key]["description"] = ent.get("description", "")
            except Exception as e:
                print(f"LLM extraction error: {e}")

        result = list(entities.values())
        print(f"Extracted {len(result)} entities from doc {doc_id}")
        return result

    def _extract_spacy(self, text: str) -> list:
        """Run spaCy NER on text."""
        nlp = self._get_nlp()
        if nlp is None:
            return []

        entities = []
        # Process in chunks to avoid memory issues
        max_len = 100_000
        chunks = [text[i:i+max_len] for i in range(0, len(text), max_len)]

        for chunk in chunks:
            try:
                doc = nlp(chunk)
                for ent in doc.ents:
                    name = ent.text.strip()
                    if not self._is_valid_name(name):
                        continue
                    ent_type = SPACY_TYPE_MAP.get(ent.label_, "OTHER")
                    entities.append({
                        "id": self._generate_id(name, ""),
                        "name": name,
                        "type": ent_type,
                        "description": "",
                        "source": "spacy",
                        "spacy_label": ent.label_,
                        "doc_id": "",
                    })
            except Exception as e:
                print(f"spaCy processing error: {e}")

        return entities

    def _is_valid_entity(self, ent: dict) -> bool:
        """Check if entity dict is valid."""
        name = ent.get("name", "").strip()
        return bool(name) and len(name) > 1 and name.lower() not in STOP_ENTITIES

    def _is_valid_name(self, name: str) -> bool:
        """Check if entity name is meaningful."""
        if len(name) < 2 or len(name) > 100:
            return False
        if name.lower() in STOP_ENTITIES:
            return False
        if re.match(r"^[\d\s\W]+$", name):
            return False
        return True

    def _entity_key(self, name: str) -> str:
        """Normalize entity name for deduplication."""
        return re.sub(r"\s+", " ", name.lower().strip())

    def _generate_id(self, name: str, doc_id: str) -> str:
        """Generate a stable ID for an entity."""
        raw = f"{name.lower().strip()}:{doc_id}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]
