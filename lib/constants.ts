/**
 * Plain constants with NO environment access, so scripts can import them
 * before dotenv loads (importing lib/config eagerly reads process.env).
 */

/** The single demo tenant. Matches DEMO_USER's org (Northwind Commerce). */
export const SELLER_ID = "seller_northwind";

/** Default conversation/session id for the web demo copilot. */
export const DEFAULT_SESSION_ID = "web-demo";
