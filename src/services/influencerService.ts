import { InfluencerModel } from '../models/InfluencerModel';
import { PostSyncService } from './postSyncService';
import { Logger } from '../utils/logger';
import { URLParser } from '../utils/urlParser';
import { PlatformType } from '../utils/const';
import { PostModel } from '../models/PostModel';
import { ProfileSyncService } from './profileSyncService';

export interface AddInfluencerData {
    name?: string;
    platform: string;
    profileUrl: string;
    userId: string;
    organizationId: string;
}

export interface InfluencerResult {
    influencers: any[];
    count: number;
}

export interface ServiceResult {
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
}

export class InfluencerService {
    private readonly validPlatforms = Object.values(PlatformType);

    /**
     * Validates platform input
     */
    private validatePlatform(platform: string): boolean {
        return this.validPlatforms.includes(platform as PlatformType);
    }

    /**
     * Validates required input fields
     */
    private validateRequiredFields(platform: string, profileUrl: string): boolean {
        return !!(platform && profileUrl);
    }

    /**
     * Extracts and validates handle from profile URL
     */
    private extractHandle(platform: string, profileUrl: string): string {
        try {
            const handle = URLParser.extractHandle(platform, profileUrl);
            if (!URLParser.isValidHandle(handle)) {
                throw new Error('Could not extract valid handle from the provided URL');
            }
            return handle;
        } catch (error) {
            Logger.error('Handle extraction error:', error);
            throw new Error('Invalid profile URL format for the selected platform');
        }
    }

    /**
     * Checks for duplicate influencers within organization
     */
    private async checkDuplicateInfluencer(
        organizationId: string,
        platform: string,
        handle: string
    ): Promise<boolean> {
        const existing = await InfluencerModel.findOne({
            organizationId,
            platform,
            handle,
        });
        return !!existing;
    }


    async addInfluencer(data: AddInfluencerData): Promise<void> {
        const { name, platform, profileUrl, userId, organizationId } = data;

        // Validate required fields
        if (!this.validateRequiredFields(platform, profileUrl)) {
            throw new Error('Platform and profile URL are required');
        }

        // Validate platform
        if (!this.validatePlatform(platform)) {
            throw new Error('Invalid platform.');
        }

        // Extract handle from profile URL
        const handle = this.extractHandle(platform, profileUrl);

        // Check for duplicates within the organization
        const isDuplicate = await this.checkDuplicateInfluencer(organizationId, platform, handle);
        if (isDuplicate) {
            throw new Error('This influencer is already being tracked by your organization.');
        }

        // Ensure we have a name (required field)
        if (!name) {
            throw new Error('Name is required for the influencer.');
        }

        // Create influencer with basic data (profile data will be synced in background)
        const influencer = await InfluencerModel.create({
            name,
            platform,
            handle,
            userId,
            organizationId,
            // Profile data will be populated by background sync
        });

        Logger.info(`Influencer added: ${name} (${platform})`);

        // Sync both posts and profile data in background
        const postSyncService = new PostSyncService();
        await postSyncService.initPostSync(String(influencer._id));

        // Sync profiles as well.
        const profileSyncService = new ProfileSyncService();
        await profileSyncService.initProfileSync(String(influencer._id));
    }

    async getInfluencers(organizationId: string): Promise<InfluencerResult> {
        const influencers = await InfluencerModel.find({ organizationId }).sort({
            createdAt: -1,
        });

        return {
            influencers,
            count: influencers.length,
        };
    }

    async deleteInfluencer(influencerId: string, organizationId: string): Promise<void> {
        try {
            // Find influencer within the organization
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                throw new Error('Influencer not found');
            }

            // Remove influencer.
            await InfluencerModel.deleteOne({ _id: influencerId });

            // Remove posts also of influencer.
            await PostModel.deleteMany({ influencerId: influencerId });

            Logger.info(`Influencer deleted: ${influencer.name}`);
        } catch (error) {
            Logger.error('Delete influencer error:', error);
            throw error;
        }
    }


    async isInfluencerSyncing(influencerId: string, organizationId: string): Promise<boolean> {
        try {
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                return false;
            }

            return influencer.isProfileSyncing || false;
        } catch (error) {
            Logger.error('Check sync status error:', error);
            throw error;
        }
    }

    /**
     * Syncs posts for a specific influencer
     */
    async syncPosts(influencerId: string, organizationId: string): Promise<void> {
        try {
            // Find influencer within the organization
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                throw new Error('Influencer not found');
            }

            // Check if already syncing
            if (influencer.isPostSyncing) {
                throw new Error('Posts are already being synced for this influencer');
            }

            Logger.info(`Starting post sync for ${influencer.name} (${influencer.platform})`);

            // Trigger sync in the background
            const postSyncService = new PostSyncService();
            await postSyncService.initPostSync(String(influencer._id));

            Logger.info(`Post sync started for ${influencer.name} (${influencer.platform})`);
        } catch (error) {
            Logger.error('Sync influencer posts error:', error);
            throw error;
        }
    }

    /**
     * Syncs complete data (posts and profile) for a specific influencer
     */
    async syncProfile(influencerId: string, organizationId: string): Promise<void> {
        try {
            // Find influencer within the organization
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                throw new Error('Influencer not found');
            }

            // Check if already syncing
            if (influencer.isProfileSyncing) {
                throw new Error('Data is already being synced for this influencer');
            }

            Logger.info(`Starting complete data sync for ${influencer.name} (${influencer.platform})`);

            // Trigger complete sync in the background
            const postSyncService = new ProfileSyncService();
            await postSyncService.initProfileSync(String(influencer._id));

        } catch (error) {
            Logger.error('Sync influencer data error:', error);
            throw error;
        }
    }
}
