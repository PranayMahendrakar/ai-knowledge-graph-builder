"""
modules/llm_client.py
LLM API abstraction supporting OpenAI and Anthropic.
"""
import json
import os
from typing import Optional


class LLMClient:
    """Unified LLM client supporting OpenAI and Anthropic."""

    def __init__(self, provider: str = "openai", api_key: str = "", model: str = "gpt-4o-mini"):
        self.provider = provider.lower()
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client:
            return self._client
        if self.provider == "openai":
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=self.api_key)
        elif self.provider == "anthropic":
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", self.api_key))
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")
        return self._client

    async def complete(self, system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        """Get a completion from the LLM."""
        client = self._get_client()
        if self.provider == "openai":
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=4096,
            )
            return response.choices[0].message.content
        elif self.provider == "anthropic":
            response = await client.messages.create(
                model=self.model or "claude-3-haiku-20240307",
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=temperature,
                max_tokens=4096,
            )
            return response.content[0].text

    async def extract_entities_prompt(self, text: str) -> list:
        """Use LLM to extract entities from text."""
        system = """You are a knowledge graph entity extractor.
Extract all named entities from the text and return them as JSON.
Entity types: PERSON, ORG, GPE, CONCEPT, DATE, TECHNOLOGY, AWARD, WORK, EVENT, OTHER.
Return ONLY a valid JSON array with fields: name, type, description."""

        user = "Extract entities from this text:\n\n" + text[:4000]

        try:
            result = await self.complete(system, user)
            result = result.strip()
            if result.startswith("```"):
                result = result.split("```")[1]
                if result.startswith("json"):
                    result = result[4:]
            return json.loads(result)
        except Exception as e:
            print(f"LLM entity extraction error: {e}")
            return []

    async def extract_relationships_prompt(self, entities: list, text: str) -> list:
        """Use LLM to extract relationships between entities."""
        entity_names = [e["name"] for e in entities[:30]]

        system = """You are a knowledge graph relationship extractor.
Given entities and text, identify relationships between entities.
Return ONLY a valid JSON array with fields: source, target, relationship, description.
Use UPPERCASE_WITH_UNDERSCORES for relationship types."""

        user = "Entities: " + json.dumps(entity_names) + "\n\nText: " + text[:4000] + "\n\nExtract relationships."

        try:
            result = await self.complete(system, user)
            result = result.strip()
            if result.startswith("```"):
                result = result.split("```")[1]
                if result.startswith("json"):
                    result = result[4:]
            return json.loads(result)
        except Exception as e:
            print(f"LLM relationship extraction error: {e}")
            return []

    async def nl_to_cypher(self, query: str) -> str:
        """Convert natural language to Cypher query."""
        system = """You are a Neo4j Cypher query generator.
Convert natural language questions to Cypher queries.
Return ONLY the Cypher query, no explanation.
Example: MATCH (n:PERSON)-[r]->(m) WHERE n.name CONTAINS 'Einstein' RETURN n, r, m LIMIT 20"""

        user = "Convert to Cypher: " + query

        try:
            cypher = await self.complete(system, user, temperature=0.0)
            return cypher.strip()
        except Exception as e:
            print(f"NL to Cypher error: {e}")
            return "MATCH (n) RETURN n LIMIT 20"
