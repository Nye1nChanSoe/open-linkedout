const domEventConfig = {
  /** Response headers received; navigation has started. */
  EVENT_COMMIT_PW: "commit",

  /** HTML parsed; the DOM is ready. */
  EVENT_DOMCONTENTLOADED: "domcontentloaded",

  /** Page and dependent resources loaded. */
  EVENT_LOAD: "load",

  /** No network requests for about 500 ms. */
  EVENT_NETWORKIDLE_PW: "networkidle",

  /** A frame navigated to a new URL. */
  EVENT_FRAME_NAVIGATED_PW: "framenavigated",
} as const;

export default domEventConfig;
