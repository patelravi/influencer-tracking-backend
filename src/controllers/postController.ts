import { Request, Response, Router } from 'express';
import { PostModel } from '../models/PostModel';
import { InfluencerModel } from '../models/InfluencerModel';
import { PostSyncService } from '../services/postSyncService';
import { Logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

export class PostController {
    public buildRouter(): Router {
        const router = Router();

        // All routes require authentication
        router.use(authenticate);

        // Post routes
        router.get('/', this.getPosts.bind(this));
        router.get('/analytics', this.getAnalytics.bind(this));

        // Sync posts manually (for any authenticated user)
        router.post('/sync', this.syncPosts.bind(this));

        return router;
    }

    private getPosts = async (req: Request, res: Response): Promise<void> => {
        try {
            const { influencerId, platform, startDate, endDate, limit = '50', page = '1' } = req.query;
            const organizationId = (req as any).organizationId;

            // Get organization's influencers
            const orgInfluencers = await InfluencerModel.find({ organizationId });
            const influencerIds = orgInfluencers.map((inf) => inf._id);

            // Build query
            const query: any = {
                influencerId: { $in: influencerIds },
            };

            if (influencerId) {
                query.influencerId = influencerId;
            }

            if (platform) {
                const platformInfluencers = orgInfluencers
                    .filter((inf) => inf.platform === platform)
                    .map((inf) => inf._id);
                query.influencerId = { $in: platformInfluencers };
            }

            if (startDate || endDate) {
                query.postedAt = {};
                if (startDate) query.postedAt.$gte = new Date(startDate as string);
                if (endDate) query.postedAt.$lte = new Date(endDate as string);
            }

            const pageNum = parseInt(page as string);
            const limitNum = parseInt(limit as string);
            const skip = (pageNum - 1) * limitNum;

            // Fetch posts
            const posts = await PostModel.find(query)
                .populate('influencerId', 'name platform handle avatarUrl')
                .sort({ postedAt: -1 })
                .limit(limitNum)
                .skip(skip);

            const totalCount = await PostModel.countDocuments(query);

            res.json({
                posts,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limitNum),
                },
            });
        } catch (error) {
            Logger.error('Get posts error:', error);
            res.status(500).json({ error: 'Failed to fetch posts' });
        }
    };

    // Manual sync endpoint to sync posts for a specific influencer or all
    private syncPosts = async (req: Request, res: Response): Promise<void> => {
        try {
            const { influencerId } = req.body;
            const organizationId = (req as any).organizationId;
            const postSyncService = new PostSyncService();

            if (influencerId) {
                // Verify influencer belongs to user's organization
                const influencer = await InfluencerModel.findOne({
                    _id: influencerId,
                    organizationId,
                });

                if (!influencer) {
                    res.status(404).json({ error: 'Influencer not found' });
                    return;
                }

                // Sync single influencer
                const count = await postSyncService.syncInfluencerPosts(influencerId);
                Logger.info(`Synced ${count} posts for influencer ${influencerId}`);

                res.json({
                    message: 'Sync completed',
                    postsSynced: count,
                });
            } else {
                // Sync all influencers in the organization
                const influencers = await InfluencerModel.find({ organizationId });
                let totalSynced = 0;

                for (const influencer of influencers) {
                    const count = await postSyncService.syncInfluencerPosts(String(influencer._id));
                    totalSynced += count;
                }

                Logger.info(`Synced ${totalSynced} posts for organization ${organizationId}`);

                res.json({
                    message: 'Sync completed',
                    postsSynced: totalSynced,
                    influencerCount: influencers.length,
                });
            }
        } catch (error) {
            Logger.error('Sync posts error:', error);
            res.status(500).json({ error: 'Failed to sync posts' });
        }
    };

    private getAnalytics = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;

            // Get organization's influencers
            const orgInfluencers = await InfluencerModel.find({ organizationId });
            const influencerIds = orgInfluencers.map((inf) => inf._id);

            if (influencerIds.length === 0) {
                res.json({
                    totalPosts: 0,
                    averageEngagement: 0,
                    totalLikes: 0,
                    totalComments: 0,
                    totalShares: 0,
                });
                return;
            }

            // Aggregate analytics
            const analytics = await PostModel.aggregate([
                {
                    $match: {
                        influencerId: { $in: influencerIds },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalPosts: { $sum: 1 },
                        totalLikes: { $sum: '$likes' },
                        totalComments: { $sum: '$comments' },
                        totalShares: { $sum: '$shares' },
                    },
                },
            ]);

            if (analytics.length === 0) {
                res.json({
                    totalPosts: 0,
                    averageEngagement: 0,
                    totalLikes: 0,
                    totalComments: 0,
                    totalShares: 0,
                });
                return;
            }

            const data = analytics[0];
            const averageEngagement =
                data.totalPosts > 0
                    ? ((data.totalLikes + data.totalComments + data.totalShares) / data.totalPosts).toFixed(2)
                    : 0;

            res.json({
                totalPosts: data.totalPosts,
                averageEngagement: parseFloat(averageEngagement.toString()),
                totalLikes: data.totalLikes,
                totalComments: data.totalComments,
                totalShares: data.totalShares,
            });
        } catch (error) {
            Logger.error('Get analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    }
}

