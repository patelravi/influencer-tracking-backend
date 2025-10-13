import mongoose from 'mongoose';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

export const connectDatabase = async (): Promise<void> => {
    try {
        const mongoUri = EnvConfig.get('MONGODB_URI');

        await mongoose.connect(mongoUri);

        Logger.info('MongoDB connected successfully');
    } catch (error) {
        Logger.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Handle mongoose connection events
mongoose.connection.on('disconnected', () => {
    Logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    Logger.error('MongoDB error:', err);
});

