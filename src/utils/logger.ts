import pino, { Logger as PinoLogger } from 'pino';
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

    // Proxy methods to underlying pino logger with proper overloads
    public static info(obj: object, msg?: string, ...args: unknown[]): void;
    public static info(msg: string, ...args: unknown[]): void;
    public static info(...args: unknown[]): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger.info as any)(...args);
    }

    public static error(obj: object, msg?: string, ...args: unknown[]): void;
    public static error(msg: string, ...args: unknown[]): void;
    public static error(...args: unknown[]): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger.error as any)(...args);
    }

    public static warn(obj: object, msg?: string, ...args: unknown[]): void;
    public static warn(msg: string, ...args: unknown[]): void;
    public static warn(...args: unknown[]): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger.warn as any)(...args);
    }

    public static debug(obj: object, msg?: string, ...args: unknown[]): void;
    public static debug(msg: string, ...args: unknown[]): void;
    public static debug(...args: unknown[]): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger.debug as any)(...args);
    }

    public static fatal(obj: object, msg?: string, ...args: unknown[]): void;
    public static fatal(msg: string, ...args: unknown[]): void;
    public static fatal(...args: unknown[]): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger.fatal as any)(...args);
    }

    public static trace(obj: object, msg?: string, ...args: unknown[]): void;
    public static trace(msg: string, ...args: unknown[]): void;
    public static trace(...args: unknown[]): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger.trace as any)(...args);
    }

    public static child(bindings: Record<string, unknown>) {
        return this.logger.child(bindings);
    }
}

