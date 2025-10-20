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

        return router;
    }

    private addInfluencer = async (req: Request, res: Response): Promise<void> => {
        const { name, platform, profileUrl } = req.body;
        const userId = req.userId!;
        const organizationId = req.organizationId!;

        const influencerService = new InfluencerService();
        const result = await influencerService.addInfluencer({
            name,
            platform,
            profileUrl,
            userId,
            organizationId,
        });

        res.status(result.statusCode || 500).json(
            result.success ? result.data : { error: result.error }
        );
    };

    private getInfluencers = async (req: Request, res: Response): Promise<void> => {
        const organizationId = req.organizationId!;

        const influencerService = new InfluencerService();
        const result = await influencerService.getInfluencers(organizationId);

        res.status(result.statusCode || 500).json(
            result.success ? result.data : { error: result.error }
        );
    };

    private deleteInfluencer = async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;
        const organizationId = req.organizationId!;

        const influencerService = new InfluencerService();
        const result = await influencerService.deleteInfluencer(id, organizationId);

        res.status(result.statusCode || 500).json(
            result.success ? result.data : { error: result.error }
        );
    };

    private syncInfluencerPosts = async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;
        const organizationId = req.organizationId!;

        const influencerService = new InfluencerService();
        const result = await influencerService.syncInfluencerPosts(id, organizationId);

        res.status(result.statusCode || 500).json(
            result.success ? result.data : { error: result.error }
        );
    }
}

