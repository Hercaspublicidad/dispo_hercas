export function shouldReplaceAvailabilityList(fullSnapshot, safeMatches, identifiedEntries) {
  return !!fullSnapshot && safeMatches >= 3 && identifiedEntries > 0 && safeMatches / identifiedEntries >= 0.8;
}
