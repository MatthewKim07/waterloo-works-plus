(function initApplicationFormAssist(global) {
  const ns = (global.WWP = global.WWP || {});
  let injected = false;

  async function tryInject() {
    if (injected) return;
    if (!ns.isUserFacingWaterlooWorksPage || !ns.isUserFacingWaterlooWorksPage()) return;
    const gate = await ns.getSettingsForPage();
    if (gate.disabled || !ns.isFeatureEnabled(gate.settings, "autofill")) return;
    if (!document.querySelector("form")) return;

    injected = true;

    const wrap = document.createElement("div");
    wrap.id = "wwp-autofill-launcher";
    Object.assign(wrap.style, {
      position: "fixed",
      bottom: "48px",
      right: "14px",
      zIndex: "2147483640",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      alignItems: "flex-end",
      fontFamily: "system-ui, sans-serif"
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Autofill preview";
    Object.assign(btn.style, {
      padding: "8px 12px",
      borderRadius: "8px",
      border: "1px solid #1d4ed8",
      background: "#2563eb",
      color: "#fff",
      cursor: "pointer",
      fontSize: "13px",
      boxShadow: "0 4px 12px rgba(0,0,0,.2)"
    });

    const panel = document.createElement("div");
    panel.hidden = true;
    Object.assign(panel.style, {
      width: "min(420px, 92vw)",
      maxHeight: "240px",
      overflow: "auto",
      background: "#0f172a",
      color: "#e2e8f0",
      padding: "10px",
      borderRadius: "8px",
      fontSize: "12px",
      boxShadow: "0 8px 24px rgba(0,0,0,.35)"
    });
    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.whiteSpace = "pre-wrap";
    panel.appendChild(pre);

    btn.addEventListener("click", async () => {
      const g = await ns.getSettingsForPage();
      const profile = ns.profileStore ? await ns.profileStore.getActiveProfile() : null;
      if (!ns.autofillFieldMapper || typeof ns.autofillFieldMapper.buildPlan !== "function") {
        pre.textContent = "Field mapper not loaded.";
        panel.hidden = false;
        return;
      }
      const plan = ns.autofillFieldMapper.buildPlan(document.body, profile, g.settings);
      const lines = plan.items
        .filter((x) => x.intent && x.intent !== (ns.AUTOFILL_INTENT && ns.AUTOFILL_INTENT.UNKNOWN))
        .slice(0, 40)
        .map((x) => `${x.intent}: ${x.label || x.tag}\n  → ${String(x.proposed || "").slice(0, 120)} (${x.confidence})`);
      pre.textContent = lines.length ? lines.join("\n\n") : "No fields matched rules yet — extend field-classifier-rules.";
      panel.hidden = false;
    });

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    document.documentElement.appendChild(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => tryInject(), { once: true });
  } else {
    tryInject();
  }
})(globalThis);
