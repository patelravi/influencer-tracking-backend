import { InfluencerModel } from '../models/InfluencerModel';
import { PostModel } from '../models/PostModel';
import { XService } from './xService';
import { LinkedInScraperService } from './linkedInScraperService';
import { ProfileSyncService } from './profileSyncService';
import { Logger } from '../utils/logger';
import { PlatformType } from '../utils/const';

export class PostSyncService {
    // Sync posts for a single influencer
    async syncInfluencerPosts(influencerId: string): Promise<number> {
        try {
            const influencer = await InfluencerModel.findById(influencerId);

            if (!influencer) {
                Logger.warn(`Influencer not found: ${influencerId}`);
                return 0;
            }

            // Check if posts are already being synced
            if (influencer.isPostSyncing) {
                Logger.warn(`Posts already being synced for influencer: ${influencerId}`);
                return 0;
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

            let posts: Array<{
                platformPostId: string;
                content: string;
                postUrl: string;
                likes: number;
                comments: number;
                shares: number;
                postedAt: Date;
                mediaUrls: string[];
            }> = [];

            switch (influencer.platform) {
                case PlatformType.X:
                    posts = await this.syncXPosts(influencer);
                    break;
                case PlatformType.LinkedIn:
                    posts = await this.syncLinkedInPosts(influencer.handle);
                    break;
                default:
                    Logger.warn(`Unsupported platform: ${influencer.platform}`);
            }

            // Save new posts to database
            let savedCount = 0;
            for (const post of posts) {
                try {
                    await PostModel.create({
                        ...post,
                        influencerId: influencer._id,
                    });
                    savedCount++;
                } catch (error: any) {
                    // Duplicate posts will fail due to unique index on platformPostId
                    if (error.code !== 11000) {
                        Logger.error('Error saving post:', error);
                    }
                }
            }

            Logger.info(`Synced ${savedCount} new posts for ${influencer.name} (${influencer.platform})`);
            return savedCount;
        } catch (error) {
            Logger.error(`Error syncing posts for influencer ${influencerId}:`, error);
            return 0;
        } finally {
            // Always clear the syncing flag
            await InfluencerModel.updateOne(
                { _id: influencerId },
                { $set: { isPostSyncing: false } }
            );
        }
    }

    private async syncXPosts(influencer: {
        _id: any;
        platformUserId?: string;
        handle: string;
        platform: string;
        name: string;
    }): Promise<Array<{
        platformPostId: string;
        content: string;
        postUrl: string;
        likes: number;
        comments: number;
        shares: number;
        postedAt: Date;
        mediaUrls: string[];
    }>> {
        try {
            // Get or fetch platform user ID
            let platformUserId = influencer.platformUserId;
            const xService = new XService();

            if (!platformUserId) {
                const user = await xService.getUserByUsername(influencer.handle);
                if (user) {
                    platformUserId = user.id;
                    // Update influencer with platform user ID
                    await InfluencerModel.updateOne(
                        { _id: influencer._id },
                        { platformUserId, avatarUrl: user.profile_image_url }
                    );
                }
            }

            if (!platformUserId) {
                Logger.warn(`Could not find X user: ${influencer.handle}`);
                return [];
            }

            return await xService.getUserTweets(platformUserId, 20);
        } catch (error) {
            Logger.error(`Error syncing X posts for ${influencer.handle}:`, error);
            return [];
        }
    }

    /**
   * Build profile URL from platform and handle
   */
    private buildProfileUrl(platform: PlatformType, handle: string): string {
        // Remove @ symbol if present
        const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

        switch (platform) {
            case PlatformType.LinkedIn:
                // Handle can be company URL or profile URL
                if (cleanHandle.includes('linkedin.com')) {
                    return cleanHandle;
                }
                return `https://www.linkedin.com/in/${cleanHandle}`;

            case PlatformType.X:
                if (cleanHandle.includes('twitter.com') || cleanHandle.includes('x.com')) {
                    return cleanHandle;
                }
                return `https://x.com/${cleanHandle}`;

            default:
                return cleanHandle;
        }
    }

    private async syncLinkedInPosts(handle: string): Promise<Array<{
        platformPostId: string;
        content: string;
        postUrl: string;
        likes: number;
        comments: number;
        shares: number;
        postedAt: Date;
        mediaUrls: string[];
    }>> {
        try {

            const profileUrl = this.buildProfileUrl(PlatformType.LinkedIn, handle)
            Logger.info(`Scraping LinkedIn posts from: ${profileUrl}`);

            // Use Bright Data API to scrape posts
            const linkedInScraperService = new LinkedInScraperService();
            return await linkedInScraperService.scrapeProfilePosts(profileUrl, 20);
        } catch (error) {
            Logger.error(`Error syncing LinkedIn posts for ${handle}:`, error);
            return [];
        }
    }

    // Sync posts for all influencers
    async syncAllInfluencers(): Promise<void> {
        try {
            const influencers = await InfluencerModel.find();
            Logger.info(`Starting sync for ${influencers.length} influencers`);

            let totalSynced = 0;
            for (const influencer of influencers) {
                const count = await this.syncInfluencerPosts(String(influencer._id));
                totalSynced += count;

                // Add delay to avoid rate limiting
                await this.delay(1000);
            }

            Logger.info(`Sync completed. Total new posts: ${totalSynced}`);
        } catch (error) {
            Logger.error('Error in syncAllInfluencers:', error);
        }
    }

    // Sync both posts and profile data for a single influencer
    async syncInfluencerData(influencerId: string): Promise<{ postsSynced: number; profileSynced: boolean }> {
        try {
            Logger.info(`Starting complete data sync for influencer: ${influencerId}`);

            // Sync posts first
            const postsSynced = await this.syncInfluencerPosts(influencerId);

            // Then sync profile data
            const profileSyncService = new ProfileSyncService();
            const profileSynced = await profileSyncService.syncInfluencerProfile(influencerId);

            Logger.info(`Complete sync finished for influencer ${influencerId}: ${postsSynced} posts, profile: ${profileSynced ? 'updated' : 'failed'}`);

            return { postsSynced, profileSynced };
        } catch (error) {
            Logger.error(`Error in complete sync for influencer ${influencerId}:`, error);
            return { postsSynced: 0, profileSynced: false };
        }
    }

    // Sync both posts and profile data for all influencers
    async syncAllInfluencerData(): Promise<void> {
        try {
            const influencers = await InfluencerModel.find();
            Logger.info(`Starting complete data sync for ${influencers.length} influencers`);

            let totalPostsSynced = 0;
            let totalProfilesSynced = 0;

            for (const influencer of influencers) {
                const result = await this.syncInfluencerData(String(influencer._id));
                totalPostsSynced += result.postsSynced;
                if (result.profileSynced) totalProfilesSynced++;

                // Add delay to avoid rate limiting
                await this.delay(1000);
            }

            Logger.info(`Complete sync finished. Posts: ${totalPostsSynced}, Profiles: ${totalProfilesSynced}`);
        } catch (error) {
            Logger.error('Error in syncAllInfluencerData:', error);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

