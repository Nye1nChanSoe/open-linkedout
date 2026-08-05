import { ApplicationError } from "./application-error.js";

/** Error raised while calling or validating a local LLM response. */
export class LLMError extends ApplicationError {}
