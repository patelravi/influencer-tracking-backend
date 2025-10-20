import { InfluencerModel } from '../models/InfluencerModel';
import { PostSyncService } from './postSyncService';
import { ProfileScraperService } from './profileScraperService';
import { Logger } from '../utils/logger';
import { URLParser } from '../utils/urlParser';

export interface AddInfluencerData {
    name?: string;
    platform: string;
    profileUrl: string;
    userId: string;
    organizationId: string;
}

export interface InfluencerResult {
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
}

export class InfluencerService {
    private readonly validPlatforms = Object.values(Platform);

    /**
     * Validates platform input
     */
    private validatePlatform(platform: string): boolean {
        return this.validPlatforms.includes(platform);
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
     * Fetches profile data from external service
     */
    private async fetchProfileData(platform: string, handle: string): Promise<any> {
        try {
            const profileScraper = new ProfileScraperService();
            const profileData = await profileScraper.fetchProfileData(platform as any, handle);

            if (profileData) {
                Logger.info(`Profile data fetched for ${handle}: ${JSON.stringify(profileData)}`);
            }

            return profileData;
        } catch (error) {
            Logger.warn(`Failed to fetch profile data for ${handle}, continuing with provided data:`, error);
            return null;
        }
    }

    /**
     * Triggers initial post sync for new influencer
     */
    private async triggerInitialSync(influencerId: string, name: string): Promise<void> {
        const postSyncService = new PostSyncService();
        postSyncService.syncInfluencerPosts(influencerId)
            .then((syncedCount) => {
                Logger.info(`Initial sync completed for ${name}: ${syncedCount} posts synced`);
            })
            .catch((error) => {
                Logger.error(`Initial sync failed for ${name}:`, error);
            });
    }

    /**
     * Adds a new influencer to the organization
     */
    async addInfluencer(data: AddInfluencerData): Promise<InfluencerResult> {
        try {
            const { name, platform, profileUrl, userId, organizationId } = data;

            // Validate required fields
            if (!this.validateRequiredFields(platform, profileUrl)) {
                return {
                    success: false,
                    error: 'Platform and profile URL are required',
                    statusCode: 400
                };
            }

            // Validate platform
            if (!this.validatePlatform(platform)) {
                return {
                    success: false,
                    error: 'Invalid platform',
                    statusCode: 400
                };
            }

            // Extract handle from profile URL
            const handle = this.extractHandle(platform, profileUrl);

            // Check for duplicates within the organization
            const isDuplicate = await this.checkDuplicateInfluencer(organizationId, platform, handle);
            if (isDuplicate) {
                return {
                    success: false,
                    error: 'This influencer is already being tracked by your organization',
                    statusCode: 409
                };
            }

            // Fetch profile data from external service
            const profileData = await this.fetchProfileData(platform, handle);

            // Determine final name (use fetched name if not provided by user)
            let finalName = name;
            if (!finalName && profileData?.name) {
                finalName = profileData.name;
            }

            // Ensure we have a name
            if (!finalName) {
                return {
                    success: false,
                    error: 'Name is required (could not auto-fetch from profile)',
                    statusCode: 400
                };
            }

            // Create influencer with fetched profile data
            const influencer = await InfluencerModel.create({
                name: finalName,
                platform,
                handle,
                userId,
                organizationId,
                platformUserId: profileData?.platformUserId,
                avatarUrl: profileData?.avatarUrl,
                bio: profileData?.bio,
                followerCount: profileData?.followerCount,
                verified: profileData?.verified,
            });

            Logger.info(`Influencer added: ${finalName} (${platform})`);

            // Trigger initial post sync
            await this.triggerInitialSync(String(influencer._id), finalName);

            return {
                success: true,
                data: {
                    message: 'Influencer added successfully. Profile data fetched and posts are being synced in the background.',
                    influencer
                }
            };
        } catch (error) {
            Logger.error('Add influencer error:', error);
            return {
                success: false,
                error: 'Failed to add influencer',
                statusCode: 500
            };
        }
    }

    /**
     * Gets all influencers for an organization
     */
    async getInfluencers(organizationId: string): Promise<InfluencerResult> {
        try {
            const influencers = await InfluencerModel.find({ organizationId }).sort({
                createdAt: -1,
            });

            return {
                success: true,
                data: {
                    influencers,
                    count: influencers.length,
                }
            };
        } catch (error) {
            Logger.error('Get influencers error:', error);
            return {
                success: false,
                error: 'Failed to fetch influencers',
                statusCode: 500
            };
        }
    }

    /**
     * Deletes an influencer from the organization
     */
    async deleteInfluencer(influencerId: string, organizationId: string): Promise<InfluencerResult> {
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
     * Syncs posts for a specific influencer
     */
    async syncInfluencerPosts(influencerId: string, organizationId: string): Promise<InfluencerResult> {
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
}
