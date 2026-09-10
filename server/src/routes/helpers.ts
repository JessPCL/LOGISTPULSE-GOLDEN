import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function actorFrom(request: Request): string {
  const header = request.header("x-actor")?.trim();
  return header && header.length <= 120 ? header : "operador@pulse.local";
}

