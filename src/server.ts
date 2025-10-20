import express, { Router } from 'express';
import cors from 'cors';
// import helmet from 'helmet';
import { connectDatabase } from './config/database';
// import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { Logger } from './utils/logger';
// import { PostSyncJob } from './jobs/postSyncJob';
import { EnvConfig } from './utils/config';
import { RedisClient } from './config/redis';
import { AuthController } from './controllers/authController';
import { PostController } from './controllers/postController';
import { InfluencerController } from './controllers/influencerController';
import { SubscriptionController } from './controllers/subscriptionController';
import { OrganizationController } from './controllers/organizationController';


class Server {
    private app: express.Application;
    private server?: import('http').Server;
    private PORT: number;

    constructor() {
        this.app = express();
        this.PORT = 0;
    }

    public async init() {
        // Load environment variables.
        await EnvConfig.init();

        // Initialize logger after config
        Logger.init();

        // Initialize Redis
        RedisClient.init();

        // Init mongodb.
        await connectDatabase();

        this.PORT = parseInt(EnvConfig.get('PORT'));

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandler();
        this.startServer();
    }

    private setupMiddleware() {
        // Security middleware
        // this.app.use(helmet());
        // this.app.use(cors({
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
        //     optionsSuccessStatus: 200,
        // }));
        // allow all origins in staging mode.

        const corsOptions = {
            origin: function (_origin: any, callback: any) {
                // console.log('CORS allowed for origin:', _origin);
                callback(null, true);
            },
            credentials: true
        };
        this.app.use(cors(corsOptions));

        // Body parsing middleware (except for Stripe webhook)
        this.app.use((req, res, next) => {
            if (req.originalUrl === '/api/subscription/webhook') {
                next();
            } else {
                express.json()(req, res, next);
            }
        });

        this.app.use(express.urlencoded({ extended: true }));

        // Handle preflight requests explicitly
        this.app.options('*', (req, res) => {
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
            res.header('Access-Control-Allow-Credentials', 'true');
            res.sendStatus(200);
        });
    }

    private setupRoutes() {

        const routes = Router();

        // Mount routes using controller classes
        routes.use('/auth', new AuthController().buildRouter());
        routes.use('/influencers', new InfluencerController().buildRouter());
        routes.use('/posts', new PostController().buildRouter());
        routes.use('/subscription', new SubscriptionController().buildRouter());
        routes.use('/organization', new OrganizationController().buildRouter());

        // Health check
        routes.get('/health', (req, res) => {
            res.json({ status: 'ok', query: req.query.toString(), timestamp: new Date().toISOString() });
        });

        this.app.use('/api', routes);
    }

    private setupErrorHandler() {
        this.app.use(errorHandler);
    }

    private startServer() {
        this.server = this.app.listen(this.PORT, () => {
            Logger.info(`Server running on port ${this.PORT}`);
            Logger.info(`Environment: ${EnvConfig.get('NODE_ENV')}`);
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
                Logger.error(`Port ${this.PORT} is already in use`);
            } else if (error.code === 'EACCES') {
                Logger.error(`Port ${this.PORT} requires elevated privileges`);
            } else {
                Logger.error('Server error:', error);
            }
            process.exit(1);
        });

    }
}

const server = new Server();
server.init();