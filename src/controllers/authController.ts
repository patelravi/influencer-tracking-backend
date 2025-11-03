import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserModel } from '../models/UserModel';
import { OrganizationModel } from '../models/OrganizationModel';
import { OrganizationMemberModel } from '../models/OrganizationMemberModel';
import { SubscriptionModel } from '../models/SubscriptionModel';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { Logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/emailService';

export class AuthController {
    public buildRouter(): Router {
        const router = Router();

        // Public auth routes
        router.post('/register', this.register.bind(this));
        router.post('/login', this.login.bind(this));
        router.post('/refresh', this.refresh.bind(this));
        router.post('/forgot-password', this.forgotPassword.bind(this));
        router.post('/reset-password', this.resetPassword.bind(this));

        // Protected routes (require authentication)
        router.post('/switch-organization', authenticate, this.switchOrganization.bind(this));

        return router;
    }

    private register = async (req: Request, res: Response): Promise<void> => {
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

    private login = async (req: Request, res: Response): Promise<void> => {
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

    private refresh = async (req: Request, res: Response): Promise<void> => {
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

    private switchOrganization = async (req: Request, res: Response): Promise<void> => {
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

    private forgotPassword = async (req: Request, res: Response): Promise<void> => {
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

            // Generate password reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
            
            // Set token expiration (1 hour from now)
            const resetExpires = new Date();
            resetExpires.setHours(resetExpires.getHours() + 1);

            // Save token to user
            user.passwordResetToken = resetTokenHash;
            user.passwordResetExpires = resetExpires;
            await user.save();

            // Send password reset email
            try {
                await sendPasswordResetEmail({
                    email: user.email,
                    resetToken,
                    userName: user.name,
                });
                Logger.info(`Password reset email sent to: ${email}`);
            } catch (emailError) {
                Logger.error('Failed to send password reset email:', emailError);
                // Don't throw error here - we already returned success to prevent enumeration
            }
        } catch (error) {
            Logger.error('Forgot password error:', error);
            res.status(500).json({ error: 'Password reset request failed' });
        }
    };

    private resetPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const { token, password } = req.body;

            if (!token || !password) {
                res.status(400).json({ error: 'Token and password are required' });
                return;
            }

            if (password.length < 6) {
                res.status(400).json({ error: 'Password must be at least 6 characters' });
                return;
            }

            // Hash the token to compare with stored token
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

            // Find user with valid reset token
            const user = await UserModel.findOne({
                passwordResetToken: tokenHash,
                passwordResetExpires: { $gt: new Date() },
            });

            if (!user) {
                res.status(400).json({ error: 'Invalid or expired reset token' });
                return;
            }

            // Hash new password
            const passwordHash = await bcrypt.hash(password, 10);

            // Update user password and clear reset token
            user.passwordHash = passwordHash;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            Logger.info(`Password reset successful for user: ${user.email}`);

            res.json({
                message: 'Password reset successful',
            });
        } catch (error) {
            Logger.error('Reset password error:', error);
            res.status(500).json({ error: 'Password reset failed' });
        }
    }
}

