const ollamaConfig = {
  /**
   * Local Ollama server base URL.
   */
  BASE_URL: "http://localhost:11434",

  /**
   * Ollama API endpoint paths.
   * Chat performs structured resume and job inference;
   * embed creates vectors.
   */
  ENDPOINTS: {
    CHAT: "/api/chat",
    GENERATE: "/api/generate",
    EMBED: "/api/embed",
  },
};

export default ollamaConfig;
