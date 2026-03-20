(function initAutofillFieldMapper(global) {
  const ns = (global.WWP = global.WWP || {});
  const rules = () => ns.FIELD_CLASSIFIER_RULES || [];

  function labelTextFor(el) {
    if (!el || typeof el.closest !== "function") return "";
    const id = el.id;
    if (id) {
      const scope = el.closest("form") || document;
      const lab = Array.from(scope.querySelectorAll("label[for]")).find((l) => l.getAttribute("for") === id);
      if (lab) return (lab.textContent || "").trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input,select,textarea").forEach((n) => n.remove());
      return (clone.textContent || "").trim();
    }
    let sib = el.previousElementSibling;
    let i = 0;
    while (sib && i < 4) {
      const t = (sib.textContent || "").trim();
      if (t && t.length < 200) return t;
      sib = sib.previousElementSibling;
      i += 1;
    }
    return "";
  }

  function classifyField(el) {
    const I = ns.AUTOFILL_INTENT || {};
    const name = `${el.name || ""} ${el.id || ""}`.toLowerCase();
    const ph = String(el.getAttribute("placeholder") || "").toLowerCase();
    const blob = `${labelTextFor(el)} ${name} ${ph}`.toLowerCase();

    for (const rule of rules()) {
      if (!rule.patterns) continue;
      if (rule.patterns.some((re) => re.test(blob))) {
        return rule.intent;
      }
    }
    return I.UNKNOWN;
  }

  /**
   * Dry-run only: [{ el, intent, resolved, confidence }]
   */
  function buildPlan(root, profile, settings) {
    const rootEl = root || document;
    const items = [];
    const seen = new Set();
    rootEl.querySelectorAll("input, textarea, select").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const type = String(el.getAttribute("type") || "").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "file") return;
      if (seen.has(el)) return;
      seen.add(el);
      const intent = classifyField(el);
      const resolved = ns.autofillResolvers ? ns.autofillResolvers.resolve(intent, profile, settings) : { value: "", confidence: "low" };
      items.push({
        tag: el.tagName,
        type: type || el.tagName.toLowerCase(),
        intent,
        proposed: resolved.value,
        confidence: resolved.confidence,
        note: resolved.note,
        label: labelTextFor(el).slice(0, 120)
      });
    });
    return { at: Date.now(), items };
  }

  ns.autofillFieldMapper = { buildPlan, classifyField, labelTextFor };
})(globalThis);
