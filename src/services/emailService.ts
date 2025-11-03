import nodemailer from 'nodemailer';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

// Email transporter configuration
const createTransporter = () => {
    // Check if email config exists, otherwise use a test account
    try {
        if (EnvConfig.has('SMTP_HOST') && EnvConfig.has('SMTP_USER')) {
            return nodemailer.createTransport({
                host: EnvConfig.get('SMTP_HOST'),
                port: parseInt(EnvConfig.get('SMTP_PORT') || '587'),
                secure: EnvConfig.get('SMTP_SECURE') === 'true',
                auth: {
                    user: EnvConfig.get('SMTP_USER'),
                    pass: EnvConfig.get('SMTP_PASS'),
                },
            });
        }
    } catch (error) {
        // Config keys not found, fall through to test mode
    }
    
    // Fallback to console logging for development
    Logger.warn('Email configuration not found. Using test mode. Emails will be logged to console.');
    return {
        sendMail: async (options: any) => {
            Logger.info('=== EMAIL (TEST MODE) ===');
            Logger.info(`To: ${options.to}`);
            Logger.info(`Subject: ${options.subject}`);
            Logger.info(`Body: ${options.text || options.html}`);
            Logger.info('=======================');
            return { messageId: 'test-message-id' };
        },
    };
};

const transporter = createTransporter();

interface SendPasswordResetEmailOptions {
    email: string;
    resetToken: string;
    userName?: string;
}

export const sendPasswordResetEmail = async ({
    email,
    resetToken,
    userName,
}: SendPasswordResetEmailOptions): Promise<void> => {
    try {
            let frontendUrl = 'http://localhost:3000';
            try {
                if (EnvConfig.has('FRONTEND_URL')) {
                    frontendUrl = EnvConfig.get('FRONTEND_URL');
                }
            } catch (error) {
                // Use default
            }
        
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        let fromEmail = 'noreply@influencer-tracker.com';
        try {
            if (EnvConfig.has('SMTP_FROM')) {
                fromEmail = EnvConfig.get('SMTP_FROM');
            } else if (EnvConfig.has('SMTP_USER')) {
                fromEmail = EnvConfig.get('SMTP_USER');
            }
        } catch (error) {
            // Use default
        }

        const mailOptions = {
            from: fromEmail,
            to: email,
            subject: 'Password Reset Request - Influencer Tracker',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
                        <h1 style="color: #111827; margin-bottom: 20px;">Password Reset Request</h1>
                        
                        <p>Hello ${userName || 'there'},</p>
                        
                        <p>We received a request to reset your password for your Influencer Tracker account.</p>
                        
                        <p style="margin: 30px 0;">
                            <a href="${resetUrl}" 
                               style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                                Reset Password
                            </a>
                        </p>
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            Or copy and paste this link into your browser:<br>
                            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
                        </p>
                        
                        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                            This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        
                        <p style="color: #9ca3af; font-size: 12px;">
                            If you're having trouble clicking the button, copy and paste the URL above into your web browser.
                        </p>
                    </div>
                </body>
                </html>
            `,
            text: `
                Password Reset Request
                
                Hello ${userName || 'there'},
                
                We received a request to reset your password for your Influencer Tracker account.
                
                Click the link below to reset your password:
                ${resetUrl}
                
                This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            `,
        };

        await transporter.sendMail(mailOptions);
        Logger.info(`Password reset email sent to: ${email}`);
    } catch (error) {
        Logger.error('Error sending password reset email:', error);
        throw error;
    }
};

