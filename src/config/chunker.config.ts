const config = {
  /**
   * Stands in for the 192-token ceiling without loading a tokenizer.
   * Measured on the corpus: 5.0 chars per token overall, 4.26 at the 5th percentile.
   */
  MAX_CHUNK_CHARS: 800,
} as const;

export default config;
