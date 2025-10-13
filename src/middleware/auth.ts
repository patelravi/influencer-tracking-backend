import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UserModel } from '../models/UserModel';
import { OrganizationMemberModel } from '../models/OrganizationMemberModel';
import { Logger } from '../utils/logger';

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.substring(7);
        const decoded = verifyAccessToken(token);

        // Fetch user from database
        const user = await UserModel.findById(decoded.userId);

        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        // Verify membership in the current organization from token
        const membership = await OrganizationMemberModel.findOne({
            userId: user._id,
            organizationId: decoded.currentOrganizationId,
            status: 'active',
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        // Attach user info and organization context to request
        (req as any).user = user;
        (req as any).userId = String(user._id);
        (req as any).organizationId = String(decoded.currentOrganizationId);
        (req as any).role = decoded.role; // Role from token (which is role in current org)

        next();
    } catch (error) {
        Logger.error('Authentication error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if ((req as any).user?.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};

// Middleware to require organization admin role
export const requireOrgAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as any).role;
    if (role !== 'org_admin') {
        res.status(403).json({ error: 'Organization admin access required' });
        return;
    }
    next();
};

