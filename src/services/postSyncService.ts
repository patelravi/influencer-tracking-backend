import { InfluencerModel } from '../models/InfluencerModel';
import { ScraperFactory } from './scrapers/scraperFactory';
import { Logger } from '../utils/logger';
import { PostData, ScrapJobContext } from '../types/scraper';
import { PostModel } from '../models/PostModel';

export class PostSyncService {
    // Sync posts for a single influencer
    async initPostSync(influencerId: string, jobContext: { organizationId: string; userId: string }): Promise<void> {
        try {
            const influencer = await InfluencerModel.findById(influencerId);

            if (!influencer) {
                Logger.warn(`Influencer not found: ${influencerId}`);
                return;
            }

            // Check if posts are already being synced
            if (influencer.isPostSyncing) {
                Logger.warn(`Posts already being synced for influencer: ${influencerId}`);
                return;
            }

            // Set post syncing flag
            await InfluencerModel.updateOne(
                { _id: influencerId },
                {
                    $set: {
                        isPostSyncing: true,
                        lastSyncAttempt: new Date()
                    }
                }
            );

            // Scrape posts using the platform-specific scraper.
            const scraper = ScraperFactory.getScraper(influencer.platform);
            const scrapJobContext: ScrapJobContext = {
                organizationId: jobContext.organizationId,
                userId: jobContext.userId,
                influencerId: influencerId,
                jobType: 'posts' as const,
            };
            await scraper.initScrapPosts(influencer.handle, scrapJobContext);

            Logger.info(`Posts sync initiated for ${influencer.name} (${influencer.platform})`);
        } catch (error) {
            Logger.error(`Error syncing posts for influencer ${influencerId}:`, error);
            throw error;
        } finally {
            // Always clear the syncing flag
            await InfluencerModel.updateOne(
                { _id: influencerId },
                { $set: { isPostSyncing: false } }
            );
        }
    }

    /**
    * Update influencer post data in database
    */
    public async syncScrapedPostData(influencerId: string, updateData: PostData): Promise<void> {
        try {
            // Check if the post already exists for this influencer using platformPostId
            const existingPost = await PostModel.findOne({
                influencerId,
                platformPostId: updateData.platformPostId
            });

            if (!existingPost) {
                // Create new post if doesn't exist
                await PostModel.create({
                    influencerId,
                    content: updateData.content,
                    mediaUrls: updateData.mediaUrls,
                    postUrl: updateData.postUrl,
                    likes: updateData.likes,
                    comments: updateData.comments,
                    shares: updateData.shares,
                    postedAt: updateData.postedAt,
                    platformPostId: updateData.platformPostId
                });

                Logger.info(`Created new post for influencer ${influencerId}, platformPostId: ${updateData.platformPostId}`);
            } else {
                // Update the existing post with new data
                await PostModel.updateOne(
                    { _id: existingPost._id },
                    {
                        $set: {
                            content: updateData.content,
                            mediaUrls: updateData.mediaUrls,
                            postUrl: updateData.postUrl,
                            likes: updateData.likes,
                            comments: updateData.comments,
                            shares: updateData.shares,
                            postedAt: updateData.postedAt
                        }
                    }
                );

                Logger.info(`Updated post for influencer ${influencerId}, platformPostId: ${updateData.platformPostId}`);
            }

            Logger.info(`Updated profile data for influencer ${influencerId}`);
        } catch (error) {
            Logger.error(`Error updating influencer profile ${influencerId}:`, error);
            throw error;
        }
    }

    // // Sync both posts and profile data for all influencers
    // async syncAllInfluencerData(): Promise<void> {
    //     try {
    //         const influencers = await InfluencerModel.find();
    //         Logger.info(`Starting complete data sync for ${influencers.length} influencers`);

    //         for (const influencer of influencers) {
    //             // Sync posts first.
    //             await this.initPostSync(String(influencer._id), { organizationId: String(influencer.organizationId), userId: String(influencer.userId) });
    //             // Add delay to avoid rate limiting
    //             await this.delay(200);
    //         }

    //         Logger.info(`Complete sync finished.`);
    //     } catch (error) {
    //         Logger.error('Error in syncAllInfluencerData:', error);
    //     }
    // }

    // private delay(ms: number): Promise<void> {
    //     return new Promise((resolve) => setTimeout(resolve, ms));
    // }
}

