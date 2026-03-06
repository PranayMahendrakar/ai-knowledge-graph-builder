"""
modules/graph_analytics.py
Graph analytics using NetworkX for centrality, clustering, and export.
"""
import json
import csv
import io
from typing import Optional


class GraphAnalytics:
    """
    Provides graph analytics and export functionality.
    Uses NetworkX for in-memory graph operations.
    """

    def _build_nx_graph(self, nodes: list, edges: list):
        """Build a NetworkX DiGraph from nodes and edges."""
        try:
            import networkx as nx
            G = nx.DiGraph()
            for node in nodes:
                node_id = node.get("id", node.get("name", ""))
                G.add_node(node_id, **{k: v for k, v in node.items() if v is not None})
            for edge in edges:
                source = edge.get("source", "")
                target = edge.get("target", "")
                if source and target:
                    G.add_edge(source, target, **{k: v for k, v in edge.items() if v is not None})
            return G
        except ImportError:
            return None

    def compute_stats(self, nodes: list, edges: list) -> dict:
        """Compute basic graph statistics."""
        return {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "density": len(edges) / max(len(nodes) * (len(nodes) - 1), 1),
        }

    def full_analysis(self, nodes: list, edges: list) -> dict:
        """Full graph analysis including centrality and communities."""
        stats = self.compute_stats(nodes, edges)
        G = self._build_nx_graph(nodes, edges)
        if G is None:
            return {**stats, "message": "NetworkX not available"}

        import networkx as nx

        try:
            pagerank = nx.pagerank(G, alpha=0.85)
            degree_cent = dict(nx.degree_centrality(G))
            top_entities = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)[:10]
        except Exception:
            pagerank = {}
            degree_cent = {}
            top_entities = []

        try:
            undirected = G.to_undirected()
            communities = list(nx.connected_components(undirected))
            community_count = len(communities)
        except Exception:
            community_count = 0

        try:
            is_dag = nx.is_directed_acyclic_graph(G)
        except Exception:
            is_dag = False

        entity_type_counts = {}
        for node in nodes:
            etype = node.get("type", "OTHER")
            entity_type_counts[etype] = entity_type_counts.get(etype, 0) + 1

        rel_type_counts = {}
        for edge in edges:
            rtype = edge.get("relationship", "UNKNOWN")
            rel_type_counts[rtype] = rel_type_counts.get(rtype, 0) + 1

        return {
            **stats,
            "top_entities_by_pagerank": [
                {"id": eid, "score": round(score, 4)} for eid, score in top_entities
            ],
            "community_count": community_count,
            "is_dag": is_dag,
            "entity_type_distribution": entity_type_counts,
            "relationship_type_distribution": rel_type_counts,
        }

    def shortest_path(self, nodes: list, edges: list, source_id: str, target_id: str):
        """Find shortest path between two entities."""
        G = self._build_nx_graph(nodes, edges)
        if G is None:
            return {"error": "NetworkX not available"}
        import networkx as nx
        try:
            path = nx.shortest_path(G, source_id, target_id)
            return {"path": path, "length": len(path) - 1}
        except nx.NetworkXNoPath:
            return {"path": [], "length": -1, "message": "No path found"}
        except nx.NodeNotFound as e:
            return {"error": str(e)}

    def to_csv(self, nodes: list, edges: list) -> str:
        """Export graph as CSV (nodes + edges)."""
        output = io.StringIO()
        output.write("# NODES\n")
        if nodes:
            writer = csv.DictWriter(output, fieldnames=nodes[0].keys())
            writer.writeheader()
            writer.writerows(nodes)
        output.write("\n# EDGES\n")
        if edges:
            writer = csv.DictWriter(output, fieldnames=edges[0].keys())
            writer.writeheader()
            writer.writerows(edges)
        return output.getvalue()

    def to_graphml(self, nodes: list, edges: list) -> str:
        """Export graph as GraphML XML."""
        G = self._build_nx_graph(nodes, edges)
        if G is None:
            return "<graphml/>"
        import networkx as nx
        output = io.BytesIO()
        nx.write_graphml(G, output)
        return output.getvalue().decode("utf-8")
