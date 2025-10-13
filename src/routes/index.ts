import { Router } from 'express';
import authRoutes from './authRoutes';
import influencerRoutes from './influencerRoutes';
import postRoutes from './postRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import organizationRoutes from './organizationRoutes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/influencers', influencerRoutes);
router.use('/posts', postRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/organization', organizationRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', query: req.query.toString(), timestamp: new Date().toISOString() });
});

export default router;

