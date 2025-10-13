import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/UserModel';
import { OrganizationModel } from '../models/OrganizationModel';
import { OrganizationMemberModel } from '../models/OrganizationMemberModel';
import { SubscriptionModel } from '../models/SubscriptionModel';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { Logger } from '../utils/logger';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password, organizationName } = req.body;

        // Validate input
        if (!name || !email || !password || !organizationName) {
            res.status(400).json({ error: 'All fields are required (name, email, password, organizationName)' });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }

        // Check if user exists
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user first
        const user = await UserModel.create({
            name,
            email,
            passwordHash,
        });

        // Create organization
        const organization = await OrganizationModel.create({
            name: organizationName.trim(),
            createdBy: user._id,
        });

        // Create membership (user is org_admin of their own organization)
        await OrganizationMemberModel.create({
            userId: user._id,
            organizationId: organization._id,
            role: 'org_admin',
            status: 'active',
        });

        // Create free subscription for the organization
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        await SubscriptionModel.create({
            organizationId: organization._id,
            plan: 'free',
            startDate: new Date(),
            endDate: oneYearFromNow,
            status: 'active',
        });

        // Generate tokens with the new organization as context
        const accessToken = generateAccessToken({
            userId: String(user._id),
            email: user.email,
            role: 'org_admin', // Their role in this organization
            currentOrganizationId: String(organization._id),
        });

        const refreshToken = generateRefreshToken({
            userId: String(user._id),
            email: user.email,
            role: 'org_admin',
            currentOrganizationId: String(organization._id),
        });

        Logger.info(`New user registered: ${email} with organization: ${organizationName}`);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            currentOrganization: {
                id: organization._id,
                name: organization.name,
                role: 'org_admin',
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        Logger.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        // Find user
        const user = await UserModel.findOne({ email });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Get user's organization memberships
        const memberships = await OrganizationMemberModel.find({
            userId: user._id,
            status: 'active',
        })
            .populate('organizationId', 'name')
            .sort({ joinedAt: -1 });

        if (memberships.length === 0) {
            res.status(403).json({ error: 'User is not a member of any organization' });
            return;
        }

        // Default to the most recently joined organization
        const defaultMembership = memberships[0];
        const defaultOrg = defaultMembership.organizationId as any;

        // Generate tokens with default organization context
        const accessToken = generateAccessToken({
            userId: String(user._id),
            email: user.email,
            role: defaultMembership.role,
            currentOrganizationId: String(defaultOrg._id),
        });

        const refreshToken = generateRefreshToken({
            userId: String(user._id),
            email: user.email,
            role: defaultMembership.role,
            currentOrganizationId: String(defaultOrg._id),
        });

        Logger.info(`User logged in: ${email}`);

        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            currentOrganization: {
                id: defaultOrg._id,
                name: defaultOrg.name,
                role: defaultMembership.role,
            },
            organizations: memberships.map((m) => {
                const org = m.organizationId as any;
                return {
                    id: org._id,
                    name: org.name,
                    role: m.role,
                };
            }),
            accessToken,
            refreshToken,
        });
    } catch (error) {
        Logger.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ error: 'Refresh token is required' });
            return;
        }

        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);

        // Generate new access token with same organization context
        const newAccessToken = generateAccessToken({
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            currentOrganizationId: decoded.currentOrganizationId,
        });

        res.json({
            accessToken: newAccessToken,
        });
    } catch (error) {
        Logger.error('Token refresh error:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

export const switchOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.body;
        const userId = (req as any).userId;

        if (!organizationId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        // Verify user is a member of the target organization
        const membership = await OrganizationMemberModel.findOne({
            userId,
            organizationId,
            status: 'active',
        }).populate('organizationId', 'name');

        if (!membership) {
            res.status(403).json({ error: 'You are not a member of this organization' });
            return;
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const org = membership.organizationId as any;

        // Generate new tokens with the new organization context
        const accessToken = generateAccessToken({
            userId: String(user._id),
            email: user.email,
            role: membership.role,
            currentOrganizationId: String(org._id),
        });

        const refreshToken = generateRefreshToken({
            userId: String(user._id),
            email: user.email,
            role: membership.role,
            currentOrganizationId: String(org._id),
        });

        Logger.info(`User ${user.email} switched to organization ${org.name}`);

        res.json({
            message: 'Organization switched successfully',
            currentOrganization: {
                id: org._id,
                name: org.name,
                role: membership.role,
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        Logger.error('Switch organization error:', error);
        res.status(500).json({ error: 'Failed to switch organization' });
    }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        const user = await UserModel.findOne({ email });

        // Always return success to prevent email enumeration
        res.json({
            message: 'If the email exists, a password reset link has been sent',
        });

        if (!user) {
            return;
        }

        // TODO: Generate password reset token and send email
        // For now, just log it
        Logger.info(`Password reset requested for: ${email}`);
    } catch (error) {
        Logger.error('Forgot password error:', error);
        res.status(500).json({ error: 'Password reset request failed' });
    }
};

