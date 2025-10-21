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
                for (let i = 0; i < payload.length; i++) {
                    const postsData = scrapper.parsePostData(payload[i]);
                    if (postsData) {
                        const service = new PostSyncService();
                        await service.syncScrapedPostData(scrapJob.influencerId.toString(), postsData);
                        Logger.info(`Posts sync completed for ${scrapJob.influencerId}`);
                    } else {
                        Logger.error(logPrefix, `Posts data ignored for job ${jobId}.`);
                    }
                }
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