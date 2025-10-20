import { Request, Response } from 'express';
import { InfluencerService } from '../services/influencerService';

import { Router } from 'express';
import { checkInfluencerLimit } from '../middleware/subscriptionLimit';



export const buildRouter = () => {
    const router = Router();

    router.post('/', checkInfluencerLimit, addInfluencer);
    router.get('/', getInfluencers);
    router.delete('/:id', deleteInfluencer);
    router.post('/:id/sync', syncInfluencerPosts);

    return router;
}

const addInfluencer = async (req: Request, res: Response): Promise<void> => {
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

const getInfluencers = async (req: Request, res: Response): Promise<void> => {
    const organizationId = req.organizationId!;

    const influencerService = new InfluencerService();
    const result = await influencerService.getInfluencers(organizationId);

    res.status(result.statusCode || 500).json(
        result.success ? result.data : { error: result.error }
    );
};

const deleteInfluencer = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const organizationId = req.organizationId!;

    const influencerService = new InfluencerService();
    const result = await influencerService.deleteInfluencer(id, organizationId);

    res.status(result.statusCode || 500).json(
        result.success ? result.data : { error: result.error }
    );
};

const syncInfluencerPosts = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const organizationId = req.organizationId!;

    const influencerService = new InfluencerService();
    const result = await influencerService.syncInfluencerPosts(id, organizationId);

    res.status(result.statusCode || 500).json(
        result.success ? result.data : { error: result.error }
    );
};

