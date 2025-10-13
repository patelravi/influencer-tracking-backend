import { IUser } from '../models/UserModel';

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
            userId?: string;
            organizationId?: string;
            role?: string;
        }
    }
}

