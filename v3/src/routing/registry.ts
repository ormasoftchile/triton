/**
 * Router Registry
 *
 * Central registry of all available routing algorithms.
 * Built-in routers (straight, orthogonal, bezier, polyline) are
 * registered in frontend/index.ts.
 * Third-party routers call registerRouter().
 */

import type { Router, RouteStyle } from '../contracts/index.js';

const registry = new Map<RouteStyle, Router>();

/** Register a routing algorithm under a route style name. */
export function registerRouter(style: RouteStyle, router: Router): void {
  registry.set(style, router);
}

/** Look up a router by style. Returns undefined if not registered. */
export function getRouter(style: RouteStyle): Router | undefined {
  return registry.get(style);
}

/** Return all currently registered route style names. */
export function registeredRouters(): RouteStyle[] {
  return [...registry.keys()];
}
