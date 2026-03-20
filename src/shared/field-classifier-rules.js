/**
 * Label / placeholder heuristics — conservative; unknown beats wrong.
 */
(function initFieldClassifierRules(global) {
  const ns = (global.WWP = global.WWP || {});
  const { AUTOFILL_INTENT: I } = ns;

  ns.FIELD_CLASSIFIER_RULES = [
    { intent: I.NAME, patterns: [/\bname\b/i, /full\s*name/i] },
    { intent: I.EMAIL, patterns: [/e-?mail/i, /@/] },
    { intent: I.PHONE, patterns: [/\bphone\b/i, /\bmobile\b/i, /\btel\b/i] },
    { intent: I.PROGRAM, patterns: [/program/i, /\bdegree\b/i, /academic\s*plan/i] },
    { intent: I.TERM, patterns: [/graduation/i, /\bterm\b/i, /work\s*term/i, /sequence/i] },
    { intent: I.COVER_LETTER_TEXT, patterns: [/cover\s*letter/i, /letter\s*of\s*interest/i] },
    { intent: I.WHY_COMPANY, patterns: [/why\s*.*(interested|company|role)/i, /motivation/i] },
    { intent: I.WORK_AUTHORIZATION, patterns: [/authorized\s*to\s*work/i, /legally\s*eligible/i, /work\s*permit/i] }
  ];
})(globalThis);
