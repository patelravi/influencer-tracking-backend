import { Router } from 'express';
import { register, login, refresh, forgotPassword, switchOrganization } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);

// Protected routes (require authentication)
router.post('/switch-organization', authenticate, switchOrganization);

export default router;

