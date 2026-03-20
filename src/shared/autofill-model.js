(function initAutofillModel(global) {
  const ns = (global.WWP = global.WWP || {});
  ns.AUTOFILL_INTENT = {
    UNKNOWN: "unknown",
    PROGRAM: "program",
    TERM: "graduation_or_term",
    COVER_LETTER_TEXT: "cover_letter_text",
    WHY_COMPANY: "why_company",
    WORK_AUTHORIZATION: "work_authorization",
    NAME: "name",
    EMAIL: "email",
    PHONE: "phone"
  };
})(globalThis);
