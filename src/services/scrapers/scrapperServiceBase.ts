import { ScrapJobModel } from "../../models/ScrapJobModel";
import { ScrapJobContext } from "../../types/scraper";
import { Logger } from "../../utils/logger";
import { PlatformType } from "../../utils/const";
import { v4 as uuidv4 } from 'uuid';


export class ScrapperServiceBase {


    /**
     * Create a scrap job entry in the database
     */
    protected async createScrapJob(input: {
        handle: string,
        targetUrl: string,
        jobType: 'profile' | 'posts',
        jobContext: ScrapJobContext,
        platform: PlatformType,
        status: 'pending' | 'processing' | 'completed' | 'failed'
    }): Promise<string> {
        try {
            const jobId = uuidv4();

            const scrapJob = new ScrapJobModel({
                jobId,
                organizationId: input.jobContext.organizationId,
                userId: input.jobContext.userId,
                influencerId: input.jobContext.influencerId,
                platform: PlatformType.LinkedIn,
                jobType: input.jobType,
                status: 'pending',
                targetUrl: input.targetUrl,
                startedAt: new Date(),
                metadata: {
                    handle: input.handle,
                    platform: input.platform,
                },
            });

            await scrapJob.save();
            Logger.info(`Created scrap job ${jobId} for ${input.jobType} scraping of ${input.handle}`);

            return jobId;
        } catch (error) {
            Logger.error('Error creating scrap job:', error);
            throw error;
        }
    }

}