(function initTrackerDashboard(global) {
  const ns = (global.WWP = global.WWP || {});

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  ns.renderTrackerDashboard = async function renderTrackerDashboard(mount, statusEl) {
    if (!mount) return;
    if (!ns.applicationStore || typeof ns.applicationStore.listApplications !== "function") {
      mount.textContent = "Application store unavailable.";
      return;
    }
    const rows = await ns.applicationStore.listApplications();
    mount.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = rows.length ? `${rows.length} saved` : "";
    }
    if (!rows.length) {
      mount.innerHTML = "<p class=\"section-note\">No applications saved yet.</p>";
      return;
    }

    const table = document.createElement("table");
    table.className = "tracker-table";
    table.innerHTML = `<thead><tr><th>Status</th><th>Title</th><th>Updated</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    rows.slice(0, 80).forEach((r) => {
      const tr = document.createElement("tr");
      const when = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—";
      tr.innerHTML = `<td>${esc(r.status)}</td><td>${esc(r.title)}</td><td>${esc(when)}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    mount.appendChild(table);
  };
})(globalThis);
