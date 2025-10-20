# Scrapers Module

This module provides a unified interface for scraping data from different social media platforms. It implements the **Strategy Pattern** to abstract platform-specific scraping logic behind a common interface.

## Architecture

### Core Components

1. **IScraper Interface** - Defines the contract for all scrapers
2. **Platform-Specific Scrapers** - Implement the IScraper interface for each platform
3. **ScraperFactory** - Factory class to create appropriate scraper instances

### Supported Platforms

- **LinkedIn** - Uses Bright Data Web Scraper API
- **X (Twitter)** - Uses Twitter API v2

## Usage

### Basic Usage

```typescript
import { ScraperFactory } from './scrapers';

// Get a scraper for LinkedIn
const linkedInScraper = ScraperFactory.getScraper('LinkedIn');

// Scrape profile data
const profileData = await linkedInScraper.scrapProfile('john-doe');

// Scrape posts
const posts = await linkedInScraper.scrapPosts('john-doe', 20);
```

### Using in Services

The existing services (ProfileScraperService, PostSyncService, ProfileSyncService) have been updated to use this interface:

```typescript
// ProfileScraperService now uses the factory
const scraper = ScraperFactory.getScraper(platform);
const profileData = await scraper.scrapProfile(handle);

// PostSyncService now uses the factory
const scraper = ScraperFactory.getScraper(influencer.platform);
const posts = await scraper.scrapPosts(influencer.handle, 20);
```

## Data Structures

### ProfileData Interface

```typescript
interface ProfileData {
  name: string;
  avatarUrl?: string;
  platformUserId?: string;
  bio?: string;
  followerCount?: number;
  verified?: boolean;
  location?: string;
  profileUrl: string;
}
```

### PostData Interface

```typescript
interface PostData {
  platformPostId: string;
  content: string;
  postUrl: string;
  likes: number;
  comments: number;
  shares: number;
  postedAt: Date;
  mediaUrls: string[];
}
```

## Adding New Platforms

To add support for a new platform:

1. Create a new scraper class that implements `IScraper`
2. Add the platform to the `ScraperFactory`
3. Update the `PlatformType` enum if needed

Example:

```typescript
export class InstagramScraper implements IScraper {
    async scrapProfile(handle: string): Promise<ProfileData | null> {
        // Implementation
    }

    async scrapPosts(handle: string, limit = 20): Promise<PostData[]> {
        // Implementation
    }
}

// In ScraperFactory
case PlatformType.Instagram:
    scraper = new InstagramScraper();
    break;
```

## Benefits

1. **Unified Interface** - All platforms use the same methods
2. **Easy Testing** - Mock the IScraper interface for unit tests
3. **Extensibility** - Easy to add new platforms
4. **Maintainability** - Platform-specific logic is isolated
5. **Type Safety** - Full TypeScript support with proper typing

## Migration Notes

The old platform-specific services (LinkedInScraperService, XService) are still available but deprecated. The new system provides:

- Better abstraction
- Consistent error handling
- Unified data structures
- Easier testing and mocking
- Better separation of concerns
