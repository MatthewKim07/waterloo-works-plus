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
        background: #ffffff;
        color: #2B2B2B;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        scrollbar-width: thin;
        scrollbar-color: #ccc transparent;
      }
      .wwp-panel::-webkit-scrollbar { width: 6px; }
      .wwp-panel::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
      .wwp-panel::-webkit-scrollbar-track { background: transparent; }
      .wwp-header {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        background: #2B2B2B;
        color: #fff;
        border-bottom: 3px solid #FFC72C;
      }
      .wwp-title { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: -0.01em; color: #FFC72C; }
      .wwp-subtitle { margin: 0; font-size: 10px; color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .wwp-header-btn {
        appearance: none;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.7);
        background: rgba(255,255,255,0.08);
        cursor: pointer;
        transition: background 100ms ease, color 100ms ease;
        line-height: 1;
      }
      .wwp-header-btn:hover { background: rgba(255,255,255,0.18); color: #fff; }
      .wwp-body { padding: 12px; display: grid; gap: 10px; }
      .wwp-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px; background: #fafafa; transition: border-color 100ms ease; }
      .wwp-section-title { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #996f00; }
      .wwp-chip-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
      .wwp-chip { padding: 3px 8px; border-radius: 999px; font-size: 11px; border: 1px solid #ddd; background: #f5f5f5; color: #2B2B2B; }
      .wwp-chip.warn { border-color: #e6a800; background: #fff8e1; color: #7a5700; }
      .wwp-chip.danger { border-color: #e53935; background: #ffebee; color: #b71c1c; }
      .wwp-chip.good { border-color: #2e7d32; background: #e8f5e9; color: #1b5e20; }
      .wwp-list { margin: 0; padding-left: 16px; display: grid; gap: 6px; color: #2B2B2B; }
      .wwp-metric { display: grid; grid-template-columns: 1fr auto; gap: 8px; font-size: 12px; color: #2B2B2B; }
      .wwp-progress {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: #e5e5e5;
        overflow: hidden;
        margin-top: 4px;
      }
      .wwp-progress > span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #FFC72C, #e6a800);
      }
      .wwp-button {
        appearance: none;
        border: 1px solid #d0d0d0;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
        color: #2B2B2B;
        background: #fff;
        cursor: pointer;
        transition: border-color 100ms ease;
      }
      .wwp-button:hover { border-color: #FFC72C; }
      .wwp-input {
        width: 100%;
        appearance: none;
        border: 1px solid #d0d0d0;
        border-radius: 6px;
        background: #fff;
        color: #2B2B2B;
        padding: 8px 9px;
        font: inherit;
      }
      .wwp-input:focus {
        outline: none;
        border-color: #FFC72C;
        box-shadow: 0 0 0 3px rgba(255, 199, 44, 0.2);
      }
      .wwp-input::placeholder { color: #999; }
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
        color: #555;
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
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        padding: 8px;
        background: #fff;
        color: #2B2B2B;
        text-align: left;
        font: inherit;
        cursor: pointer;
        transition: border-color 100ms ease;
      }
      .wwp-search-item:hover { border-color: #FFC72C; }
      .wwp-search-item .meta {
        margin-top: 4px;
        font-size: 11px;
        color: #777;
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
        border: 1px solid #ccc;
        background: #f5f5f5;
        color: #2B2B2B;
        font-weight: 600;
      }
      .wwp-mini-badge.good { border-color: #2e7d32; background: #e8f5e9; color: #1b5e20; }
      .wwp-mini-badge.warn { border-color: #e6a800; background: #fff8e1; color: #7a5700; }
      .wwp-mini-badge.bad { border-color: #e53935; background: #ffebee; color: #b71c1c; }
      .wwp-inline-note { margin: 4px 0 0; font-size: 11px; color: #888; }
      .wwp-tabs { position: sticky; top: 0; z-index: 1; display: flex; gap: 2px; padding: 4px; background: #f5f5f5; border-bottom: 1px solid #e5e5e5; border-radius: 0; }
      .wwp-tab-btn {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        appearance: none;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #777;
        padding: 6px 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: color 100ms ease, background 100ms ease;
        border-bottom: 2px solid transparent;
      }
      .wwp-tab-btn:hover { color: #2B2B2B; background: rgba(0,0,0,0.04); }
      .wwp-tab-btn.active { color: #2B2B2B; background: #fff; border-bottom-color: #FFC72C; }
      .wwp-tab-pane { display: none; gap: 10px; }
      .wwp-tab-pane.active { display: grid; }

      /* Job card component */
      .wwp-job-card {
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        padding: 10px 12px;
        background: #fff;
        display: grid;
        gap: 6px;
        transition: border-color 100ms ease, box-shadow 100ms ease;
      }
      .wwp-job-card:hover { border-color: #FFC72C; box-shadow: 0 2px 8px rgba(255, 199, 44, 0.12); }
      .wwp-job-card .wwp-jc-title {
        font-size: 13px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0;
        line-height: 1.3;
      }
      .wwp-job-card .wwp-jc-company {
        font-size: 11px;
        color: #777;
        margin: 0;
      }
      .wwp-job-card .wwp-jc-insight {
        font-size: 11px;
        color: #996f00;
        margin: 0;
        line-height: 1.35;
      }
      .wwp-job-card .wwp-jc-insight.good { color: #2e7d32; }
      .wwp-job-card .wwp-jc-insight.danger { color: #c62828; }
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
        background: #FFC72C;
        border-color: #e6a800;
        color: #2B2B2B;
        font-weight: 600;
      }
      .wwp-button.primary:hover { background: #FFD54F; border-color: #FFC72C; }
      .wwp-button.ghost {
        background: transparent;
        border-color: #d0d0d0;
        color: #777;
      }
      .wwp-button.ghost:hover { color: #2B2B2B; border-color: #FFC72C; }
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
      .wwp-status-badge.not-applied { background: #f5f5f5; color: #999; border: 1px solid #ddd; }
      .wwp-status-badge.applied { background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9; }
      .wwp-status-badge.interview { background: #f3e5f5; color: #7b1fa2; border: 1px solid #ce93d8; }
      .wwp-status-badge.offer { background: #e8f5e9; color: #2e7d32; border: 1px solid #81c784; }
      .wwp-status-badge.rejected { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }

      /* Section divider */
      .wwp-section-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #996f00;
        margin: 4px 0 0;
        padding-bottom: 4px;
        border-bottom: 1px solid #e5e5e5;
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
      .wwp-skill-item .indicator.match { background: #2e7d32; }
      .wwp-skill-item .indicator.miss { background: #c62828; }
      .wwp-skill-item .indicator.partial { background: #e6a800; }
      .wwp-skill-item .label { color: #2B2B2B; }
      .wwp-skill-item .label.muted { color: #aaa; text-decoration: line-through; }

      /* Insight box */
      .wwp-insight-box {
        border: 1px solid #e0e0e0;
        border-left: 3px solid #FFC72C;
        border-radius: 4px;
        padding: 8px 10px;
        background: #fffdf5;
        font-size: 11px;
        color: #5a4500;
        line-height: 1.4;
      }
      .wwp-insight-box.warn {
        border-left-color: #e6a800;
        background: #fff8e1;
        color: #7a5700;
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
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        background: #fafafa;
      }
      .wwp-stat .wwp-stat-value {
        font-size: 18px;
        font-weight: 700;
        color: #2B2B2B;
        line-height: 1;
      }
      .wwp-stat .wwp-stat-label {
        font-size: 10px;
        color: #999;
        margin-top: 2px;
      }

      /* Clean bullet list */
      .wwp-clean-list {
        margin: 0;
        padding-left: 14px;
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: #444;
      }
      .wwp-clean-list li::marker { color: #ccc; }
    `;
    shadowRoot.appendChild(style);
  }

  function parsePixelValue(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Number.parseFloat(String(value || ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizePositionInput(input) {
    if (!input || typeof input !== "object") return null;
    const left = parsePixelValue(input.left, Number.NaN);
    const top = parsePixelValue(input.top, Number.NaN);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  }

  function captureFixedPosition(node) {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const styleLeft = parsePixelValue(node.style.left, Number.NaN);
    const styleTop = parsePixelValue(node.style.top, Number.NaN);
    const left = Number.isFinite(styleLeft) ? styleLeft : rect.left;
    const top = Number.isFinite(styleTop) ? styleTop : rect.top;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  }

  function isDraggablePanelTarget(target) {
    if (!(target instanceof Element)) return true;
    if (target.closest(".wwp-header-btn, .wwp-tab-btn")) return false;
    if (target.closest("a, button, input, textarea, select, option, label")) return false;
    if (target.getAttribute("role") === "button") return false;
    return true;
  }

  ns.createShadowPanel = function createShadowPanel(opts) {
    const options = opts || {};
    const hostId = options.id || "wwp-panel-host";
    const launcherId = `${hostId}-launcher`;
    const viewportMargin = 8;

    const existing = document.getElementById(hostId);
    const preservedPanelPosition = captureFixedPosition(existing);
    if (existing && typeof existing.__wwpCleanup === "function") {
      try {
        existing.__wwpCleanup();
      } catch (_error) {}
    }
    if (existing) existing.remove();
    const existingLauncher = document.getElementById(launcherId);
    const preservedLauncherPosition = captureFixedPosition(existingLauncher);
    if (existingLauncher && typeof existingLauncher.__wwpCleanup === "function") {
      try {
        existingLauncher.__wwpCleanup();
      } catch (_error) {}
    }
    if (existingLauncher) existingLauncher.remove();
    const explicitPanelPosition = normalizePositionInput(options.panelPosition);
    const explicitLauncherPosition = normalizePositionInput(options.launcherPosition);
    const initialOpen = options.initialOpen !== false;

    const host = document.createElement("div");
    host.id = hostId;
    host.style.position = "fixed";
    host.style.left = "12px";
    host.style.top = options.top || "74px";
    host.style.right = "auto";
    host.style.zIndex = "2147483646";

    const shadow = host.attachShadow({ mode: "open" });
    ensurePanelStyles(shadow);

    const panel = document.createElement("aside");
    panel.className = "wwp-panel";
    panel.style.width = options.width ? `${options.width}px` : "340px";

    const header = document.createElement("header");
    header.className = "wwp-header";
    header.style.cursor = "move";

    const titleWrap = document.createElement("div");
    titleWrap.style.display = "flex";
    titleWrap.style.alignItems = "center";
    titleWrap.style.gap = "8px";
    titleWrap.style.minWidth = "0";

    const headerIcon = document.createElement("img");
    headerIcon.src = chrome.runtime.getURL("src/assets/icons/icon-32.png");
    headerIcon.alt = "";
    headerIcon.style.width = "20px";
    headerIcon.style.height = "20px";
    headerIcon.style.flexShrink = "0";

    const titleTextWrap = document.createElement("div");
    titleTextWrap.style.minWidth = "0";
    const title = document.createElement("h2");
    title.className = "wwp-title";
    title.textContent = "WaterlooWorks +";
    const subtitle = document.createElement("p");
    subtitle.className = "wwp-subtitle";
    subtitle.textContent = options.subtitle || "";
    titleTextWrap.append(title, subtitle);
    titleWrap.append(headerIcon, titleTextWrap);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "4px";
    actions.style.flexShrink = "0";

    const launcher = document.createElement("button");
    launcher.id = launcherId;
    launcher.type = "button";
    launcher.textContent = "";
    launcher.setAttribute("aria-label", "Open WaterlooWorks+");
    launcher.title = "";
    launcher.style.position = "fixed";
    launcher.style.left = "14px";
    launcher.style.top = "18px";
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
    launcher.style.zIndex = "2147483645";
    launcher.style.width = "48px";
    launcher.style.height = "48px";
    launcher.style.borderRadius = "999px";
    launcher.style.border = "1px solid rgba(255, 255, 255, 0.12)";
    launcher.style.background = "#2B2B2B";
    launcher.style.cursor = "pointer";
    launcher.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.28)";
    launcher.style.display = "grid";
    launcher.style.placeItems = "center";
    launcher.style.padding = "0";
    launcher.style.display = "none";

    const launcherLogo = document.createElement("img");
    launcherLogo.src = chrome.runtime.getURL("src/assets/icons/icon-48.png");
    launcherLogo.alt = "";
    launcherLogo.style.width = "38px";
    launcherLogo.style.height = "38px";
    launcherLogo.style.objectFit = "contain";
    launcherLogo.style.display = "block";
    launcherLogo.style.transform = "translate(-2px, 1px)";
    launcherLogo.style.pointerEvents = "none";
    launcherLogo.addEventListener("error", () => {
      launcher.innerHTML = "";
      launcher.textContent = options.launcherText || "WW+";
      launcher.style.color = "#ffffff";
      launcher.style.font = "700 11px/1 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    });
    launcher.appendChild(launcherLogo);

    let suppressLauncherUntil = 0;

    function showPanel() {
      if (Date.now() < suppressLauncherUntil) return;
      host.style.display = "block";
      launcher.style.display = "none";
      clampPanelPosition();
    }

    function hidePanel() {
      suppressLauncherUntil = Date.now() + 250;
      host.style.display = "none";
      launcher.style.display = "grid";
      clampLauncherPosition();
      if (typeof options.onClose === "function") {
        options.onClose();
      }
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "wwp-header-btn";
    closeBtn.textContent = "\u2715";
    closeBtn.title = "Close panel";
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hidePanel();
    });
    actions.appendChild(closeBtn);

    if (typeof options.onDisablePage === "function") {
      const disableBtn = document.createElement("button");
      disableBtn.className = "wwp-header-btn";
      disableBtn.textContent = "Off";
      disableBtn.title = "Disable extension on this page";
      disableBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onDisablePage();
      });
      actions.prepend(disableBtn);
    }

    header.append(titleWrap, actions);

    const body = document.createElement("div");
    body.className = "wwp-body";

    panel.append(header, body);
    shadow.appendChild(panel);
    document.documentElement.appendChild(host);
    document.documentElement.appendChild(launcher);

    function getPanelSize() {
      const rect = panel.getBoundingClientRect();
      const fallbackWidth = parsePixelValue(options.width, 340);
      return {
        width: rect.width || fallbackWidth,
        height: rect.height || 320
      };
    }

    function getLauncherSize() {
      const rect = launcher.getBoundingClientRect();
      return {
        width: rect.width || 48,
        height: rect.height || 48
      };
    }

    function clampPanelPosition() {
      const size = getPanelSize();
      const maxX = Math.max(viewportMargin, window.innerWidth - size.width - viewportMargin);
      const maxY = Math.max(viewportMargin, window.innerHeight - size.height - viewportMargin);
      const currentX = parsePixelValue(host.style.left, maxX);
      const currentY = parsePixelValue(host.style.top, viewportMargin);
      host.style.left = `${Math.round(clampNumber(currentX, viewportMargin, maxX))}px`;
      host.style.top = `${Math.round(clampNumber(currentY, viewportMargin, maxY))}px`;
      host.style.right = "auto";
    }

    function clampLauncherPosition() {
      const size = getLauncherSize();
      const maxX = Math.max(viewportMargin, window.innerWidth - size.width - viewportMargin);
      const maxY = Math.max(viewportMargin, window.innerHeight - size.height - viewportMargin);
      const currentX = parsePixelValue(launcher.style.left, maxX);
      const currentY = parsePixelValue(launcher.style.top, maxY);
      launcher.style.left = `${Math.round(clampNumber(currentX, viewportMargin, maxX))}px`;
      launcher.style.top = `${Math.round(clampNumber(currentY, viewportMargin, maxY))}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }

    function setInitialPanelPosition() {
      if (explicitPanelPosition) {
        host.style.left = `${Math.round(explicitPanelPosition.left)}px`;
        host.style.top = `${Math.round(explicitPanelPosition.top)}px`;
        host.style.right = "auto";
        clampPanelPosition();
        return;
      }
      if (preservedPanelPosition) {
        host.style.left = `${Math.round(preservedPanelPosition.left)}px`;
        host.style.top = `${Math.round(preservedPanelPosition.top)}px`;
        host.style.right = "auto";
        clampPanelPosition();
        return;
      }
      const size = getPanelSize();
      const top = parsePixelValue(options.top, 74);
      const right = parsePixelValue(options.right, 12);
      const x = window.innerWidth - size.width - right;
      host.style.left = `${Math.round(x)}px`;
      host.style.top = `${Math.round(top)}px`;
      host.style.right = "auto";
      clampPanelPosition();
    }

    function setInitialLauncherPosition() {
      if (explicitLauncherPosition) {
        launcher.style.left = `${Math.round(explicitLauncherPosition.left)}px`;
        launcher.style.top = `${Math.round(explicitLauncherPosition.top)}px`;
        launcher.style.right = "auto";
        launcher.style.bottom = "auto";
        clampLauncherPosition();
        return;
      }
      if (preservedLauncherPosition) {
        launcher.style.left = `${Math.round(preservedLauncherPosition.left)}px`;
        launcher.style.top = `${Math.round(preservedLauncherPosition.top)}px`;
        launcher.style.right = "auto";
        launcher.style.bottom = "auto";
        clampLauncherPosition();
        return;
      }
      const size = getLauncherSize();
      const right = parsePixelValue(options.launcherRight, 14);
      const bottom = parsePixelValue(options.launcherBottom, 18);
      const x = window.innerWidth - size.width - right;
      const y = window.innerHeight - size.height - bottom;
      launcher.style.left = `${Math.round(x)}px`;
      launcher.style.top = `${Math.round(y)}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      clampLauncherPosition();
    }

    setInitialPanelPosition();
    setInitialLauncherPosition();
    if (!initialOpen) {
      host.style.display = "none";
      launcher.style.display = "grid";
      clampLauncherPosition();
    }

    let panelDrag = null;
    let launcherDrag = null;

    const onPanelPointerDown = (event) => {
      if (event.button !== 0) return;
      if (!isDraggablePanelTarget(event.target)) {
        return;
      }
      panelDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: parsePixelValue(host.style.left, 0),
        startTop: parsePixelValue(host.style.top, 0)
      };
      try {
        panel.setPointerCapture(event.pointerId);
      } catch (_error) {}
      document.documentElement.style.userSelect = "none";
      header.style.cursor = "grabbing";
      event.preventDefault();
    };

    const onLauncherPointerDown = (event) => {
      if (event.button !== 0) return;
      if (Date.now() < suppressLauncherUntil) return;
      launcherDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: parsePixelValue(launcher.style.left, 0),
        startTop: parsePixelValue(launcher.style.top, 0),
        moved: false
      };
      try {
        launcher.setPointerCapture(event.pointerId);
      } catch (_error) {}
      document.documentElement.style.userSelect = "none";
    };

    const onWindowPointerMove = (event) => {
      if (panelDrag && event.pointerId === panelDrag.pointerId) {
        const dx = event.clientX - panelDrag.startX;
        const dy = event.clientY - panelDrag.startY;
        host.style.left = `${Math.round(panelDrag.startLeft + dx)}px`;
        host.style.top = `${Math.round(panelDrag.startTop + dy)}px`;
        clampPanelPosition();
        return;
      }

      if (launcherDrag && event.pointerId === launcherDrag.pointerId) {
        const dx = event.clientX - launcherDrag.startX;
        const dy = event.clientY - launcherDrag.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) launcherDrag.moved = true;
        launcher.style.left = `${Math.round(launcherDrag.startLeft + dx)}px`;
        launcher.style.top = `${Math.round(launcherDrag.startTop + dy)}px`;
        clampLauncherPosition();
      }
    };

    const onWindowPointerUp = (event) => {
      if (panelDrag && event.pointerId === panelDrag.pointerId) {
        panelDrag = null;
        document.documentElement.style.userSelect = "";
        header.style.cursor = "move";
      }

      if (launcherDrag && event.pointerId === launcherDrag.pointerId) {
        const moved = launcherDrag.moved;
        launcherDrag = null;
        document.documentElement.style.userSelect = "";
        clampLauncherPosition();
        if (!moved) {
          showPanel();
        }
      }
    };

    const onLauncherKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showPanel();
      }
    };

    const onWindowResize = () => {
      clampPanelPosition();
      clampLauncherPosition();
    };

    panel.addEventListener("pointerdown", onPanelPointerDown);
    launcher.addEventListener("pointerdown", onLauncherPointerDown);
    launcher.addEventListener("keydown", onLauncherKeyDown);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    window.addEventListener("resize", onWindowResize);

    const cleanup = () => {
      panel.removeEventListener("pointerdown", onPanelPointerDown);
      launcher.removeEventListener("pointerdown", onLauncherPointerDown);
      launcher.removeEventListener("keydown", onLauncherKeyDown);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
      window.removeEventListener("resize", onWindowResize);
    };
    host.__wwpCleanup = cleanup;
    launcher.__wwpCleanup = cleanup;

    return {
      host,
      launcher,
      shadow,
      panel,
      body,
      setSubtitle(text) {
        subtitle.textContent = text;
      },
      getPanelPosition() {
        return captureFixedPosition(host);
      },
      getLauncherPosition() {
        return captureFixedPosition(launcher);
      },
      isOpen() {
        return host.style.display !== "none";
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
