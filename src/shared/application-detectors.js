(function initApplicationDetectors(global) {
  const ns = (global.WWP = global.WWP || {});

  function textBlob(doc) {
    const d = doc || (typeof document !== "undefined" ? document : null);
    return String((d && d.body && d.body.textContent) || "").toLowerCase();
  }

  function looksLikeSubmissionSuccess(doc) {
    const t = textBlob(doc);
    if (!t || t.length < 40) return false;
    return /(successfully submitted|application submitted|thank you for applying|your application has been received|submission complete)/i.test(
      t
    );
  }

  ns.applicationDetectors = {
    looksLikeSubmissionSuccess,
    textBlob
  };
})(globalThis);
