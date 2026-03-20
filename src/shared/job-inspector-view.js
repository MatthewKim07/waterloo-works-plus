/**
 * Shared DOM chunks for posting page + listings selected-job panel (one code path).
 */
(function initJobInspectorView(global) {
  const ns = (global.WWP = global.WWP || {});

  /**
   * @param {object} libs - { makeCard, makeProgressMetric }
   * @param {object} m - skillMatch, targetRoleMatch, overallMatch, viability
   */
  function buildScoreCard(libs, m) {
    const card = libs.makeCard("Scores");
    card.appendChild(libs.makeProgressMetric("Skill Match", m.skillMatch));
    card.appendChild(libs.makeProgressMetric("Target Role Match", m.targetRoleMatch));
    card.appendChild(libs.makeProgressMetric("Overall Match", m.overallMatch));

    const breakdown = document.createElement("div");
    breakdown.className = "wwp-kv";
    const v = m.viability || { score: 0, breakdown: {} };
    const b = v.breakdown || {};
    [
      ["Work Term Compatibility", `${b.termCompatibility != null ? b.termCompatibility : 0}%`],
      ["Faculty Alignment", `${b.facultyAlignment != null ? b.facultyAlignment : 0}%`],
      ["Viability", `${v.score != null ? v.score : 0}%`],
      ["Selectivity Adj.", `${b.selectivityAdjustment != null ? b.selectivityAdjustment : 0}`]
    ].forEach(([k, val]) => {
      const row = document.createElement("div");
      row.innerHTML = `<span>${k}</span><strong>${val}</strong>`;
      breakdown.appendChild(row);
    });
    card.appendChild(breakdown);
    return card;
  }

  /**
   * @param {object} libs - { makeCard }
   * @param {object} rec - recommendAction() result { label, reasons: [] }
   */
  function buildRecommendationCard(libs, rec) {
    const safe = rec || { label: "—", reasons: [] };
    const card = libs.makeCard("Strategic Recommendation");
    const title = document.createElement("p");
    title.style.margin = "0 0 6px";
    title.style.fontWeight = "700";
    title.textContent = safe.label;
    const list = document.createElement("ul");
    list.className = "wwp-list";
    (safe.reasons || []).forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      list.appendChild(li);
    });
    card.append(title, list);
    return card;
  }

  function buildActionStubs() {
    const wrap = document.createElement("div");
    wrap.className = "wwp-inspector-actions";
    wrap.style.display = "flex";
    wrap.style.flexWrap = "wrap";
    wrap.style.gap = "8px";
    wrap.style.marginTop = "10px";

    [["Autofill (soon)", true], ["Track application (soon)", true]].forEach(([label, disabled]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.style.opacity = disabled ? "0.55" : "1";
      btn.style.cursor = disabled ? "not-allowed" : "pointer";
      wrap.appendChild(btn);
    });
    return wrap;
  }

  ns.jobInspectorView = {
    buildScoreCard,
    buildRecommendationCard,
    buildActionStubs
  };
})(globalThis);
