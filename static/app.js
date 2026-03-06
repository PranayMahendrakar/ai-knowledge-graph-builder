/**
 * app.js — Frontend application logic
 * Handles file upload, API calls, entity listing, and UI state.
 */

const API_BASE = "";  // Same-origin API

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initGraph();
  setupFileUpload();
  loadGraph();
  checkHealth();
});

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

async function checkHealth() {
  try {
    const resp = await fetch(`${API_BASE}/health`);
    const data = await resp.json();
    if (data.neo4j === "disconnected") {
      showNotification("⚠️ Neo4j not connected. Running in demo mode.", "warning");
    }
  } catch (e) {
    showNotification("🔌 Backend not running. Showing demo data.", "info");
    loadDemo();
  }
}

// ─────────────────────────────────────────────
// File Upload
// ─────────────────────────────────────────────

function setupFileUpload() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));
}

async function handleFiles(files) {
  for (const file of files) {
    await uploadFile(file);
  }
}

async function uploadFile(file) {
  showLoading(`Processing: ${file.name}...`);
  const status = document.getElementById("upload-status");
  status.innerHTML = `<div class="status-item pending">⏳ Uploading ${file.name}...</div>`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const resp = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();

    if (resp.ok) {
      status.innerHTML = `<div class="status-item processing">🔄 Building graph for ${file.name}...</div>`;
      // Poll for completion
      pollDocStatus(data.doc_id, file.name);
    } else {
      status.innerHTML = `<div class="status-item error">❌ Error: ${data.detail || "Upload failed"}</div>`;
      hideLoading();
    }
  } catch (e) {
    status.innerHTML = `<div class="status-item error">❌ ${e.message}</div>`;
    hideLoading();
  }
}

async function pollDocStatus(docId, filename) {
  let attempts = 0;
  const maxAttempts = 30;

  const poll = async () => {
    try {
      const resp = await fetch(`${API_BASE}/status/${docId}`);
      if (resp.ok) {
        const status = await resp.json();
        if (status.status === "completed") {
          document.getElementById("upload-status").innerHTML =
            `<div class="status-item success">✅ ${filename}: ${status.entity_count} entities extracted</div>`;
          hideLoading();
          loadGraph();
          loadEntities();
          return;
        }
      }
    } catch (e) {}

    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(poll, 2000);
    } else {
      hideLoading();
      loadGraph();
    }
  };

  setTimeout(poll, 2000);
}

// ─────────────────────────────────────────────
// Graph Loading
// ─────────────────────────────────────────────

async function loadGraph() {
  try {
    const resp = await fetch(`${API_BASE}/graph`);
    const data = await resp.json();
    renderGraph(data);
    loadEntities();
  } catch (e) {
    console.log("Graph not available:", e.message);
  }
}

// ─────────────────────────────────────────────
// Entities List
// ─────────────────────────────────────────────

let allEntities = [];

async function loadEntities() {
  try {
    const resp = await fetch(`${API_BASE}/entities?limit=200`);
    const data = await resp.json();
    allEntities = data.entities || [];
    renderEntitiesList(allEntities);
  } catch (e) {}
}

function renderEntitiesList(entities) {
  const container = document.getElementById("entities-list");
  if (!entities || entities.length === 0) {
    container.innerHTML = `<p class="no-entities">No entities yet. Upload a document.</p>`;
    return;
  }
  container.innerHTML = entities.map(e => `
    <div class="entity-item" onclick="highlightEntityInGraph('${(e.id || "").replace(/'/g, "")}')" style="border-left:3px solid ${ENTITY_COLORS[e.type] || "#888"}">
      <span class="entity-icon-sm">${ENTITY_ICONS[e.type] || "•"}</span>
      <div class="entity-item-info">
        <span class="entity-name">${e.name || "?"}</span>
        <span class="entity-type-sm">${e.type || "OTHER"}</span>
      </div>
    </div>
  `).join("");
}

function filterEntities() {
  const filterType = document.getElementById("entity-type-filter").value;
  const filtered = filterType ? allEntities.filter(e => e.type === filterType) : allEntities;
  renderEntitiesList(filtered);
}

function highlightEntityInGraph(entityId) {
  if (!g) return;
  const nodeEl = g.selectAll(".node").filter(d => d.id === entityId);
  if (!nodeEl.empty()) {
    const nodeData = nodeEl.datum();
    selectNode(nodeData);
  }
}

// ─────────────────────────────────────────────
// Graph Query
// ─────────────────────────────────────────────

async function queryGraph() {
  const queryText = document.getElementById("query-input").value.trim();
  if (!queryText) return;

  const results = document.getElementById("query-results");
  results.innerHTML = `<div class="loading-text">🔍 Searching...</div>`;

  try {
    const resp = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: queryText, limit: 20 }),
    });
    const data = await resp.json();
    if (data.results && data.results.length > 0) {
      results.innerHTML = `
        <div class="query-result-header">Found ${data.results.length} results</div>
        ${data.results.map(r => `<div class="query-result-item">${JSON.stringify(r).substring(0, 100)}</div>`).join("")}
      `;
    } else {
      results.innerHTML = `<div class="no-results">No results found</div>`;
    }
  } catch (e) {
    results.innerHTML = `<div class="error-text">Query failed: ${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

async function loadAnalytics() {
  const panel = document.getElementById("analytics-panel");
  const content = document.getElementById("analytics-content");
  panel.style.display = "block";
  content.innerHTML = `<div class="loading-text">📊 Computing analytics...</div>`;

  try {
    const resp = await fetch(`${API_BASE}/analytics`);
    const data = await resp.json();
    content.innerHTML = `
      <div class="analytics-item"><strong>Nodes:</strong> ${data.node_count || 0}</div>
      <div class="analytics-item"><strong>Edges:</strong> ${data.edge_count || 0}</div>
      <div class="analytics-item"><strong>Density:</strong> ${(data.density || 0).toFixed(4)}</div>
      <div class="analytics-item"><strong>Communities:</strong> ${data.community_count || 0}</div>
      ${data.top_entities_by_pagerank ? `
        <div class="analytics-section">
          <strong>Top Entities (PageRank):</strong>
          ${data.top_entities_by_pagerank.slice(0, 5).map(e => `
            <div class="analytics-rank-item">${e.id}: ${e.score}</div>
          `).join("")}
        </div>
      ` : ""}
    `;
  } catch (e) {
    content.innerHTML = `<div class="error-text">Analytics unavailable</div>`;
  }
}

// ─────────────────────────────────────────────
// Clear / Export
// ─────────────────────────────────────────────

async function clearGraph() {
  if (!confirm("Clear the entire knowledge graph? This cannot be undone.")) return;
  try {
    await fetch(`${API_BASE}/graph`, { method: "DELETE" });
    showNotification("Graph cleared.", "success");
    loadGraph();
    loadEntities();
  } catch (e) {
    showNotification("Failed to clear graph.", "error");
  }
}

async function exportGraph() {
  try {
    const resp = await fetch(`${API_BASE}/export/json`);
    const data = await resp.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "knowledge-graph.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    // Export current rendered data
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "knowledge-graph.json";
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ─────────────────────────────────────────────
// Demo Data
// ─────────────────────────────────────────────

function loadDemo() {
  const demoData = {
    nodes: [
      { id: "n1", name: "Albert Einstein", type: "PERSON", description: "German-born physicist" },
      { id: "n2", name: "Theory of Relativity", type: "CONCEPT", description: "Physics theory" },
      { id: "n3", name: "Physics", type: "CONCEPT", description: "Natural science" },
      { id: "n4", name: "Nobel Prize", type: "AWARD", description: "Prestigious award" },
      { id: "n5", name: "Niels Bohr", type: "PERSON", description: "Danish physicist" },
      { id: "n6", name: "Quantum Mechanics", type: "CONCEPT", description: "Branch of physics" },
      { id: "n7", name: "Princeton University", type: "ORG", description: "US university" },
      { id: "n8", name: "Max Planck", type: "PERSON", description: "German physicist" },
      { id: "n9", name: "Photoelectric Effect", type: "CONCEPT", description: "Quantum phenomenon" },
      { id: "n10", name: "Special Relativity", type: "WORK", description: "1905 paper by Einstein" },
    ],
    edges: [
      { source: "n1", target: "n2", relationship: "DEVELOPED", description: "Einstein developed relativity" },
      { source: "n2", target: "n3", relationship: "BELONGS_TO", description: "Relativity is part of physics" },
      { source: "n1", target: "n4", relationship: "WON", description: "Einstein won Nobel Prize 1921" },
      { source: "n1", target: "n5", relationship: "DEBATED", description: "Famous Bohr-Einstein debates" },
      { source: "n5", target: "n6", relationship: "PIONEERED", description: "Bohr pioneered quantum mechanics" },
      { source: "n6", target: "n3", relationship: "BRANCH_OF", description: "QM is a branch of physics" },
      { source: "n1", target: "n7", relationship: "WORKED_AT", description: "Einstein worked at Princeton" },
      { source: "n8", target: "n4", relationship: "WON", description: "Planck won Nobel Prize 1918" },
      { source: "n1", target: "n9", relationship: "EXPLAINED", description: "Einstein explained photoelectric effect" },
      { source: "n1", target: "n10", relationship: "AUTHORED", description: "Einstein authored special relativity paper" },
    ],
    stats: { node_count: 10, edge_count: 10 }
  };
  renderGraph(demoData);
  showNotification("🎮 Demo knowledge graph loaded!", "success");
}

// ─────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────

function showLoading(message = "Processing...") {
  document.getElementById("loading-overlay").style.display = "flex";
  document.getElementById("loading-message").textContent = message;
}

function hideLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}

let notifTimeout = null;
function showNotification(message, type = "info") {
  let notif = document.getElementById("notification");
  if (!notif) {
    notif = document.createElement("div");
    notif.id = "notification";
    document.body.appendChild(notif);
  }
  notif.className = `notification notification-${type}`;
  notif.textContent = message;
  notif.style.display = "block";
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => notif.style.display = "none", 4000);
}
