import jwt, { SignOptions } from 'jsonwebtoken';
import { EnvConfig } from './config';

interface TokenPayload {
    userId: string;
    email: string;
    role: string; // Role in the current organization
    currentOrganizationId: string; // The organization context for this token
}

export const generateAccessToken = (payload: TokenPayload): string => {
    const options: SignOptions = {
        expiresIn: '15m',
    };
    return jwt.sign(payload, EnvConfig.get('JWT_ACCESS_SECRET'), options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    const options: SignOptions = {
        expiresIn: '7d',
    };
    return jwt.sign(
        payload,
        EnvConfig.get('JWT_REFRESH_SECRET'),
        options
    );
};

export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, EnvConfig.get('JWT_ACCESS_SECRET')) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
    return jwt.verify(token, EnvConfig.get('JWT_REFRESH_SECRET')) as TokenPayload;
};

