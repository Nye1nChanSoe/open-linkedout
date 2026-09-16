const config = {
  /**
   * 800 characters instead of 192 tokens
   * 800 characters is roughly 190 tokens
   *
   * @note Measured on this corpus, text averages 5.0 characters per token and is 4.26 or more for 95% of long blocks
   */
  MAX_CHUNK_CHARS: 800,
} as const;

export default config;
