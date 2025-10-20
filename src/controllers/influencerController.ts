import { Request, Response, Router } from 'express';
import { InfluencerService } from '../services/influencerService';
import { checkInfluencerLimit } from '../middleware/subscriptionLimit';

export class InfluencerController {
    public buildRouter(): Router {
        const router = Router();

        router.post('/', checkInfluencerLimit, this.addInfluencer.bind(this));
        router.get('/', this.getInfluencers.bind(this));
        router.delete('/:id', this.deleteInfluencer.bind(this));
        router.post('/:id/sync', this.syncInfluencerPosts.bind(this));
        router.post('/:id/sync-data', this.syncInfluencerData.bind(this));
        router.get('/:id/sync-status', this.getSyncStatus.bind(this));

        return router;
    }

    private addInfluencer = async (req: Request, res: Response): Promise<void> => {
        try {
            const { name, platform, profileUrl } = req.body;
            const userId = (req as any).userId!;
            const organizationId = (req as any).organizationId!;

            const influencerService = new InfluencerService();
            const result = await influencerService.addInfluencer({
                name,
                platform,
                profileUrl,
                userId,
                organizationId,
            });

            res.status(201).json(result);
        } catch (error) {
            console.error('Add influencer error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add influencer' });
        }
    };

    private getInfluencers = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId!;

            const influencerService = new InfluencerService();
            const result = await influencerService.getInfluencers(organizationId);

            res.json(result);
        } catch (error) {
            console.error('Get influencers error:', error);
            res.status(500).json({ error: 'Failed to fetch influencers' });
        }
    };

    private deleteInfluencer = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const organizationId = (req as any).organizationId!;

            const influencerService = new InfluencerService();
            const result = await influencerService.deleteInfluencer(id, organizationId);

            res.status(result.statusCode || 500).json(
                result.success ? result.data : { error: result.error }
            );
        } catch (error) {
            console.error('Delete influencer error:', error);
            res.status(500).json({ error: 'Failed to delete influencer' });
        }
    };

    private syncInfluencerPosts = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const organizationId = (req as any).organizationId!;

            const influencerService = new InfluencerService();
            const result = await influencerService.syncInfluencerPosts(id, organizationId);

            res.status(result.statusCode || 500).json(
                result.success ? result.data : { error: result.error }
            );
        } catch (error) {
            console.error('Sync influencer posts error:', error);
            res.status(500).json({ error: 'Failed to sync posts' });
        }
    };

    private syncInfluencerData = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const organizationId = (req as any).organizationId!;

            const influencerService = new InfluencerService();
            const result = await influencerService.syncInfluencerData(id, organizationId);

            res.status(result.statusCode || 500).json(
                result.success ? result.data : { error: result.error }
            );
        } catch (error) {
            console.error('Sync influencer data error:', error);
            res.status(500).json({ error: 'Failed to sync data' });
        }
    };

    private getSyncStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const organizationId = (req as any).organizationId!;

            const influencerService = new InfluencerService();
            const result = await influencerService.isInfluencerSyncing(id, organizationId);

            res.status(result.statusCode || 500).json(
                result.success ? result.data : { error: result.error }
            );
        } catch (error) {
            console.error('Get sync status error:', error);
            res.status(500).json({ error: 'Failed to get sync status' });
        }
    };
}

