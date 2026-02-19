(function initRatingsPage(global) {
  const ns = (global.WWP = global.WWP || {});
  if (ns.__WWP_RATINGS_RAN) return;
  ns.__WWP_RATINGS_RAN = true;

  function describeTermAlignment(score) {
    if (score <= 25) return "Extremely Competitive for Your Work Term";
    if (score <= 55) return "Competitive but Possible";
    return "Strong Historical Alignment";
  }

  function describeFacultyAlignment(score) {
    if (score <= 35) return "Weak Faculty Alignment";
    if (score <= 65) return "Moderate Faculty Alignment";
    return "Strong Faculty Alignment";
  }

  function computeTrendDirection(hiresByTermTable) {
    const values = (hiresByTermTable || []).map((x) => Number(x.hires)).filter((n) => Number.isFinite(n));
    if (values.length < 3) return "Insufficient trend data";

    const recent = values.slice(0, Math.min(4, values.length));
    const older = values.slice(Math.min(4, values.length));
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;

    if (recentAvg > olderAvg * 1.15) return "Upward hiring trend";
    if (recentAvg < olderAvg * 0.85) return "Downward hiring trend";
    return "Stable hiring trend";
  }

  function computeSeasonalSpikes(hiresByTermTable) {
    const seasonal = {
      Fall: [],
      Winter: [],
      Spring: []
    };

    for (const row of hiresByTermTable || []) {
      const term = String(row.term || "").toLowerCase();
      const hires = Number(row.hires);
      if (!Number.isFinite(hires)) continue;
      if (term.includes("fall")) seasonal.Fall.push(hires);
      if (term.includes("winter")) seasonal.Winter.push(hires);
      if (term.includes("spring")) seasonal.Spring.push(hires);
    }

    const avgs = Object.entries(seasonal)
      .map(([season, values]) => {
        if (!values.length) return { season, avg: 0, count: 0 };
        return { season, avg: values.reduce((s, v) => s + v, 0) / values.length, count: values.length };
      })
      .filter((x) => x.count > 0);

    if (avgs.length < 2) return "Seasonal pattern unavailable";

    avgs.sort((a, b) => b.avg - a.avg);
    return `${avgs[0].season} tends to peak (${avgs[0].avg.toFixed(1)} avg hires)`;
  }

  function getTermShareForUser(userTerm, termDist) {
    const term = Number(userTerm || 1);
    const row = (termDist || []).find((entry) => {
      const match = String(entry.label || "").match(/([1-9])/);
      return match && Number(match[1]) === term;
    });
    return row ? Number(row.percent) || 0 : 0;
  }

  function getFacultyShare(userFaculty, facultyDist) {
    const faculty = String(userFaculty || "").toLowerCase();
    let share = 0;
    (facultyDist || []).forEach((entry) => {
      const label = String(entry.label || "").toLowerCase();
      if (label.includes(faculty) || faculty.includes(label)) {
        share = Math.max(share, Number(entry.percent) || 0);
      }
    });
    return share;
  }

  async function run() {
    const pageType = ns.detectPageType(document, location);
    if (pageType !== "ratings") return;

    const gate = await ns.getSettingsForPage();
    if (gate.disabled) return;

    const parsed = ns.parseRatingsPage(document);
    const prefs = gate.settings.preferences;

    const termScore = ns.computeTermCompatibility(prefs.workTerm, parsed.termDist);
    const facultyScore = ns.computeFacultyAlignment(prefs.faculty, parsed.facultyDist);
    const selectivity = ns.computeSelectivity(parsed.hiresByTermTable);

    const viability = ns.computeViabilityScore(50, termScore, facultyScore, selectivity);

    const termShare = getTermShareForUser(prefs.workTerm, parsed.termDist);
    const facultyShare = getFacultyShare(prefs.faculty, parsed.facultyDist);

    const recommendation = ns.recommendAction(viability.score, {
      termShareZero: termShare <= 0.1,
      facultyWeak: facultyScore < 40,
      highSkillMatch: false,
      lowSkillMatch: false
    });

    const panel = ns.createShadowPanel({
      id: "wwp-ratings-panel",
      title: "WaterlooWorks+",
      subtitle: "Hiring history and competitiveness",
      width: 390,
      onDisablePage: () => ns.disableCurrentPage()
    });

    const tabs = ns.createTabs(
      [
        { id: "overview", label: "Overview" },
        { id: "alignment", label: "Alignment" },
        { id: "trends", label: "Trends" },
        { id: "strategy", label: "Strategy" }
      ],
      "overview"
    );
    panel.body.appendChild(tabs.root);

    const scoreCard = ns.makeCard("Viability from Ratings Data");
    scoreCard.appendChild(ns.makeProgressMetric("Term Compatibility", termScore));
    scoreCard.appendChild(ns.makeProgressMetric("Faculty Alignment", facultyScore));
    scoreCard.appendChild(ns.makeProgressMetric("Overall Viability", viability.score));

    const stats = document.createElement("div");
    stats.className = "wwp-kv";
    [
      ["User work term share", `${termShare.toFixed(1)}%`],
      ["User faculty share", `${facultyShare.toFixed(1)}%`],
      ["Selectivity adjustment", `${selectivity}`]
    ].forEach(([k, v]) => {
      const row = document.createElement("div");
      row.innerHTML = `<span>${k}</span><strong>${v}</strong>`;
      stats.appendChild(row);
    });
    scoreCard.appendChild(stats);

    tabs.appendToTab("overview", scoreCard);

    const alignmentCard = ns.makeCard("Work Term + Faculty Analysis");
    const alignmentList = document.createElement("ul");
    alignmentList.className = "wwp-list";
    [
      `${describeTermAlignment(termScore)} (${termScore} / 100)`,
      `${describeFacultyAlignment(facultyScore)} (${facultyScore} / 100)`,
      `Your selected term share in history: ${termShare.toFixed(1)}%`,
      `Your selected faculty share in history: ${facultyShare.toFixed(1)}%`
    ].forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      alignmentList.appendChild(li);
    });
    alignmentCard.appendChild(alignmentList);

    const dataCard = ns.makeCard("Parsed Data Availability");
    const chips = document.createElement("div");
    chips.className = "wwp-chip-wrap";

    if (parsed.chartDataUnavailable.term) {
      chips.appendChild(ns.makeChip("Chart data unavailable: term distribution", "warn"));
    } else {
      chips.appendChild(ns.makeChip(`Work-term slices: ${parsed.termDist.length}`, "good"));
    }

    if (parsed.chartDataUnavailable.faculty) {
      chips.appendChild(ns.makeChip("Chart data unavailable: faculty distribution", "warn"));
    } else {
      chips.appendChild(ns.makeChip(`Faculty slices: ${parsed.facultyDist.length}`, "good"));
    }

    if (parsed.hiresByTermTable.length) {
      chips.appendChild(ns.makeChip(`Students Hired rows: ${parsed.hiresByTermTable.length}`, "good"));
    } else {
      chips.appendChild(ns.makeChip("Students Hired table unavailable", "danger"));
    }

    dataCard.appendChild(chips);

    tabs.appendToTab("alignment", alignmentCard);
    tabs.appendToTab("alignment", dataCard);

    const trendCard = ns.makeCard("Hiring Trend Analysis");
    const trendList = document.createElement("ul");
    trendList.className = "wwp-list";
    [
      computeTrendDirection(parsed.hiresByTermTable),
      computeSeasonalSpikes(parsed.hiresByTermTable),
      `Table rows considered: ${parsed.hiresByTermTable.length}`
    ].forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      trendList.appendChild(li);
    });
    trendCard.appendChild(trendList);

    const recentCard = ns.makeCard("Recent Terms Snapshot");
    const recentList = document.createElement("ul");
    recentList.className = "wwp-list";
    parsed.hiresByTermTable.slice(0, 8).forEach((row) => {
      const li = document.createElement("li");
      li.textContent = `${row.term}: ${row.hires} hires`;
      recentList.appendChild(li);
    });
    if (!parsed.hiresByTermTable.length) {
      recentList.appendChild(Object.assign(document.createElement("li"), { textContent: "No students-hired rows parsed." }));
    }
    recentCard.appendChild(recentList);

    tabs.appendToTab("trends", trendCard);
    tabs.appendToTab("trends", recentCard);

    const recCard = ns.makeCard("Strategic Recommendation");
    const recTitle = document.createElement("p");
    recTitle.style.margin = "0 0 6px";
    recTitle.style.fontWeight = "700";
    recTitle.textContent = recommendation.label;
    const recList = document.createElement("ul");
    recList.className = "wwp-list";
    recommendation.reasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      recList.appendChild(li);
    });
    recCard.append(recTitle, recList);

    const playbookCard = ns.makeCard("Suggested Playbook");
    const playbookList = document.createElement("ul");
    playbookList.className = "wwp-list";

    [
      termScore < 40
        ? "Prioritize roles that historically hire your term level more frequently."
        : "Your term level shows viable historical alignment for this employer.",
      facultyScore < 40
        ? "Treat this as a reach unless your project experience is exceptional."
        : "Faculty alignment is acceptable; lead with relevant projects.",
      selectivity < 0
        ? "Low average hires suggest higher selectivity; submit polished materials early."
        : "Average hires are moderate/high; apply broadly across related roles."
    ].forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      playbookList.appendChild(li);
    });
    playbookCard.appendChild(playbookList);

    tabs.appendToTab("strategy", recCard);
    tabs.appendToTab("strategy", playbookCard);
  }

  run().catch((error) => {
    console.error("WaterlooWorks+ ratings script failed", error);
  });
})(globalThis);
