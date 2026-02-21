(function initUi(global) {
  const ns = (global.WWP = global.WWP || {});

  function ensurePanelStyles(shadowRoot) {
    if (shadowRoot.getElementById("wwp-style")) return;
    const style = document.createElement("style");
    style.id = "wwp-style";
    style.textContent = `
      :host, * { box-sizing: border-box; }
      .wwp-panel {
        width: 340px;
        max-height: 86vh;
        overflow: auto;
        background: #0f172a;
        color: #e2e8f0;
        border: 1px solid #1e293b;
        border-radius: 14px;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        box-shadow: 0 10px 30px rgba(2, 6, 23, 0.35);
      }
      .wwp-header {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #0f172a, #1d4ed8);
        border-bottom: 1px solid #1e293b;
      }
      .wwp-title { margin: 0; font-size: 14px; font-weight: 700; }
      .wwp-subtitle { margin: 0; font-size: 11px; opacity: 0.85; }
      .wwp-body { padding: 12px; display: grid; gap: 10px; }
      .wwp-card { border: 1px solid #1f2937; border-radius: 10px; padding: 10px; background: #111827; }
      .wwp-section-title { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #93c5fd; }
      .wwp-chip-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
      .wwp-chip { padding: 3px 8px; border-radius: 999px; font-size: 11px; border: 1px solid #334155; background: #1f2937; }
      .wwp-chip.warn { border-color: #f59e0b; color: #fcd34d; }
      .wwp-chip.danger { border-color: #ef4444; color: #fca5a5; }
      .wwp-chip.good { border-color: #22c55e; color: #86efac; }
      .wwp-list { margin: 0; padding-left: 16px; display: grid; gap: 6px; }
      .wwp-metric { display: grid; grid-template-columns: 1fr auto; gap: 8px; font-size: 12px; }
      .wwp-progress {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: #1f2937;
        overflow: hidden;
        margin-top: 4px;
      }
      .wwp-progress > span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #22d3ee, #22c55e);
      }
      .wwp-button {
        appearance: none;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 11px;
        color: #e2e8f0;
        background: #0b1220;
        cursor: pointer;
      }
      .wwp-button:hover { border-color: #60a5fa; }
      .wwp-input {
        width: 100%;
        appearance: none;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #0b1220;
        color: #e2e8f0;
        padding: 8px 9px;
        font: inherit;
      }
      .wwp-input:focus {
        outline: none;
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
      }
      .wwp-input::placeholder { color: #94a3b8; }
      .wwp-input-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
      }
      .wwp-inline-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .wwp-check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #cbd5e1;
      }
      .wwp-search-results {
        margin-top: 6px;
        max-height: 52vh;
        overflow: auto;
        display: grid;
        gap: 6px;
      }
      .wwp-search-item {
        appearance: none;
        width: 100%;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 8px;
        background: #0b1220;
        color: #dbeafe;
        text-align: left;
        font: inherit;
        cursor: pointer;
      }
      .wwp-search-item:hover { border-color: #60a5fa; }
      .wwp-search-item .meta {
        margin-top: 4px;
        font-size: 11px;
        color: #93c5fd;
      }
      .wwp-kv { margin: 0; display: grid; gap: 4px; }
      .wwp-kv div { display: grid; grid-template-columns: 1fr auto; gap: 8px; font-size: 12px; }
      .wwp-mini-badge {
        display: inline-flex;
        align-items: center;
        margin: 0 6px 4px 0;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        border: 1px solid #94a3b8;
        background: #eff6ff;
        color: #0f172a;
        font-weight: 600;
      }
      .wwp-mini-badge.good { border-color: #22c55e; background: #dcfce7; }
      .wwp-mini-badge.warn { border-color: #f59e0b; background: #fef3c7; }
      .wwp-mini-badge.bad { border-color: #ef4444; background: #fee2e2; }
      .wwp-inline-note { margin: 4px 0 0; font-size: 11px; color: #94a3b8; }
      .wwp-tabs { position: sticky; top: 0; z-index: 1; display: flex; gap: 6px; padding: 6px; background: #0b1220; border: 1px solid #1f2937; border-radius: 10px; }
      .wwp-tab-btn {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        appearance: none;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #0f172a;
        color: #cbd5e1;
        padding: 6px;
        font-size: 11px;
        cursor: pointer;
      }
      .wwp-tab-btn.active { border-color: #60a5fa; color: #dbeafe; background: #1e293b; }
      .wwp-tab-pane { display: none; gap: 10px; }
      .wwp-tab-pane.active { display: grid; }
    `;
    shadowRoot.appendChild(style);
  }

  ns.createShadowPanel = function createShadowPanel(opts) {
    const options = opts || {};
    const hostId = options.id || "wwp-panel-host";
    const launcherId = `${hostId}-launcher`;

    const existing = document.getElementById(hostId);
    if (existing) existing.remove();
    const existingLauncher = document.getElementById(launcherId);
    if (existingLauncher) existingLauncher.remove();

    const host = document.createElement("div");
    host.id = hostId;
    host.style.position = "fixed";
    host.style.top = options.top || "74px";
    host.style.right = options.right || "12px";
    host.style.zIndex = "2147483646";

    const shadow = host.attachShadow({ mode: "open" });
    ensurePanelStyles(shadow);

    const panel = document.createElement("aside");
    panel.className = "wwp-panel";
    panel.style.width = options.width ? `${options.width}px` : "340px";

    const header = document.createElement("header");
    header.className = "wwp-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "wwp-title";
    title.textContent = options.title || "WaterlooWorks+";
    const subtitle = document.createElement("p");
    subtitle.className = "wwp-subtitle";
    subtitle.textContent = options.subtitle || "Client-side insights";
    titleWrap.append(title, subtitle);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";

    const launcher = document.createElement("button");
    launcher.id = launcherId;
    launcher.type = "button";
    launcher.textContent = options.launcherText || "WW+";
    launcher.title = "Open WaterlooWorks+";
    launcher.style.position = "fixed";
    launcher.style.right = options.launcherRight || "14px";
    launcher.style.bottom = options.launcherBottom || "18px";
    launcher.style.zIndex = "2147483645";
    launcher.style.width = "42px";
    launcher.style.height = "42px";
    launcher.style.borderRadius = "999px";
    launcher.style.border = "1px solid #1e3a8a";
    launcher.style.background = "linear-gradient(135deg, #1d4ed8, #1e40af)";
    launcher.style.color = "#eff6ff";
    launcher.style.font = "700 11px/1 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    launcher.style.cursor = "pointer";
    launcher.style.boxShadow = "0 10px 24px rgba(2, 6, 23, 0.35)";
    launcher.style.display = "none";

    function showPanel() {
      host.style.display = "block";
      launcher.style.display = "none";
    }

    function hidePanel() {
      host.style.display = "none";
      launcher.style.display = "block";
      if (typeof options.onClose === "function") {
        options.onClose();
      }
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "wwp-button";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", hidePanel);
    actions.appendChild(closeBtn);

    if (typeof options.onDisablePage === "function") {
      const disableBtn = document.createElement("button");
      disableBtn.className = "wwp-button";
      disableBtn.textContent = "Disable on this page";
      disableBtn.addEventListener("click", () => options.onDisablePage());
      actions.prepend(disableBtn);
    }

    header.append(titleWrap, actions);

    const body = document.createElement("div");
    body.className = "wwp-body";

    panel.append(header, body);
    shadow.appendChild(panel);
    document.documentElement.appendChild(host);
    launcher.addEventListener("click", showPanel);
    document.documentElement.appendChild(launcher);

    return {
      host,
      launcher,
      shadow,
      panel,
      body,
      setSubtitle(text) {
        subtitle.textContent = text;
      },
      open() {
        showPanel();
      },
      close() {
        hidePanel();
      }
    };
  };

  ns.createTabs = function createTabs(tabDefs, initialId) {
    const defs = Array.isArray(tabDefs) ? tabDefs : [];
    const wrap = document.createElement("section");
    const nav = document.createElement("nav");
    nav.className = "wwp-tabs";
    const panesWrap = document.createElement("div");

    const state = {
      activeId: initialId || (defs[0] ? defs[0].id : null),
      buttons: new Map(),
      panes: new Map()
    };

    function setActive(id) {
      state.activeId = id;
      state.buttons.forEach((btn, key) => {
        btn.classList.toggle("active", key === id);
      });
      state.panes.forEach((pane, key) => {
        pane.classList.toggle("active", key === id);
      });
    }

    defs.forEach((def, index) => {
      const id = def.id;
      const label = def.label || def.id;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wwp-tab-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => setActive(id));
      nav.appendChild(btn);

      const pane = document.createElement("section");
      pane.className = "wwp-tab-pane";
      pane.dataset.tabId = id;
      panesWrap.appendChild(pane);

      state.buttons.set(id, btn);
      state.panes.set(id, pane);

      if (index === 0 && !state.activeId) {
        state.activeId = id;
      }
    });

    wrap.append(nav, panesWrap);
    if (state.activeId) {
      setActive(state.activeId);
    }

    return {
      root: wrap,
      nav,
      panesWrap,
      getPane(id) {
        return state.panes.get(id) || null;
      },
      activate(id) {
        if (!state.panes.has(id)) return;
        setActive(id);
      },
      appendToTab(id, node) {
        const pane = state.panes.get(id);
        if (pane && node) pane.appendChild(node);
      },
      clearTab(id) {
        const pane = state.panes.get(id);
        if (pane) pane.innerHTML = "";
      }
    };
  };

  ns.makeCard = function makeCard(titleText) {
    const card = document.createElement("section");
    card.className = "wwp-card";
    if (titleText) {
      const title = document.createElement("h3");
      title.className = "wwp-section-title";
      title.textContent = titleText;
      card.appendChild(title);
    }
    return card;
  };

  ns.makeChip = function makeChip(label, tone) {
    const chip = document.createElement("span");
    chip.className = `wwp-chip ${tone || ""}`.trim();
    chip.textContent = label;
    return chip;
  };

  ns.makeProgressMetric = function makeProgressMetric(label, value) {
    const wrap = document.createElement("div");
    wrap.className = "wwp-metric";

    const left = document.createElement("div");
    left.textContent = label;
    const right = document.createElement("strong");
    right.textContent = `${Math.round(value)}%`;

    const line = document.createElement("div");
    line.className = "wwp-progress";
    line.style.gridColumn = "1 / -1";
    const fill = document.createElement("span");
    fill.style.width = `${ns.clamp(Math.round(value), 0, 100)}%`;
    line.appendChild(fill);

    wrap.append(left, right, line);
    return wrap;
  };

  ns.makeMiniBadge = function makeMiniBadge(label, tone) {
    const badge = document.createElement("span");
    badge.className = `wwp-mini-badge ${tone || ""}`.trim();
    badge.textContent = label;
    return badge;
  };
})(globalThis);
