# Backend API

Express + TypeScript backend for Influencer Tracker.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## API Documentation

See main README.md for API endpoint documentation.

## Social Media API Setup

### X (Twitter) API
1. Create a developer account at https://developer.twitter.com
2. Create a new app and get Bearer Token
3. Set `X_BEARER_TOKEN` in `.env`

### YouTube Data API
1. Go to Google Cloud Console
2. Enable YouTube Data API v3
3. Create API credentials
4. Set `YOUTUBE_API_KEY` in `.env`

### Instagram Graph API
1. Create a Facebook Developer account
2. Create an app and get Instagram Graph API access
3. Get a long-lived access token
4. Set `INSTAGRAM_ACCESS_TOKEN` in `.env`

## Background Jobs

Posts sync automatically every 3 hours. BullMQ workers are started with the main server.

