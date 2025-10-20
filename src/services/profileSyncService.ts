import { InfluencerModel } from '../models/InfluencerModel';
import { ProfileScraperService } from './profileScraperService';
import { XService } from './xService';
import { Logger } from '../utils/logger';
import { PlatformType } from '../utils/const';

export interface ProfileUpdateData {
    name?: string;
    avatarUrl?: string;
    platformUserId?: string;
    bio?: string;
    followerCount?: number;
    verified?: boolean;
    location?: string;
}

export class ProfileSyncService {

    /**
     * Sync profile data for a single influencer
     */
    async syncInfluencerProfile(influencerId: string): Promise<boolean> {
        try {
            const influencer = await InfluencerModel.findById(influencerId);

            if (!influencer) {
                Logger.warn(`Influencer not found for profile sync: ${influencerId}`);
                return false;
            }

            // Check if profile is already being synced
            if (influencer.isProfileSyncing) {
                Logger.warn(`Profile already being synced for influencer: ${influencerId}`);
                return false;
            }

            // Set profile syncing flag
            await InfluencerModel.updateOne(
                { _id: influencerId },
                {
                    $set: {
                        isProfileSyncing: true,
                        lastSyncAttempt: new Date()
                    }
                }
            );

            Logger.info(`Starting profile sync for ${influencer.name} (${influencer.platform})`);

            let updatedData: ProfileUpdateData | null = null;

            switch (influencer.platform) {
                case PlatformType.X:
                    updatedData = await this.syncXProfile(influencer);
                    break;
                case PlatformType.LinkedIn:
                    updatedData = await this.syncLinkedInProfile(influencer);
                    break;
                default:
                    Logger.warn(`Unsupported platform for profile sync: ${influencer.platform}`);
                    return false;
            }

            if (updatedData) {
                await this.updateInfluencerProfile(influencerId, updatedData);
                Logger.info(`Profile sync completed for ${influencer.name}`);
                return true;
            }

            return false;
        } catch (error) {
            Logger.error(`Error syncing profile for influencer ${influencerId}:`, error);
            return false;
        } finally {
            // Always clear the syncing flag
            await InfluencerModel.updateOne(
                { _id: influencerId },
                { $set: { isProfileSyncing: false } }
            );
        }
    }

    /**
     * Sync X/Twitter profile data
     */
    private async syncXProfile(influencer: any): Promise<ProfileUpdateData | null> {
        try {
            const xService = new XService();

            // Get or fetch platform user ID
            let platformUserId = influencer.platformUserId;

            if (!platformUserId) {
                const user = await xService.getUserByUsername(influencer.handle);
                if (user) {
                    platformUserId = user.id;
                }
            }

            if (!platformUserId) {
                Logger.warn(`Could not find X user for profile sync: ${influencer.handle}`);
                return null;
            }

            // Fetch current user data
            const userData = await xService.getUserById(platformUserId);

            if (!userData) {
                Logger.warn(`Could not fetch X user data for: ${influencer.handle}`);
                return null;
            }

            return {
                name: userData.name,
                avatarUrl: userData.profile_image_url,
                platformUserId: userData.id,
                bio: userData.description,
                followerCount: userData.public_metrics?.followers_count,
                verified: userData.verified
            };
        } catch (error) {
            Logger.error(`Error syncing X profile for ${influencer.handle}:`, error);
            return null;
        }
    }

    /**
     * Sync LinkedIn profile data using ProfileScraperService
     */
    private async syncLinkedInProfile(influencer: any): Promise<ProfileUpdateData | null> {
        try {
            const profileScraper = new ProfileScraperService();
            const profileData = await profileScraper.fetchProfileData('LinkedIn', influencer.handle);

            if (!profileData) {
                Logger.warn(`Could not fetch LinkedIn profile data for: ${influencer.handle}`);
                return null;
            }

            return {
                name: profileData.name,
                avatarUrl: profileData.avatarUrl,
                platformUserId: profileData.platformUserId,
                bio: profileData.bio,
                followerCount: profileData.followerCount,
                verified: profileData.verified,
                location: profileData.location
            };
        } catch (error) {
            Logger.error(`Error syncing LinkedIn profile for ${influencer.handle}:`, error);
            return null;
        }
    }

    /**
     * Update influencer profile data in database
     */
    private async updateInfluencerProfile(influencerId: string, updateData: ProfileUpdateData): Promise<void> {
        try {
            const updateFields: any = {};

            // Only update fields that have values
            if (updateData.name) updateFields.name = updateData.name;
            if (updateData.avatarUrl) updateFields.avatarUrl = updateData.avatarUrl;
            if (updateData.platformUserId) updateFields.platformUserId = updateData.platformUserId;
            if (updateData.bio) updateFields.bio = updateData.bio;
            if (updateData.followerCount !== undefined) updateFields.followerCount = updateData.followerCount;
            if (updateData.verified !== undefined) updateFields.verified = updateData.verified;
            if (updateData.location) updateFields.location = updateData.location;

            // Add last profile sync timestamp
            updateFields.lastProfileSync = new Date();

            await InfluencerModel.updateOne(
                { _id: influencerId },
                { $set: updateFields }
            );

            Logger.info(`Updated profile data for influencer ${influencerId}`);
        } catch (error) {
            Logger.error(`Error updating influencer profile ${influencerId}:`, error);
            throw error;
        }
    }

    /**
     * Sync profiles for all influencers
     */
    async syncAllInfluencerProfiles(): Promise<void> {
        try {
            const influencers = await InfluencerModel.find();
            Logger.info(`Starting profile sync for ${influencers.length} influencers`);

            let totalSynced = 0;
            for (const influencer of influencers) {
                const synced = await this.syncInfluencerProfile(String(influencer._id));
                if (synced) {
                    totalSynced++;
                }

                // Add delay to avoid rate limiting
                await this.delay(1000);
            }

            Logger.info(`Profile sync completed. Total profiles updated: ${totalSynced}`);
        } catch (error) {
            Logger.error('Error in syncAllInfluencerProfiles:', error);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
