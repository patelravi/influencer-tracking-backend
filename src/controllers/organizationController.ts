import { Request, Response, Router } from 'express';
import { OrganizationModel } from '../models/OrganizationModel';
import { OrganizationMemberModel } from '../models/OrganizationMemberModel';
import { Logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

export class OrganizationController {
    public buildRouter(): Router {
        const router = Router();

        // All routes require authentication
        router.use(authenticate);

        // Get organization details
        router.get('/', this.getOrganization.bind(this));

        // Update organization name (org_admin only)
        router.put('/', this.updateOrganization.bind(this));

        // Get organization users
        router.get('/users', this.getOrganizationUsers.bind(this));

        // Update user role (org_admin only)
        router.put('/users/role', this.updateUserRole.bind(this));

        // Remove user from organization (org_admin only)
        router.delete('/users/:userId', this.removeUser.bind(this));

        return router;
    }

    // Get current user's organization details
    private getOrganization = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;

            const organization = await OrganizationModel.findById(organizationId);

            if (!organization) {
                res.status(404).json({ error: 'Organization not found' });
                return;
            }

            // Get all members of the organization
            const memberships = await OrganizationMemberModel.find({
                organizationId,
                status: 'active',
            })
                .populate('userId', 'name email')
                .populate('invitedBy', 'name email');

            const users = memberships.map((m) => {
                const user = m.userId as any;
                return {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    invitedBy: m.invitedBy,
                };
            });

            res.json({
                organization,
                users,
            });
        } catch (error) {
            Logger.error('Get organization error:', error);
            res.status(500).json({ error: 'Failed to fetch organization' });
        }
    };

    // Update organization name
    private updateOrganization = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;
            const userRole = (req as any).role;
            const { name } = req.body;

            // Only org_admin can update organization
            if (userRole !== 'org_admin') {
                res.status(403).json({ error: 'Only organization admins can update organization' });
                return;
            }

            if (!name || !name.trim()) {
                res.status(400).json({ error: 'Organization name is required' });
                return;
            }

            const organization = await OrganizationModel.findByIdAndUpdate(
                organizationId,
                { name: name.trim() },
                { new: true }
            );

            if (!organization) {
                res.status(404).json({ error: 'Organization not found' });
                return;
            }

            Logger.info(`Organization updated: ${name}`);

            res.json({
                message: 'Organization updated successfully',
                organization,
            });
        } catch (error) {
            Logger.error('Update organization error:', error);
            res.status(500).json({ error: 'Failed to update organization' });
        }
    };

    // Get all users in the organization
    private getOrganizationUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;

            const memberships = await OrganizationMemberModel.find({
                organizationId,
                status: 'active',
            })
                .populate('userId', 'name email')
                .populate('invitedBy', 'name email');

            const users = memberships.map((m) => {
                const user = m.userId as any;
                return {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    invitedBy: m.invitedBy,
                };
            });

            res.json({
                users,
                count: users.length,
            });
        } catch (error) {
            Logger.error('Get organization users error:', error);
            res.status(500).json({ error: 'Failed to fetch organization users' });
        }
    };

    // Update user role (org_admin only)
    private updateUserRole = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;
            const userRole = (req as any).role;
            const { userId, role } = req.body;

            // Only org_admin can update user roles
            if (userRole !== 'org_admin') {
                res.status(403).json({ error: 'Only organization admins can update user roles' });
                return;
            }

            if (!userId || !role) {
                res.status(400).json({ error: 'User ID and role are required' });
                return;
            }

            const validRoles = ['org_admin', 'client'];
            if (!validRoles.includes(role)) {
                res.status(400).json({ error: 'Invalid role' });
                return;
            }

            // Find the membership
            const membership = await OrganizationMemberModel.findOne({
                userId,
                organizationId,
                status: 'active',
            }).populate('userId', 'name email');

            if (!membership) {
                res.status(404).json({ error: 'User not found in this organization' });
                return;
            }

            // Update the role
            membership.role = role;
            await membership.save();

            const user = membership.userId as any;
            Logger.info(`User role updated: ${user.email} to ${role} in organization`);

            res.json({
                message: 'User role updated successfully',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: membership.role,
                },
            });
        } catch (error) {
            Logger.error('Update user role error:', error);
            res.status(500).json({ error: 'Failed to update user role' });
        }
    };

    // Remove user from organization (org_admin only)
    private removeUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;
            const userRole = (req as any).role;
            const currentUserId = (req as any).userId;
            const { userId } = req.params;

            // Only org_admin can remove users
            if (userRole !== 'org_admin') {
                res.status(403).json({ error: 'Only organization admins can remove users' });
                return;
            }

            // Cannot remove yourself
            if (userId === currentUserId) {
                res.status(400).json({ error: 'Cannot remove yourself from the organization' });
                return;
            }

            // Find the membership
            const membership = await OrganizationMemberModel.findOne({
                userId,
                organizationId,
                status: 'active',
            }).populate('userId', 'name email');

            if (!membership) {
                res.status(404).json({ error: 'User not found in this organization' });
                return;
            }

            // Remove the membership (not the user - they can still belong to other orgs)
            await OrganizationMemberModel.deleteOne({ _id: membership._id });

            const user = membership.userId as any;
            Logger.info(`User removed from organization: ${user.email}`);

            res.json({ message: 'User removed from organization successfully' });
        } catch (error) {
            Logger.error('Remove user error:', error);
            res.status(500).json({ error: 'Failed to remove user' });
        }
    }
}

