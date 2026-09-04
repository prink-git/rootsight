// The local model is asked to return `recommended_fix` as 1-3 concrete,
// semicolon-separated actions. This turns that into a clean list of
// discrete steps so every recommendation reads as a checklist, not a
// paragraph - shared by ActionCenter and ClusterDetail so there's one
// place that owns "how a fix recommendation gets parsed."
export function parseActionSteps(text) {
  if (!text) return [];
  // Split on semicolons first (the requested format), then fall back to
  // splitting on ". " for models that ignore the semicolon instruction,
  // and finally strip any leading numbering like "1)" or "1." the model
  // may have added on its own.
  let parts = text.includes(';')
    ? text.split(';')
    : text.split(/(?<=[a-z0-9])\.\s+(?=[A-Z])/);

  return parts
    .map((p) => p.trim().replace(/^\d+[).\s-]+/, '').trim())
    .filter((p) => p.length > 0);
}
