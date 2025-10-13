import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

export class RedisClient {
    private static client: Redis;


    public static init() {
        const redisHost = EnvConfig.get('REDIS_HOST');
        const redisPort = parseInt(EnvConfig.get('REDIS_PORT'));

        RedisClient.client = new Redis({
            host: redisHost,
            port: redisPort,
            maxRetriesPerRequest: null,
        });

        RedisClient.client.on('connect', () => {
            Logger.info('Redis connected successfully');
        });

        RedisClient.client.on('error', (err) => {
            Logger.error('Redis connection error:', err);
        });
    }

    public static getClient(): Redis {
        return RedisClient.client;
    }

    public static async get(key: string): Promise<string | null> {
        return RedisClient.client.get(key);
    }

    public static async set(key: string, value: string, expirySeconds?: number): Promise<'OK' | null> {
        if (expirySeconds) {
            return RedisClient.client.set(key, value, 'EX', expirySeconds);
        }
        return RedisClient.client.set(key, value);
    }

    public static async del(key: string): Promise<number> {
        return RedisClient.client.del(key);
    }

    public static async quit(): Promise<void> {
        await RedisClient.client.quit();
    }
}

