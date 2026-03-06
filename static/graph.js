/**
 * graph.js - D3.js Knowledge Graph Visualization
 * Uses var declarations for compatibility (no const/let)
 */

var ENTITY_COLORS = {
  PERSON: "#4f86f7",
  ORG: "#f79f4f",
  ORGANIZATION: "#f79f4f",
  GPE: "#4fb375",
  LOCATION: "#4fb375",
  CONCEPT: "#b44ff7",
  FIELD: "#7c3aed",
  TECHNOLOGY: "#f74f4f",
  AWARD: "#f7d44f",
  WORK: "#4fd4f7",
  DATE: "#a0a0a0",
  EVENT: "#f76490",
  OTHER: "#888888"
};

var ENTITY_ICONS = {
  PERSON: "Person",
  ORG: "Org",
  ORGANIZATION: "Org",
  GPE: "Place",
  LOCATION: "Place",
  CONCEPT: "Concept",
  FIELD: "Field",
  TECHNOLOGY: "Tech",
  AWARD: "Award",
  WORK: "Work",
  DATE: "Date",
  EVENT: "Event",
  OTHER: "?"
};

var ENTITY_EMOJI = {
  PERSON: "person",
  ORG: "org",
  ORGANIZATION: "org",
  GPE: "place",
  LOCATION: "place",
  CONCEPT: "idea",
  FIELD: "field",
  TECHNOLOGY: "tech",
  AWARD: "award",
  WORK: "work",
  DATE: "date",
  EVENT: "event",
  OTHER: "?"
};

var graphSvg = null;
var graphSimulation = null;
var graphWidth = 0;
var graphHeight = 0;
var graphZoom = null;
var graphContainer = null;
var showLabels = true;
var currentData = null;

function initGraph() {
  var svgEl = document.getElementById("main-graph");
  if (!svgEl) { console.error("main-graph SVG not found"); return; }
  var parentEl = svgEl.parentElement;
  graphWidth = parentEl.clientWidth || 800;
  graphHeight = parentEl.clientHeight || 600;
  graphSvg = d3.select("#main-graph")
    .attr("width", graphWidth)
    .attr("height", graphHeight);
  graphZoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", function(event) {
      if (graphContainer) {
        graphContainer.attr("transform", event.transform);
      }
    });
  graphSvg.call(graphZoom);
  graphContainer = graphSvg.append("g").attr("class", "graph-root");
  graphSvg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#666");
  console.log("Graph initialized: " + graphWidth + "x" + graphHeight);
}

function renderGraph(data) {
  if (!graphSvg || !graphContainer) {
    console.error("Graph not initialized. Call initGraph() first.");
    return;
  }
  currentData = data;
  graphContainer.selectAll("*").remove();
  if (graphSimulation) { graphSimulation.stop(); }
  var nodes = data.nodes.map(function(d) {
    return { id: d.id, label: d.label, type: d.type, description: d.description, connections: d.connections || 1 };
  });
  var edges = data.edges.map(function(d) {
    return { source: d.source, target: d.target, label: d.label, weight: d.weight || 0.5 };
  });
  graphSimulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(function(d) { return d.id; }).distance(120))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(graphWidth / 2, graphHeight / 2))
    .force("collision", d3.forceCollide().radius(40));
  var link = graphContainer.append("g").attr("class", "links")
    .selectAll("line").data(edges).enter().append("line")
    .attr("class", "link")
    .attr("stroke", "#444")
    .attr("stroke-width", function(d) { return Math.max(1, d.weight * 3); })
    .attr("marker-end", "url(#arrowhead)");
  var linkLabel = graphContainer.append("g").attr("class", "link-labels")
    .selectAll("text").data(edges).enter().append("text")
    .attr("class", "link-label")
    .attr("font-size", "10px")
    .attr("fill", "#888")
    .attr("text-anchor", "middle")
    .text(function(d) { return d.label; });
  var nodeGroup = graphContainer.append("g").attr("class", "nodes")
    .selectAll("g").data(nodes).enter().append("g")
    .attr("class", "node")
    .attr("data-id", function(d) { return d.id; })
    .call(d3.drag()
      .on("start", function(event, d) {
        if (!event.active) graphSimulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", function(event, d) {
        d.fx = event.x; d.fy = event.y;
      })
      .on("end", function(event, d) {
        if (!event.active) graphSimulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    )
    .on("click", function(event, d) {
      showNodeDetails(d);
    })
    .on("mouseover", function(event, d) {
      showTooltip(event, d);
    })
    .on("mouseout", function() {
      hideTooltip();
    });
  nodeGroup.append("circle")
    .attr("r", function(d) { return 10 + (d.connections || 1) * 3; })
    .attr("fill", function(d) { return ENTITY_COLORS[d.type] || "#888"; })
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);
  nodeGroup.append("text")
    .attr("class", "node-label")
    .attr("dy", function(d) { return 16 + (d.connections || 1) * 3; })
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#ddd")
    .text(function(d) { return d.label; });
  graphSimulation.on("tick", function() {
    link
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });
    linkLabel
      .attr("x", function(d) { return (d.source.x + d.target.x) / 2; })
      .attr("y", function(d) { return (d.source.y + d.target.y) / 2; });
    nodeGroup.attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")";
    });
  });
  updateLabelVisibility();
  console.log("Graph rendered: " + nodes.length + " nodes, " + edges.length + " edges");
}

function showNodeDetails(d) {
  var detailsEl = document.getElementById("entity-details");
  if (!detailsEl) return;
  var color = ENTITY_COLORS[d.type] || "#888";
  var html = "<div style=\"border-left:4px solid " + color + ";padding-left:10px;\">";
  html += "<div style=\"font-weight:bold;font-size:1rem;\">" + d.label + "</div>";
  html += "<div style=\"color:#888;font-size:0.8rem;margin:4px 0;\">" + d.type + "</div>";
  if (d.description) {
    html += "<div style=\"font-size:0.85rem;margin-top:8px;\">" + d.description + "</div>";
  }
  html += "</div>";
  detailsEl.innerHTML = html;
}

function showTooltip(event, d) {
  var tooltip = document.getElementById("node-tooltip");
  if (!tooltip) return;
  tooltip.style.display = "block";
  tooltip.style.left = (event.pageX + 10) + "px";
  tooltip.style.top = (event.pageY - 30) + "px";
  tooltip.innerHTML = "<strong>" + d.label + "</strong><br><span style=\"color:#aaa;\">" + d.type + "</span>";
}

function hideTooltip() {
  var tooltip = document.getElementById("node-tooltip");
  if (tooltip) tooltip.style.display = "none";
}

function resetZoom() {
  if (graphSvg && graphZoom) {
    graphSvg.transition().duration(500).call(graphZoom.transform, d3.zoomIdentity);
  }
}

function toggleLabels() {
  showLabels = !showLabels;
  updateLabelVisibility();
}

function updateLabelVisibility() {
  if (graphContainer) {
    graphContainer.selectAll(".node-label").style("display", showLabels ? "block" : "none");
    graphContainer.selectAll(".link-label").style("display", showLabels ? "block" : "none");
  }
}
