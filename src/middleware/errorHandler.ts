import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
): void => {
    Logger.error('Error:', err, req.params, next.name);

    res.status(500).json({
        error: 'Internal server error',
        message: EnvConfig.get('NODE_ENV') === 'development' ? err.message : undefined,
    });
};

