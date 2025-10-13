import express from 'express';
import cors from 'cors';
// import helmet from 'helmet';
import { connectDatabase } from './config/database';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { Logger } from './utils/logger';
// import { PostSyncJob } from './jobs/postSyncJob';
import { EnvConfig } from './utils/config';
import { RedisClient } from './config/redis';


const init = async () => {


    // Load environment variables.
    await EnvConfig.init();

    // Initialize logger after config
    Logger.init();

    // Initialize Redis
    RedisClient.init();

    // Init mongodb.
    await connectDatabase();

    const app = express();
    const PORT = parseInt(EnvConfig.get('PORT'));

    // Security middleware
    // app.use(helmet());
    // app.use(cors({
    //     origin: [
    //         'http://localhost:3000',
    //         'http://localhost:3001',
    //         'http://127.0.0.1:3000',
    //         'http://127.0.0.1:3001',
    //         ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
    //     ],
    //     credentials: true,
    //     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    //     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    //     optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
    // }));
    // allow all origins in staging mode.

    const corsOptions = {
        origin: function (_origin: any, callback: any) {
            // console.log('CORS allowed for origin:', _origin);
            callback(null, true)
        },
        credentials: true
    }
    app.use(cors(corsOptions));

    // Body parsing middleware (except for Stripe webhook)
    app.use((req, res, next) => {
        if (req.originalUrl === '/api/subscription/webhook') {
            next();
        } else {
            express.json()(req, res, next);
        }
    });

    app.use(express.urlencoded({ extended: true }));

    // // Handle preflight requests explicitly
    app.options('*', (req, res) => {
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.sendStatus(200);
    });

    // API routes
    app.use('/api', routes);

    // Error handling
    app.use(errorHandler);


    // Start server
    const server = app.listen(PORT, () => {
        Logger.info(`Server running on port ${PORT}`);
        Logger.info(`Environment: ${EnvConfig.get('NODE_ENV')}`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
            Logger.error(`Port ${PORT} is already in use`);
        } else if (error.code === 'EACCES') {
            Logger.error(`Port ${PORT} requires elevated privileges`);
        } else {
            Logger.error('Server error:', error);
        }
        process.exit(1);
    });

    // Initialize background jobs
    // await PostSyncJob.init();
}

init();