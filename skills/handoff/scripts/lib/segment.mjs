// One path-segment test shared by the reading path rule (paths.mjs) and by drift's check of a recorded
// dirty path (git.mjs), so the two cannot disagree about what a parent segment is.

// `..`, and `..` followed by spaces, which Windows resolves to `..` as well. (`...` is a different
// name — people write it as an abbreviation inside a path — and stays an ordinary segment.)
export const isParentSegment = (seg) => /^\.\.\s*$/.test(seg)
