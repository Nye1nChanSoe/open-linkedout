import { ApplicationError } from "./application-error.js";

/** Error raised while saving scraped data to SQLite. */
export class PersistenceError extends ApplicationError {}
