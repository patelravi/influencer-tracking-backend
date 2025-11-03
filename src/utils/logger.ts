import pino, { Logger as PinoLogger } from 'pino';
import { format as utilFormat } from 'node:util';
import { EnvConfig } from './config';

// Static logger class
export class Logger {
    private static logger: PinoLogger;

    // Initialize the pino logger instance
    public static init(): void {
        this.logger = pino({
            level: 'debug',
            transport:
                EnvConfig.get('NODE_ENV') === 'development'
                    ? {
                        target: 'pino-pretty',
                        options: {
                            colorize: true,
                            ignore: 'pid,hostname',
                            translateTime: 'SYS:standard',
                        },
                    }
                    : undefined,
        });
    }

    // Route calls to pino ensuring objects are in the first position per pino API
    private static route(method: keyof PinoLogger, args: unknown[]): void {
        // Guard against uninitialized logger - can happen during module loading
        if (!this.logger) {
            // Use console as fallback until logger is initialized
            const [first, ...rest] = args;
            if (rest.length > 0) {
                console.log(`[${method.toString().toUpperCase()}]`, first, ...rest);
            } else {
                console.log(`[${method.toString().toUpperCase()}]`, first);
            }
            return;
        }

        const [first, second, ...rest] = args;

        const isFirstString = typeof first === 'string';
        const isSecondObject = typeof second === 'object' && second !== null;

        if (isFirstString && isSecondObject) {
            // Support common usage: log('message', objOrError)
            // If it's an Error, place it under `err` key so pino formats stack
            const payload = second instanceof Error ? { err: second } : (second as object);
            // Call as (obj, msg, ...rest) to make pino include the object
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.logger[method] as any)(payload, first as string, ...rest);
            return;
        }

        if (isFirstString && !isSecondObject) {
            // Support multiple primitive args: log('a', 'b', 3) => 'a b 3'
            const message = utilFormat(first as string, ...(second !== undefined ? [second] : []), ...rest);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.logger[method] as any)(message);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger[method] as any)(...args);
    }

    // Proxy methods to underlying pino logger with proper overloads
    public static info(obj: object, msg?: string, ...args: unknown[]): void;
    public static info(msg: string, ...args: unknown[]): void;
    public static info(...args: unknown[]): void {
        this.route('info', args);
    }

    public static error(obj: object, msg?: string, ...args: unknown[]): void;
    public static error(msg: string, ...args: unknown[]): void;
    public static error(...args: unknown[]): void {
        this.route('error', args);
    }

    public static warn(obj: object, msg?: string, ...args: unknown[]): void;
    public static warn(msg: string, ...args: unknown[]): void;
    public static warn(...args: unknown[]): void {
        this.route('warn', args);
    }

    public static debug(obj: object, msg?: string, ...args: unknown[]): void;
    public static debug(msg: string, ...args: unknown[]): void;
    public static debug(...args: unknown[]): void {
        this.route('debug', args);
    }

    public static fatal(obj: object, msg?: string, ...args: unknown[]): void;
    public static fatal(msg: string, ...args: unknown[]): void;
    public static fatal(...args: unknown[]): void {
        this.route('fatal', args);
    }

    public static trace(obj: object, msg?: string, ...args: unknown[]): void;
    public static trace(msg: string, ...args: unknown[]): void;
    public static trace(...args: unknown[]): void {
        this.route('trace', args);
    }

    public static child(bindings: Record<string, unknown>) {
        if (!this.logger) {
            throw new Error('Logger must be initialized before calling child()');
        }
        return this.logger.child(bindings);
    }
}

