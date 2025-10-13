import { Router } from 'express';
import { getPosts, getAnalytics, syncPosts } from '../controllers/postController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Post routes
router.get('/', getPosts);
router.get('/analytics', getAnalytics);

// Sync posts manually (for any authenticated user)
router.post('/sync', syncPosts);

export default router;

