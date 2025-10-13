import { Router } from 'express';
import {
    getOrganization,
    updateOrganization,
    getOrganizationUsers,
    updateUserRole,
    removeUser,
} from '../controllers/organizationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get organization details
router.get('/', getOrganization);

// Update organization name (org_admin only)
router.put('/', updateOrganization);

// Get organization users
router.get('/users', getOrganizationUsers);

// Update user role (org_admin only)
router.put('/users/role', updateUserRole);

// Remove user from organization (org_admin only)
router.delete('/users/:userId', removeUser);

export default router;

