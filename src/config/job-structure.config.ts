const config = {
  /**
   * Identifies the exact markup a structure was parsed from, so a stale row
   * can say whether the posting changed or only the parser did.
   */
  HASH_FUNCTION: "sha256",
} as const;

export default config;
