import { Router } from 'express';
import { addInfluencer, getInfluencers, deleteInfluencer, syncInfluencerPosts } from '../controllers/influencerController';
import { authenticate } from '../middleware/auth';
import { checkInfluencerLimit } from '../middleware/subscriptionLimit';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Influencer routes
router.post('/', checkInfluencerLimit, addInfluencer);
router.get('/', getInfluencers);
router.delete('/:id', deleteInfluencer);
router.post('/:id/sync', syncInfluencerPosts);

export default router;

