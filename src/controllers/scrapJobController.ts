import { Request, Response, Router } from 'express';
import { ScrapJobModel } from '../models/ScrapJobModel';
import { Logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

export class ScrapJobController {
    public buildRouter(): Router {
        const router = Router();

        // Get all scrap jobs for the organization with optional status filter
        router.get('/', authenticate, this.getJobs);

        // Get scrap job by ID
        router.get('/:jobId', authenticate, this.getJobById);

        // Get scrap jobs by influencer
        router.get('/influencer/:influencerId', authenticate, this.getJobsByInfluencer);

        // Get scrap job statistics
        router.get('/stats/summary', authenticate, this.getJobStats);

        return router;
    }

    /**
     * Get all scrap jobs for the organization with optional status filter
     */
    private getJobs = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;


            const { status, limit = 50, offset = 0 } = req.query;

            // Build query object
            const query: any = { organizationId };
            if (status && status !== 'all') {
                query.status = status as string;
            }

            const jobs = await ScrapJobModel.find(query)
                .populate('influencerId', 'name handle platform')
                .populate('userId', 'name email')
                .sort({ startedAt: -1 })
                .limit(Number(limit))
                .skip(Number(offset));

            const total = await ScrapJobModel.countDocuments(query);

            res.json({
                jobs,
                total,
                limit: Number(limit),
                offset: Number(offset),
            });
        } catch (error) {
            Logger.error('Error fetching scrap jobs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };

    /**
     * Get scrap job by ID
     */
    private getJobById = async (req: Request, res: Response): Promise<void> => {
        try {
            const { jobId } = req.params;
            const organizationId = (req as any).user.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const job = await ScrapJobModel.findOne({
                jobId,
                organizationId,
            })
                .populate('influencerId', 'name handle platform')
                .populate('userId', 'name email');

            if (!job) {
                res.status(404).json({ error: 'Scrap job not found' });
                return;
            }

            res.json(job);
        } catch (error) {
            Logger.error('Error fetching scrap job:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };

    /**
     * Get scrap jobs by influencer
     */
    private getJobsByInfluencer = async (req: Request, res: Response): Promise<void> => {
        try {
            const { influencerId } = req.params;
            const organizationId = (req as any).user.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { limit = 20, offset = 0 } = req.query;

            const jobs = await ScrapJobModel.find({
                influencerId,
                organizationId,
            })
                .populate('influencerId', 'name handle platform')
                .populate('userId', 'name email')
                .sort({ startedAt: -1 })
                .limit(Number(limit))
                .skip(Number(offset));

            const total = await ScrapJobModel.countDocuments({
                influencerId,
                organizationId,
            });

            res.json({
                jobs,
                total,
                limit: Number(limit),
                offset: Number(offset),
            });
        } catch (error) {
            Logger.error('Error fetching scrap jobs by influencer:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };

    /**
     * Get scrap job statistics
     */
    private getJobStats = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).user.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const stats = await ScrapJobModel.aggregate([
                { $match: { organizationId: organizationId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]);

            const statusCounts = stats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {} as Record<string, number>);

            // Get recent activity (last 24 hours)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentActivity = await ScrapJobModel.countDocuments({
                organizationId,
                startedAt: { $gte: oneDayAgo },
            });

            res.json({
                statusCounts: {
                    pending: statusCounts.pending || 0,
                    processing: statusCounts.processing || 0,
                    completed: statusCounts.completed || 0,
                    failed: statusCounts.failed || 0,
                },
                recentActivity,
            });
        } catch (error) {
            Logger.error('Error fetching scrap job stats:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}
