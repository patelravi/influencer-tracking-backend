import { InfluencerModel } from '../models/InfluencerModel';
import { PostModel } from '../models/PostModel';
import { XService } from './xService';
import { YouTubeService } from './youtubeService';
import { InstagramService } from './instagramService';
import { LinkedInScraperService } from './linkedInScraperService';
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

            let posts: any[] = [];

            switch (influencer.platform) {
                case PlatformType.X:
                    posts = await this.syncXPosts(influencer);
                    break;
                case PlatformType.YouTube:
                    posts = await this.syncYouTubePosts(influencer);
                    break;
                case PlatformType.Instagram:
                    posts = await this.syncInstagramPosts(influencer);
                    break;
                case PlatformType.LinkedIn:
                    posts = await this.syncLinkedInPosts(influencer.handle);
                    break;
                default:
                    Logger.warn(`Unknown platform: ${influencer.platform}`);
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
        }
    }

    private async syncXPosts(influencer: any): Promise<any[]> {
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

    private async syncYouTubePosts(influencer: any): Promise<any[]> {
        try {
            // Get or fetch platform user ID
            let platformUserId = influencer.platformUserId;

            const youtubeService = new YouTubeService();
            if (!platformUserId) {
                const channel = await youtubeService.getChannelByHandle(influencer.handle);
                if (channel) {
                    platformUserId = channel.id;
                    // Update influencer with platform user ID
                    await InfluencerModel.updateOne(
                        { _id: influencer._id },
                        {
                            platformUserId,
                            avatarUrl: channel.snippet.thumbnails.default.url,
                        }
                    );
                }
            }

            if (!platformUserId) {
                Logger.warn(`Could not find YouTube channel: ${influencer.handle}`);
                return [];
            }

            return await youtubeService.getChannelVideos(platformUserId, 10);
        } catch (error) {
            Logger.error(`Error syncing YouTube posts for ${influencer.handle}:`, error);
            return [];
        }
    }

    private async syncInstagramPosts(influencer: any): Promise<any[]> {
        try {
            const platformUserId = influencer.platformUserId;

            if (!platformUserId) {
                Logger.warn(`Instagram requires platform user ID to be set manually for ${influencer.handle}`);
                return [];
            }

            const instagramService = new InstagramService();
            return await instagramService.getUserMedia(platformUserId, 20);
        } catch (error) {
            Logger.error(`Error syncing Instagram posts for ${influencer.handle}:`, error);
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

            case PlatformType.Instagram:
                if (cleanHandle.includes('instagram.com')) {
                    return cleanHandle;
                }
                return `https://www.instagram.com/${cleanHandle}`;

            case PlatformType.YouTube:
                if (cleanHandle.includes('youtube.com')) {
                    return cleanHandle;
                }
                return `https://www.youtube.com/@${cleanHandle}`;

            case PlatformType.X:
                if (cleanHandle.includes('twitter.com') || cleanHandle.includes('x.com')) {
                    return cleanHandle;
                }
                return `https://x.com/${cleanHandle}`;

            default:
                return cleanHandle;
        }
    }


    private async syncLinkedInPosts(handle: string): Promise<any[]> {
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

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

