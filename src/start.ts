import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logger } from "./lib/logger";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    logger.error("Unhandled middleware error", { error: String(error) });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  // Security headers are applied via the server entry (src/server.ts)
  // where we have direct access to the h3 event and setResponseHeaders
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
