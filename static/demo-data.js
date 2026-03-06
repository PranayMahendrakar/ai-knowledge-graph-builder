// demo-data.js - Demo data and event setup for the AI Knowledge Graph Builder
// Uses functions and variables defined in graph.js (loaded before this file)

var DEMO_DATA = {
  nodes: [
    { id: "einstein", label: "Albert Einstein", type: "PERSON", description: "Theoretical physicist who developed the theory of relativity.", connections: 4 },
    { id: "relativity", label: "Theory of Relativity", type: "CONCEPT", description: "A theory of spacetime and gravity developed by Einstein.", connections: 3 },
    { id: "physics", label: "Physics", type: "FIELD", description: "The natural science that studies matter, energy, and their interactions.", connections: 4 },
    { id: "nobel_prize", label: "Nobel Prize", type: "AWARD", description: "International awards recognizing outstanding contributions to science and culture.", connections: 3 },
    { id: "quantum", label: "Quantum Mechanics", type: "CONCEPT", description: "A fundamental theory describing physical properties at the scale of atoms.", connections: 3 },
    { id: "spacetime", label: "Spacetime", type: "CONCEPT", description: "A mathematical model combining three dimensions of space and one of time.", connections: 2 },
    { id: "princeton", label: "Princeton IAS", type: "ORGANIZATION", description: "Institute for Advanced Study in Princeton, New Jersey.", connections: 2 },
    { id: "photoelectric", label: "Photoelectric Effect", type: "CONCEPT", description: "Emission of electrons when electromagnetic radiation hits a material.", connections: 2 },
    { id: "emc2", label: "E=mc2", type: "CONCEPT", description: "Mass-energy equivalence formula: energy equals mass times the speed of light squared.", connections: 2 },
    { id: "germany", label: "Germany", type: "LOCATION", description: "Country where Einstein was born (Ulm, 1879).", connections: 2 },
    { id: "switzerland", label: "Switzerland", type: "LOCATION", description: "Country where Einstein studied and worked at the patent office.", connections: 2 },
    { id: "usa", label: "United States", type: "LOCATION", description: "Country where Einstein emigrated in 1933 to escape Nazi persecution.", connections: 2 }
  ],
  edges: [
    { source: "einstein", target: "relativity", label: "developed", weight: 1.0 },
    { source: "einstein", target: "physics", label: "contributed_to", weight: 0.9 },
    { source: "einstein", target: "nobel_prize", label: "received", weight: 0.8 },
    { source: "einstein", target: "quantum", label: "contributed_to", weight: 0.8 },
    { source: "relativity", target: "physics", label: "part_of", weight: 0.9 },
    { source: "relativity", target: "spacetime", label: "describes", weight: 0.95 },
    { source: "relativity", target: "emc2", label: "includes", weight: 0.95 },
    { source: "quantum", target: "physics", label: "part_of", weight: 0.9 },
    { source: "einstein", target: "photoelectric", label: "discovered", weight: 0.9 },
    { source: "photoelectric", target: "nobel_prize", label: "led_to", weight: 0.85 },
    { source: "einstein", target: "princeton", label: "worked_at", weight: 0.7 },
    { source: "einstein", target: "germany", label: "born_in", weight: 0.6 },
    { source: "einstein", target: "switzerland", label: "studied_in", weight: 0.6 },
    { source: "einstein", target: "usa", label: "emigrated_to", weight: 0.6 }
  ],
  stats: {
    nodeCount: 12,
    edgeCount: 14,
    entityTypes: { PERSON: 1, CONCEPT: 4, FIELD: 1, AWARD: 1, ORGANIZATION: 1, LOCATION: 3 }
  }
};

function highlightNode(nodeId) {
  var svg = document.querySelector("#main-graph");
  if (!svg) return;
  var nodes = svg.querySelectorAll(".node");
  nodes.forEach(function(n) {
    if (n.getAttribute("data-id") === nodeId) {
      n.classList.add("highlighted");
    } else {
      n.classList.remove("highlighted");
    }
  });
}

function renderEntityList(data) {
  var listDiv = document.getElementById("entities-list");
  if (!listDiv) return;
  var html = "";
  data.nodes.forEach(function(node) {
    var color = (typeof ENTITY_COLORS !== "undefined" && ENTITY_COLORS[node.type]) ? ENTITY_COLORS[node.type] : "#6366f1";
    var emoji = (typeof ENTITY_EMOJI !== "undefined" && ENTITY_EMOJI[node.type]) ? ENTITY_EMOJI[node.type] : "?";
    html += "<div class=\"entity-item\" onclick=\"highlightNode('" + node.id + "')\" style=\"border-left:3px solid " + color + "\">";
    html += "<span class=\"entity-icon\">" + emoji + "</span>";
    html += "<div><div class=\"entity-label\">" + node.label + "</div>";
    html += "<div class=\"entity-type\">" + node.type + "</div></div>";
    html += "</div>";
  });
  listDiv.innerHTML = html;
}

function updateStats(data) {
  var statsEl = document.getElementById("graph-stats");
  if (statsEl) {
    statsEl.textContent = data.stats.nodeCount + " nodes | " + data.stats.edgeCount + " edges";
  }
  var nodeCountEl = document.getElementById("node-count");
  if (nodeCountEl) nodeCountEl.textContent = data.stats.nodeCount;
  var edgeCountEl = document.getElementById("edge-count");
  if (edgeCountEl) edgeCountEl.textContent = data.stats.edgeCount;
}

function loadDemo() {
  var emptyState = document.getElementById("empty-state");
  if (emptyState) emptyState.style.display = "none";
  if (typeof renderGraph === "function") {
    renderGraph(DEMO_DATA);
  } else {
    console.error("renderGraph is not defined - check that graph.js loaded correctly");
  }
  renderEntityList(DEMO_DATA);
  updateStats(DEMO_DATA);
}

document.addEventListener("DOMContentLoaded", function() {
  if (typeof initGraph === "function") {
    initGraph();
  }
  var btnLoad = document.getElementById("btn-load");
  if (btnLoad) {
    btnLoad.addEventListener("click", loadDemo);
  }
  var btnLoad2 = document.getElementById("btn-load2");
  if (btnLoad2) {
    btnLoad2.addEventListener("click", loadDemo);
  }
  var btnZoomReset = document.getElementById("btn-zoom-reset");
  if (btnZoomReset) {
    btnZoomReset.addEventListener("click", function() {
      if (typeof resetZoom === "function") resetZoom();
    });
  }
  var btnLabels = document.getElementById("btn-labels");
  if (btnLabels) {
    btnLabels.addEventListener("click", function() {
      if (typeof toggleLabels === "function") toggleLabels();
    });
  }
});
