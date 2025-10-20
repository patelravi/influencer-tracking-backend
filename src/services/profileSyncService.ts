import { InfluencerModel } from '../models/InfluencerModel';
import { ScraperFactory } from './scrapers/scraperFactory';
import { Logger } from '../utils/logger';

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
    async initProfileSync(influencerId: string): Promise<void> {
        try {
            const influencer = await InfluencerModel.findById(influencerId);

            if (!influencer) {
                Logger.warn(`Influencer not found for profile sync: ${influencerId}`);
                throw new Error(`Influencer not found for profile sync: ${influencerId}`);
            }

            // Check if profile is already being synced
            if (influencer.isProfileSyncing) {
                Logger.warn(`Profile already being synced for influencer: ${influencerId}`);
                throw new Error(`Profile already being synced for influencer: ${influencerId}`);
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

            // Get the appropriate scraper for the platform
            const scraper = ScraperFactory.getScraper(influencer.platform);

            // Scrape profile data using the platform-specific scraper
            await scraper.initScrapProfile(influencer.handle);

            // if (profileData) {
            //     // Convert ProfileData to ProfileUpdateData
            //     const updatedData: ProfileUpdateData = {
            //         name: profileData.name,
            //         avatarUrl: profileData.avatarUrl,
            //         platformUserId: profileData.platformUserId,
            //         bio: profileData.bio,
            //         followerCount: profileData.followerCount,
            //         verified: profileData.verified,
            //         location: profileData.location
            //     };

            //     await this.updateInfluencerProfile(influencerId, updatedData);
            //     Logger.info(`Profile sync completed for ${influencer.name}`);
            //     return true;
            // }


        } catch (error) {
            Logger.error(`Error syncing profile for influencer ${influencerId}:`, error);
            throw error;
        } finally {
            // Always clear the syncing flag
            await InfluencerModel.updateOne(
                { _id: influencerId },
                { $set: { isProfileSyncing: false } }
            );
        }
    }


    /**
     * Update influencer profile data in database
     */
    // private async updateInfluencerProfile(influencerId: string, updateData: ProfileUpdateData): Promise<void> {
    //     try {
    //         const updateFields: any = {};

    //         // Only update fields that have values
    //         if (updateData.name) updateFields.name = updateData.name;
    //         if (updateData.avatarUrl) updateFields.avatarUrl = updateData.avatarUrl;
    //         if (updateData.platformUserId) updateFields.platformUserId = updateData.platformUserId;
    //         if (updateData.bio) updateFields.bio = updateData.bio;
    //         if (updateData.followerCount !== undefined) updateFields.followerCount = updateData.followerCount;
    //         if (updateData.verified !== undefined) updateFields.verified = updateData.verified;
    //         if (updateData.location) updateFields.location = updateData.location;

    //         // Add last profile sync timestamp
    //         updateFields.lastProfileSync = new Date();

    //         await InfluencerModel.updateOne(
    //             { _id: influencerId },
    //             { $set: updateFields }
    //         );

    //         Logger.info(`Updated profile data for influencer ${influencerId}`);
    //     } catch (error) {
    //         Logger.error(`Error updating influencer profile ${influencerId}:`, error);
    //         throw error;
    //     }
    // }

    /**
     * Sync profiles for all influencers
     */
    async syncAllInfluencerProfiles(): Promise<void> {
        try {
            const influencers = await InfluencerModel.find();
            Logger.info(`Starting profile sync for ${influencers.length} influencers`);

            let totalSynced = 0;
            for (const influencer of influencers) {
                await this.initProfileSync(String(influencer._id));
                totalSynced++;

                // Add delay to avoid rate limiting
                await this.delay(200);
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
