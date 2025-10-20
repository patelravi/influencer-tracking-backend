import { InfluencerModel } from '../models/InfluencerModel';
import { ScraperFactory } from './scrapers/scraperFactory';
import { ProfileSyncService } from './profileSyncService';
import { Logger } from '../utils/logger';

export class PostSyncService {
    // Sync posts for a single influencer
    async initPostSync(influencerId: string): Promise<void> {
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
            await scraper.initScrapPosts(influencer.handle, 20);

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

    // Sync both posts and profile data for all influencers
    async syncAllInfluencerData(): Promise<void> {
        try {
            const influencers = await InfluencerModel.find();
            Logger.info(`Starting complete data sync for ${influencers.length} influencers`);

            for (const influencer of influencers) {
                // Sync posts first.
                await this.initPostSync(String(influencer._id));

                // Sync profile data.
                await new ProfileSyncService().initProfileSync(String(influencer._id));

                // Add delay to avoid rate limiting
                await this.delay(200);
            }

            Logger.info(`Complete sync finished.`);
        } catch (error) {
            Logger.error('Error in syncAllInfluencerData:', error);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

