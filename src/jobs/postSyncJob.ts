import { Queue, Worker } from 'bullmq';
import { RedisClient } from '../config/redis';
import { PostSyncService } from '../services/postSyncService';
import { Logger } from '../utils/logger';

export class PostSyncJob {
    private static queue: Queue | null = null;
    private static worker: Worker | null = null;

    // Get or create the queue instance
    static getQueue(): Queue {
        if (!this.queue) {
            throw new Error('PostSyncJob not initialized. Call init() first.');
        }
        return this.queue;
    }

    // Initialize the job queue and worker
    static async init(): Promise<void> {
        try {
            // Create queue for post syncing
            this.queue = new Queue('post-sync', {
                connection: RedisClient.getClient(),
            });

            // Create worker to process jobs
            this.worker = new Worker(
                'post-sync',
                async (job) => {
                    Logger.info(`Processing job ${job.id}: ${job.name}`);
                    const postSyncService = new PostSyncService();

                    switch (job.name) {
                        case 'sync-all-data':
                            await postSyncService.syncAllInfluencerData();
                            break;

                        case 'sync-influencer-data': {
                            const { influencerId } = job.data;
                            await postSyncService.syncInfluencerData(influencerId);
                            break;
                        }

                        default:
                            Logger.warn(`Unknown job type: ${job.name}`);
                    }
                },
                {
                    connection: RedisClient.getClient(),
                    concurrency: 2, // Process 2 jobs concurrently
                }
            );

            // Event listeners
            this.worker.on('completed', (job) => {
                Logger.info(`Job ${job.id} completed successfully`);
            });

            this.worker.on('failed', (job, err) => {
                Logger.error(`Job ${job?.id} failed:`, err);
            });

            // Schedule recurring sync job
            await this.scheduleRecurringSync();

            Logger.info('PostSyncJob initialized successfully');
        } catch (error) {
            Logger.error('Error initializing PostSyncJob:', error);
            throw error;
        }
    }

    // Schedule recurring sync job (every 3 hours)
    private static async scheduleRecurringSync(): Promise<void> {
        try {
            if (!this.queue) {
                throw new Error('Queue not initialized');
            }

            // Remove existing repeatable jobs
            const repeatableJobs = await this.queue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                await this.queue.removeRepeatableByKey(job.key);
            }

            // Add new repeatable job for complete data sync (posts + profiles)
            await this.queue.add(
                'sync-all-data',
                {},
                {
                    repeat: {
                        pattern: '0 */3 * * *', // Every 3 hours
                    },
                }
            );

            Logger.info('Scheduled recurring complete data sync job (posts + profiles every 3 hours)');
        } catch (error) {
            Logger.error('Error scheduling recurring sync:', error);
            throw error;
        }
    }
}

