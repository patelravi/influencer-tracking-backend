// import { Router } from 'express';
// import { AuthController } from '../controllers/authController';
// import { InfluencerController } from '../controllers/influencerController';
// import { PostController } from '../controllers/postController';
// import { SubscriptionController } from '../controllers/subscriptionController';
// import { OrganizationController } from '../controllers/organizationController';

// const router = Router();

// // Mount routes using controller classes
// router.use('/auth', new AuthController().buildRouter());
// router.use('/influencers', new InfluencerController().buildRouter());
// router.use('/posts', new PostController().buildRouter());
// router.use('/subscription', new SubscriptionController().buildRouter());
// router.use('/organization', new OrganizationController().buildRouter());

// // Health check
// router.get('/health', (req, res) => {
//     res.json({ status: 'ok', query: req.query.toString(), timestamp: new Date().toISOString() });
// });

// export default router;

