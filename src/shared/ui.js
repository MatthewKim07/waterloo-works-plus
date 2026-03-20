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

      /* Job card component */
      .wwp-job-card {
        border: 1px solid #1f2937;
        border-radius: 10px;
        padding: 10px 12px;
        background: #111827;
        display: grid;
        gap: 6px;
      }
      .wwp-job-card:hover { border-color: #334155; }
      .wwp-job-card .wwp-jc-title {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        margin: 0;
        line-height: 1.3;
      }
      .wwp-job-card .wwp-jc-company {
        font-size: 11px;
        color: #94a3b8;
        margin: 0;
      }
      .wwp-job-card .wwp-jc-insight {
        font-size: 11px;
        color: #fbbf24;
        margin: 0;
        line-height: 1.35;
      }
      .wwp-job-card .wwp-jc-insight.good { color: #86efac; }
      .wwp-job-card .wwp-jc-insight.danger { color: #fca5a5; }
      .wwp-job-card .wwp-jc-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .wwp-job-card .wwp-jc-actions {
        display: flex;
        gap: 6px;
        margin-top: 2px;
      }

      /* Action button variants */
      .wwp-button.primary {
        background: #1d4ed8;
        border-color: #2563eb;
        color: #fff;
        font-weight: 600;
      }
      .wwp-button.primary:hover { background: #2563eb; border-color: #3b82f6; }
      .wwp-button.ghost {
        background: transparent;
        border-color: #334155;
        color: #94a3b8;
      }
      .wwp-button.ghost:hover { color: #e2e8f0; border-color: #60a5fa; }
      .wwp-button.sm { padding: 3px 7px; font-size: 10px; }

      /* Status badge */
      .wwp-status-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .wwp-status-badge.not-applied { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
      .wwp-status-badge.applied { background: rgba(37, 99, 235, 0.15); color: #60a5fa; border: 1px solid rgba(37, 99, 235, 0.3); }
      .wwp-status-badge.interview { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
      .wwp-status-badge.offer { background: rgba(34, 197, 94, 0.15); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.3); }
      .wwp-status-badge.rejected { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.25); }

      /* Section divider */
      .wwp-section-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin: 4px 0 0;
        padding-bottom: 4px;
        border-bottom: 1px solid #1e293b;
      }

      /* Skill list with match indicators */
      .wwp-skill-list {
        display: grid;
        gap: 3px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .wwp-skill-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        padding: 3px 0;
      }
      .wwp-skill-item .indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .wwp-skill-item .indicator.match { background: #22c55e; }
      .wwp-skill-item .indicator.miss { background: #ef4444; }
      .wwp-skill-item .indicator.partial { background: #f59e0b; }
      .wwp-skill-item .label { color: #e2e8f0; }
      .wwp-skill-item .label.muted { color: #64748b; text-decoration: line-through; }

      /* Insight box */
      .wwp-insight-box {
        border: 1px solid #1e3a5f;
        border-radius: 8px;
        padding: 8px 10px;
        background: rgba(30, 58, 138, 0.15);
        font-size: 11px;
        color: #93c5fd;
        line-height: 1.4;
      }
      .wwp-insight-box.warn {
        border-color: rgba(245, 158, 11, 0.3);
        background: rgba(245, 158, 11, 0.08);
        color: #fcd34d;
      }

      /* Stat row */
      .wwp-stat-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .wwp-stat {
        flex: 1;
        min-width: 60px;
        text-align: center;
        padding: 8px 6px;
        border: 1px solid #1f2937;
        border-radius: 8px;
        background: #0b1220;
      }
      .wwp-stat .wwp-stat-value {
        font-size: 18px;
        font-weight: 700;
        color: #f1f5f9;
        line-height: 1;
      }
      .wwp-stat .wwp-stat-label {
        font-size: 10px;
        color: #64748b;
        margin-top: 2px;
      }

      /* Clean bullet list */
      .wwp-clean-list {
        margin: 0;
        padding-left: 14px;
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: #cbd5e1;
      }
      .wwp-clean-list li::marker { color: #475569; }
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
    launcher.textContent = "";
    launcher.setAttribute("aria-label", "Open WaterlooWorks+");
    launcher.title = "";
    launcher.style.position = "fixed";
    launcher.style.right = options.launcherRight || "14px";
    launcher.style.bottom = options.launcherBottom || "18px";
    launcher.style.zIndex = "2147483645";
    launcher.style.width = "48px";
    launcher.style.height = "48px";
    launcher.style.borderRadius = "999px";
    launcher.style.border = "1px solid rgba(30, 58, 138, 0.65)";
    launcher.style.background = "radial-gradient(circle at 30% 30%, #172554, #0f172a)";
    launcher.style.cursor = "pointer";
    launcher.style.boxShadow = "0 10px 24px rgba(2, 6, 23, 0.35)";
    launcher.style.display = "grid";
    launcher.style.placeItems = "center";
    launcher.style.padding = "0";
    launcher.style.display = "none";

    const launcherLogo = document.createElement("img");
    launcherLogo.src = chrome.runtime.getURL("src/assets/icons/icon-48.png");
    launcherLogo.alt = "";
    launcherLogo.style.width = "28px";
    launcherLogo.style.height = "28px";
    launcherLogo.style.objectFit = "contain";
    launcherLogo.style.pointerEvents = "none";
    launcherLogo.addEventListener("error", () => {
      launcher.innerHTML = "";
      launcher.textContent = options.launcherText || "WW+";
      launcher.style.color = "#eff6ff";
      launcher.style.font = "700 11px/1 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    });
    launcher.appendChild(launcherLogo);

    function showPanel() {
      host.style.display = "block";
      launcher.style.display = "none";
    }

    function hidePanel() {
      host.style.display = "none";
      launcher.style.display = "grid";
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
      disableBtn.textContent = options.disableButtonText || "Disable extension";
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

  ns.makeJobCard = function makeJobCard(options) {
    var opts = options || {};
    var card = document.createElement("div");
    card.className = "wwp-job-card";

    var title = document.createElement("p");
    title.className = "wwp-jc-title";
    title.textContent = opts.title || "Untitled";
    card.appendChild(title);

    var company = document.createElement("p");
    company.className = "wwp-jc-company";
    var companyParts = [];
    if (opts.company) companyParts.push(opts.company);
    if (opts.location) companyParts.push(opts.location);
    company.textContent = companyParts.join(" \u2022 ");
    card.appendChild(company);

    if (opts.status) {
      var badge = document.createElement("span");
      badge.className = "wwp-status-badge " + (opts.status.replace(/\s+/g, "-").toLowerCase());
      badge.textContent = opts.status;
      card.appendChild(badge);
    }

    if (opts.insight) {
      var insight = document.createElement("p");
      insight.className = "wwp-jc-insight" + (opts.insightTone ? " " + opts.insightTone : "");
      insight.textContent = opts.insight;
      card.appendChild(insight);
    }

    if (opts.tags && opts.tags.length) {
      var tagsWrap = document.createElement("div");
      tagsWrap.className = "wwp-jc-tags";
      opts.tags.forEach(function (tag) {
        tagsWrap.appendChild(ns.makeChip(tag.label || tag, tag.tone || ""));
      });
      card.appendChild(tagsWrap);
    }

    if (opts.actions && opts.actions.length) {
      var actionsWrap = document.createElement("div");
      actionsWrap.className = "wwp-jc-actions";
      opts.actions.forEach(function (action) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wwp-button sm " + (action.variant || "ghost");
        btn.textContent = action.label;
        if (typeof action.onClick === "function") {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            action.onClick();
          });
        }
        actionsWrap.appendChild(btn);
      });
      card.appendChild(actionsWrap);
    }

    return card;
  };

  ns.makeStatRow = function makeStatRow(stats) {
    var row = document.createElement("div");
    row.className = "wwp-stat-row";
    (stats || []).forEach(function (stat) {
      var cell = document.createElement("div");
      cell.className = "wwp-stat";
      var value = document.createElement("div");
      value.className = "wwp-stat-value";
      value.textContent = stat.value;
      var label = document.createElement("div");
      label.className = "wwp-stat-label";
      label.textContent = stat.label;
      cell.append(value, label);
      row.appendChild(cell);
    });
    return row;
  };

  ns.makeInsightBox = function makeInsightBox(text, tone) {
    var box = document.createElement("div");
    box.className = "wwp-insight-box" + (tone ? " " + tone : "");
    box.textContent = text;
    return box;
  };

  ns.makeSectionLabel = function makeSectionLabel(text) {
    var label = document.createElement("div");
    label.className = "wwp-section-label";
    label.textContent = text;
    return label;
  };

  ns.makeSkillList = function makeSkillList(skills) {
    var ul = document.createElement("ul");
    ul.className = "wwp-skill-list";
    (skills || []).forEach(function (skill) {
      var li = document.createElement("li");
      li.className = "wwp-skill-item";
      var dot = document.createElement("span");
      dot.className = "indicator " + (skill.match ? "match" : skill.partial ? "partial" : "miss");
      var label = document.createElement("span");
      label.className = "label" + (skill.match ? "" : skill.partial ? "" : " muted");
      label.textContent = skill.name;
      li.append(dot, label);
      ul.appendChild(li);
    });
    return ul;
  };
})(globalThis);
