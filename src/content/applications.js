(function initApplicationsReconcilePass(global) {
  const ns = (global.WWP = global.WWP || {});
  if (ns.__WWP_APPLICATIONS_RAN) return;
  ns.__WWP_APPLICATIONS_RAN = true;

  async function run() {
    if (ns.logger && typeof ns.logger.refreshDebugFromStorage === "function") {
      await ns.logger.refreshDebugFromStorage();
    }
    if (!ns.isUserFacingWaterlooWorksPage || !ns.isUserFacingWaterlooWorksPage()) return;
    const gate = await ns.getSettingsForPage();
    if (gate.disabled || !ns.isFeatureEnabled(gate.settings, "applicationTracker")) return;

    const blob = String((document.body && document.body.textContent) || "").toLowerCase();
    const looksAppsPage =
      /my applications|application status|applications summary/.test(blob) ||
      (gate.pageType === "listings" && /application/.test(blob));

    if (!looksAppsPage) return;
    if (!ns.applicationReconciler || typeof ns.applicationReconciler.reconcileFromPage !== "function") return;

    const out = await ns.applicationReconciler.reconcileFromPage(document, location);
    if (ns.logger && out && out.updated) ns.logger.info("reconciler updated rows", out.updated);
    if (ns.appendWwpEvent && out && out.updated) {
      ns.appendWwpEvent("reconciler", { updated: out.updated }).catch(() => {});
    }
  }

  run().catch(() => {});
})(globalThis);
