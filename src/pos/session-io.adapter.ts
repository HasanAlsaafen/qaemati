import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { IncomingMessage } from 'http';
import { RequestHandler } from 'express';
import { ServerOptions } from 'socket.io';

/** True when a browser's Origin header is this very site, or absent (not a browser). */
export function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

/**
 * Socket.IO that reads the same login session as the rest of the site, so
 * a staff screen needs no second sign in and no token in the page. A page on
 * another site cannot open a socket with a visitor's cookie, because the
 * Origin must match this site's own host.
 */
export class SessionIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly sessionMiddleware: RequestHandler,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: false,
      allowRequest: (
        request: IncomingMessage,
        callback: (error: string | null | undefined, ok: boolean) => void,
      ) => callback(null, isSameOrigin(request)),
    });
    server.engine.use(this.sessionMiddleware);
    return server;
  }
}
