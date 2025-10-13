import { Request, Response } from 'express';
import { InfluencerModel } from '../models/InfluencerModel';
import { PostSyncService } from '../services/postSyncService';
import { ProfileScraperService } from '../services/profileScraperService';
import { Logger } from '../utils/logger';
import { URLParser } from '../utils/urlParser';

export const addInfluencer = async (req: Request, res: Response): Promise<void> => {
    try {
        let { name, platform, profileUrl } = req.body;

        // Validate input - name is now optional, we can fetch it
        if (!platform || !profileUrl) {
            res.status(400).json({ error: 'Platform and profile URL are required' });
            return;
        }

        const validPlatforms = ['X', 'YouTube', 'Instagram', 'LinkedIn'];
        if (!validPlatforms.includes(platform)) {
            res.status(400).json({ error: 'Invalid platform' });
            return;
        }

        // Extract handle from profile URL
        let handle: string;
        try {
            handle = URLParser.extractHandle(platform, profileUrl);
            if (!URLParser.isValidHandle(handle)) {
                res.status(400).json({ error: 'Could not extract valid handle from the provided URL' });
                return;
            }
        } catch (error) {
            Logger.error('Handle extraction error:', error);
            res.status(400).json({ error: 'Invalid profile URL format for the selected platform' });
            return;
        }

        const userId = (req as any).userId;
        const organizationId = (req as any).organizationId;

        // Check for duplicates within the organization
        const existing = await InfluencerModel.findOne({
            organizationId,
            platform,
            handle,
        });

        if (existing) {
            res.status(409).json({ error: 'This influencer is already being tracked by your organization' });
            return;
        }

        // Fetch profile data from BrightData
        let profileData = null;
        try {
            const profileScraper = new ProfileScraperService();
            profileData = await profileScraper.fetchProfileData(platform as any, handle);

            if (profileData) {
                Logger.info(`Profile data fetched for ${handle}: ${JSON.stringify(profileData)}`);

                // Use fetched name if not provided by user
                if (!name && profileData.name) {
                    name = profileData.name;
                }
            }
        } catch (error) {
            Logger.warn(`Failed to fetch profile data for ${handle}, continuing with provided data:`, error);
        }

        // Ensure we have a name (either from user or from profile data)
        if (!name) {
            res.status(400).json({ error: 'Name is required (could not auto-fetch from profile)' });
            return;
        }

        // Create influencer with fetched profile data
        const influencer = await InfluencerModel.create({
            name,
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

        Logger.info(`Influencer added: ${name} (${platform})`);

        // Immediately sync posts for the new influencer (async, don't wait)
        const postSyncService = new PostSyncService();
        postSyncService.syncInfluencerPosts(String(influencer._id))
            .then((syncedCount) => {
                Logger.info(`Initial sync completed for ${name}: ${syncedCount} posts synced`);
            })
            .catch((error) => {
                Logger.error(`Initial sync failed for ${name}:`, error);
            });

        res.status(201).json({
            message: 'Influencer added successfully. Profile data fetched and posts are being synced in the background.',
            influencer,
        });
    } catch (error) {
        Logger.error('Add influencer error:', error);
        res.status(500).json({ error: 'Failed to add influencer' });
    }
};

export const getInfluencers = async (req: Request, res: Response): Promise<void> => {
    try {
        const organizationId = (req as any).organizationId;

        // Get all influencers for the organization
        const influencers = await InfluencerModel.find({ organizationId }).sort({
            createdAt: -1,
        });

        res.json({
            influencers,
            count: influencers.length,
        });
    } catch (error) {
        Logger.error('Get influencers error:', error);
        res.status(500).json({ error: 'Failed to fetch influencers' });
    }
};

export const deleteInfluencer = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const organizationId = (req as any).organizationId;

        // Find influencer within the organization
        const influencer = await InfluencerModel.findOne({
            _id: id,
            organizationId,
        });

        if (!influencer) {
            res.status(404).json({ error: 'Influencer not found' });
            return;
        }

        await InfluencerModel.deleteOne({ _id: id });

        Logger.info(`Influencer deleted: ${influencer.name}`);

        res.json({ message: 'Influencer deleted successfully' });
    } catch (error) {
        Logger.error('Delete influencer error:', error);
        res.status(500).json({ error: 'Failed to delete influencer' });
    }
};

export const syncInfluencerPosts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const organizationId = (req as any).organizationId;

        // Find influencer within the organization
        const influencer = await InfluencerModel.findOne({
            _id: id,
            organizationId,
        });

        if (!influencer) {
            res.status(404).json({ error: 'Influencer not found' });
            return;
        }

        Logger.info(`Starting post sync for ${influencer.name} (${influencer.platform})`);

        // Trigger sync in the background (don't wait)
        const postSyncService = new PostSyncService();
        postSyncService.syncInfluencerPosts(String(influencer._id))
            .then((syncedCount) => {
                Logger.info(`Sync completed for ${influencer.name}: ${syncedCount} new posts synced`);
            })
            .catch((error) => {
                Logger.error(`Sync failed for ${influencer.name}:`, error);
            });

        res.json({
            message: 'Post sync started successfully',
            influencer: {
                id: influencer._id,
                name: influencer.name,
                platform: influencer.platform,
            },
        });
    } catch (error) {
        Logger.error('Sync influencer posts error:', error);
        res.status(500).json({ error: 'Failed to sync posts' });
    }
};

