import { InfluencerModel } from '../models/InfluencerModel';
import { PostSyncService } from './postSyncService';
import { Logger } from '../utils/logger';
import { URLParser } from '../utils/urlParser';
import { PlatformType } from '../utils/const';
import { PostModel } from '../models/PostModel';

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


    /**
     * Adds a new influencer to the organization
     */
    async addInfluencer(data: AddInfluencerData): Promise<{
        message: string, influencer: any
    }> {
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
        postSyncService.syncInfluencerData(String(influencer._id))
            .then((result) => {
                Logger.info(`Initial sync completed for ${name}: ${result.postsSynced} posts, profile: ${result.profileSynced ? 'updated' : 'failed'}`);
            })
            .catch((error) => {
                Logger.error(`Initial sync failed for ${name}:`, error);
            });

        return {
            message: 'Influencer added successfully. Profile data and posts are being synced in the background.',
            influencer
        }
    }

    /**
     * Gets all influencers for an organization
     */
    async getInfluencers(organizationId: string): Promise<InfluencerResult> {
        const influencers = await InfluencerModel.find({ organizationId }).sort({
            createdAt: -1,
        });

        return {
            influencers,
            count: influencers.length,
        };
    }

    /**
     * Deletes an influencer from the organization
     */
    async deleteInfluencer(influencerId: string, organizationId: string): Promise<ServiceResult> {
        try {
            // Find influencer within the organization
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                return {
                    success: false,
                    error: 'Influencer not found',
                    statusCode: 404
                };
            }

            await InfluencerModel.deleteOne({ _id: influencerId });
            // remove posts also of influencer.
            await PostModel.deleteMany({ influencerId: influencerId });

            Logger.info(`Influencer deleted: ${influencer.name}`);

            return {
                success: true,
                data: {
                    message: 'Influencer deleted successfully'
                }
            };
        } catch (error) {
            Logger.error('Delete influencer error:', error);
            return {
                success: false,
                error: 'Failed to delete influencer',
                statusCode: 500
            };
        }
    }

    /**
     * Checks if an influencer is currently syncing
     */
    async isInfluencerSyncing(influencerId: string, organizationId: string): Promise<ServiceResult> {
        try {
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                return {
                    success: false,
                    error: 'Influencer not found',
                    statusCode: 404
                };
            }

            return {
                success: true,
                data: {
                    isPostSyncing: influencer.isPostSyncing || false,
                    isProfileSyncing: influencer.isProfileSyncing || false,
                    lastSyncAttempt: influencer.lastSyncAttempt,
                    lastProfileSync: influencer.lastProfileSync,
                }
            };
        } catch (error) {
            Logger.error('Check sync status error:', error);
            return {
                success: false,
                error: 'Failed to check sync status',
                statusCode: 500
            };
        }
    }

    /**
     * Syncs posts for a specific influencer
     */
    async syncInfluencerPosts(influencerId: string, organizationId: string): Promise<ServiceResult> {
        try {
            // Find influencer within the organization
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                return {
                    success: false,
                    error: 'Influencer not found',
                    statusCode: 404
                };
            }

            // Check if already syncing
            if (influencer.isPostSyncing) {
                return {
                    success: false,
                    error: 'Posts are already being synced for this influencer',
                    statusCode: 409
                };
            }

            Logger.info(`Starting post sync for ${influencer.name} (${influencer.platform})`);

            // Trigger sync in the background
            const postSyncService = new PostSyncService();
            postSyncService.syncInfluencerPosts(String(influencer._id))
                .then((syncedCount) => {
                    Logger.info(`Sync completed for ${influencer.name}: ${syncedCount} new posts synced`);
                })
                .catch((error) => {
                    Logger.error(`Sync failed for ${influencer.name}:`, error);
                });

            return {
                success: true,
                data: {
                    message: 'Post sync started successfully',
                    influencer: {
                        id: influencer._id,
                        name: influencer.name,
                        platform: influencer.platform,
                    },
                }
            };
        } catch (error) {
            Logger.error('Sync influencer posts error:', error);
            return {
                success: false,
                error: 'Failed to sync posts',
                statusCode: 500
            };
        }
    }

    /**
     * Syncs complete data (posts and profile) for a specific influencer
     */
    async syncInfluencerData(influencerId: string, organizationId: string): Promise<ServiceResult> {
        try {
            // Find influencer within the organization
            const influencer = await InfluencerModel.findOne({
                _id: influencerId,
                organizationId,
            });

            if (!influencer) {
                return {
                    success: false,
                    error: 'Influencer not found',
                    statusCode: 404
                };
            }

            // Check if already syncing
            if (influencer.isPostSyncing || influencer.isProfileSyncing) {
                return {
                    success: false,
                    error: 'Data is already being synced for this influencer',
                    statusCode: 409
                };
            }

            Logger.info(`Starting complete data sync for ${influencer.name} (${influencer.platform})`);

            // Trigger complete sync in the background
            const postSyncService = new PostSyncService();
            postSyncService.syncInfluencerData(String(influencer._id))
                .then((result) => {
                    Logger.info(`Complete sync finished for ${influencer.name}: ${result.postsSynced} posts, profile: ${result.profileSynced ? 'updated' : 'failed'}`);
                })
                .catch((error) => {
                    Logger.error(`Complete sync failed for ${influencer.name}:`, error);
                });

            return {
                success: true,
                data: {
                    message: 'Complete data sync started successfully',
                    influencer: {
                        id: influencer._id,
                        name: influencer.name,
                        platform: influencer.platform,
                    },
                }
            };
        } catch (error) {
            Logger.error('Sync influencer data error:', error);
            return {
                success: false,
                error: 'Failed to sync data',
                statusCode: 500
            };
        }
    }
}
