import { IScrapJob } from "../../models/ScrapJobModel";
import { ScrapJobModel } from "../../models/ScrapJobModel";
import { Logger } from "../../utils/logger";
import { PostSyncService } from "../postSyncService";
import { ProfileSyncService } from "../profileSyncService";
import { ScraperFactory } from "./scraperFactory";


const logPrefix = 'ScrapperWebhookHandler:';

export class ScrapperWebhookHandler {

    async handleWebhook(jobId: string, payload: any): Promise<void> {
        let scrapJob: IScrapJob | null = null;
        try {
            // Find the scrap job
            scrapJob = await ScrapJobModel.findOne({ jobId: jobId });
            if (!scrapJob) {
                Logger.warn(logPrefix, `Scrap job not found for jobId: ${jobId}`);
                return;
            }

            const scrapper = ScraperFactory.getScraper(scrapJob.platform);

            if (scrapJob.jobType === 'profile') {
                const service = new ProfileSyncService();

                for (let i = 0; i < payload.length; i++) {
                    const profileData = scrapper.parseProfileData(payload[i]);
                    if (profileData) {
                        await service.syncScrapedProfileData(scrapJob.influencerId.toString(), profileData);
                        Logger.info(`Profile sync completed for ${scrapJob.influencerId}`);
                    } else {
                        Logger.error(logPrefix, `Profile data ignored for job ${jobId}.`);
                    }
                }
            } else if (scrapJob.jobType == 'posts') {
                const service = new PostSyncService();
                let processedCount = 0;
                
                // Handle different payload structures from BrightData
                // BrightData might send an array of posts directly, or nested structures
                if (!Array.isArray(payload)) {
                    Logger.warn(logPrefix, `Expected array payload for posts, got: ${typeof payload}`);
                    // Try to parse as single post
                    const postsData = scrapper.parsePostData(payload);
                    if (postsData) {
                        await service.syncScrapedPostData(scrapJob.influencerId.toString(), postsData);
                        processedCount++;
                    }
                } else {
                    // Process each item in the payload array
                    for (let i = 0; i < payload.length; i++) {
                        const item = payload[i];
                        
                        // Check if item is an array of posts (nested structure)
                        if (Array.isArray(item)) {
                            // Process each post in the nested array
                            for (const post of item) {
                                const postsData = scrapper.parsePostData(post);
                                if (postsData) {
                                    await service.syncScrapedPostData(scrapJob.influencerId.toString(), postsData);
                                    processedCount++;
                                }
                            }
                        } else {
                            // Item is a single post object
                            const postsData = scrapper.parsePostData(item);
                            if (postsData) {
                                await service.syncScrapedPostData(scrapJob.influencerId.toString(), postsData);
                                processedCount++;
                            } else {
                                Logger.warn(logPrefix, `Post data at index ${i} could not be parsed for job ${jobId}`);
                            }
                        }
                    }
                }
                
                Logger.info(logPrefix, `Processed ${processedCount} posts for influencer ${scrapJob.influencerId} in job ${jobId}`);
            }


            // Save job as completed in db.
            scrapJob.completedAt = new Date();
            scrapJob.status = 'completed';
            await scrapJob.save();

            Logger.info(logPrefix, `Scrap job ${jobId} completed successfully`);
        } catch (err) {
            Logger.error(logPrefix, 'Error handling webhook for job', jobId, err);

            if (scrapJob) {
                scrapJob.status = 'failed';
                scrapJob.errorMessage = err instanceof Error ? err.message : 'Unknown error';
                await scrapJob.save();
            }
        }
    }
}