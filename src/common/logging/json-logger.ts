import { LogLevel, LoggerService } from '@nestjs/common';

type Write = (line: string) => void;

/** One JSON object per line, for log shippers. Used when NODE_ENV=production. */
export class JsonLogger implements LoggerService {
  constructor(private readonly write: Write = (line) => process.stdout.write(`${line}\n`)) {}

  private emit(level: LogLevel, message: unknown, context?: string, stack?: string): void {
    this.write(
      JSON.stringify({
        time: new Date().toISOString(),
        level,
        context,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        ...(stack ? { stack } : {}),
      }),
    );
  }

  log(message: unknown, context?: string): void {
    this.emit('log', message, context);
  }
  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.emit('verbose', message, context);
  }
  // Nest calls error(message, stack, context) when a stack is present.
  error(message: unknown, stackOrContext?: string, context?: string): void {
    if (context !== undefined) this.emit('error', message, context, stackOrContext);
    else this.emit('error', message, stackOrContext);
  }
}
