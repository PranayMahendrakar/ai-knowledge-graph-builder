/**
 * graph.js — D3.js Knowledge Graph Visualization
 * Force-directed graph with zoom, pan, tooltips, and node selection.
 */

const ENTITY_COLORS = {
  PERSON: "#4f86f7",
  ORG: "#f79f4f",
  GPE: "#4fb375",
  CONCEPT: "#b44ff7",
  TECHNOLOGY: "#f74f4f",
  AWARD: "#f7d44f",
  WORK: "#4fd4f7",
  DATE: "#a0a0a0",
  EVENT: "#f76490",
  OTHER: "#888888",
};

const ENTITY_ICONS = {
  PERSON: "👤",
  ORG: "🏢",
  GPE: "📍",
  CONCEPT: "💡",
  TECHNOLOGY: "🔬",
  AWARD: "🏆",
  WORK: "📖",
  DATE: "📅",
  EVENT: "⚡",
  OTHER: "•",
};

let simulation = null;
let svg = null;
let g = null;
let zoom = null;
let showLabels = true;
let currentData = { nodes: [], edges: [] };

function initGraph() {
  const container = document.getElementById("graph-canvas");
  const width = container.clientWidth || 900;
  const height = container.clientHeight || 600;

  svg = d3.select("#main-graph")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Arrow marker for directed edges
  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "-0 -5 10 10")
    .attr("refX", 20)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", "#888");

  g = svg.append("g").attr("class", "graph-group");

  zoom = d3.zoom()
    .scaleExtent([0.1, 8])
    .on("zoom", (event) => g.attr("transform", event.transform));

  svg.call(zoom);
}

function renderGraph(data) {
  if (!svg) initGraph();
  if (!data || !data.nodes || data.nodes.length === 0) {
    document.getElementById("empty-state").style.display = "flex";
    return;
  }
  document.getElementById("empty-state").style.display = "none";

  currentData = data;
  const nodes = data.nodes.map(n => ({ ...n }));
  const edges = data.edges.map(e => ({ ...e }));

  const container = document.getElementById("graph-canvas");
  const width = container.clientWidth || 900;
  const height = container.clientHeight || 600;

  // Update stats
  const stats = data.stats || {};
  document.getElementById("graph-stats").textContent =
    `${nodes.length} nodes · ${edges.length} edges`;

  // Clear previous
  g.selectAll("*").remove();

  // Create simulation
  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id).distance(120))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide(40));

  // Draw edges
  const link = g.append("g").attr("class", "links")
    .selectAll("g")
    .data(edges)
    .join("g");

  link.append("line")
    .attr("class", "link-line")
    .attr("stroke", "#555")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", d => 1 + (d.weight || 1))
    .attr("marker-end", "url(#arrowhead)");

  link.append("text")
    .attr("class", "link-label")
    .attr("text-anchor", "middle")
    .attr("fill", "#aaa")
    .attr("font-size", "9px")
    .text(d => d.relationship || "");

  // Draw nodes
  const node = g.append("g").attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node")
    .call(d3.drag()
      .on("start", dragStarted)
      .on("drag", dragged)
      .on("end", dragEnded))
    .on("click", (event, d) => selectNode(d))
    .on("mouseover", (event, d) => showTooltip(event, d))
    .on("mouseout", () => hideTooltip());

  node.append("circle")
    .attr("r", 18)
    .attr("fill", d => ENTITY_COLORS[d.type] || "#888")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  node.append("text")
    .attr("class", "node-icon")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("font-size", "12px")
    .text(d => ENTITY_ICONS[d.type] || "•");

  node.append("text")
    .attr("class", "node-label")
    .attr("text-anchor", "middle")
    .attr("dy", 30)
    .attr("fill", "#ddd")
    .attr("font-size", "11px")
    .text(d => (d.name || "").substring(0, 20));

  // Simulation tick
  simulation.on("tick", () => {
    link.select("line")
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    link.select("text")
      .attr("x", d => (d.source.x + d.target.x) / 2)
      .attr("y", d => (d.source.y + d.target.y) / 2);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
}

function selectNode(d) {
  // Highlight selected node
  g.selectAll(".node circle").attr("stroke", "#fff").attr("stroke-width", 2);
  g.selectAll(".node").filter(n => n.id === d.id)
    .select("circle").attr("stroke", "#fff").attr("stroke-width", 4);

  // Show details in right panel
  const details = document.getElementById("entity-details");
  const icon = ENTITY_ICONS[d.type] || "•";
  const color = ENTITY_COLORS[d.type] || "#888";
  details.innerHTML = `
    <div class="entity-card">
      <div class="entity-header" style="border-left: 4px solid ${color}">
        <span class="entity-icon">${icon}</span>
        <div>
          <h3>${d.name || "Unknown"}</h3>
          <span class="entity-type-badge" style="background:${color}">${d.type || "OTHER"}</span>
        </div>
      </div>
      ${d.description ? `<p class="entity-desc">${d.description}</p>` : ""}
      <div class="entity-meta">
        <span><strong>ID:</strong> ${d.id || ""}</span>
      </div>
    </div>
  `;`
  // Highlight connected edges
  g.selectAll(".link-line")
    .attr("stroke-opacity", e =>
      (e.source.id === d.id || e.target.id === d.id) ? 0.9 : 0.15
    )
    .attr("stroke", e =>
      (e.source.id === d.id || e.target.id === d.id) ? "#fff" : "#555"
    );
}

function showTooltip(event, d) {
  const tooltip = document.getElementById("node-tooltip");
  tooltip.style.display = "block";
  tooltip.style.left = (event.pageX + 10) + "px";
  tooltip.style.top = (event.pageY - 30) + "px";
  tooltip.innerHTML = `<strong>${ENTITY_ICONS[d.type] || ""} ${d.name}</strong><br/>${d.type}`;
}

function hideTooltip() {
  document.getElementById("node-tooltip").style.display = "none";
}

function resetZoom() {
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
}

function toggleLabels() {
  showLabels = !showLabels;
  g.selectAll(".node-label").style("display", showLabels ? "block" : "none");
}

function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x; d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x; d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null; d.fy = null;
}
