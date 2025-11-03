/**
 * Common data structures for scrapers
 */

export interface ProfileData {
    name: string;
    avatarUrl?: string;
    platformUserId?: string;
    bio?: string;
    followerCount?: number;
    verified?: boolean;
    location?: string;
    profileUrl: string;
}

export interface PostData {
    platformPostId: string;
    content: string;
    postUrl: string;
    likes: number;
    comments: number;
    shares: number;
    postedAt: number; // Epoch timestamp in milliseconds
    mediaUrls: string[];
}

/**
 * Interface for platform scrapers
 * Provides a common contract for scraping profiles and posts from different social media platforms
 */
export interface IScraper {
    /**
     * Scrape profile information from a social media platform
     * @param handle - The platform handle/username to scrape
     * @param jobContext - Optional context for creating scrap job entries
     * @returns Nothing.
     */
    initScrapProfile(handle: string, jobContext: ScrapJobContext): Promise<void>;

    /**
     * Scrape posts from a social media platform
     * @param handle - The platform handle/username to scrape posts from
     * @param limit - Maximum number of posts to scrape (default: 20)
     * @param jobContext - Optional context for creating scrap job entries
     * @returns Nothing.
     */
    initScrapPosts(handle: string, jobContext: ScrapJobContext): Promise<void>;

    parseProfileData(payload: any): ProfileData;

    parsePostData(payload: any): PostData;
}

/**
 * Context for creating scrap job entries
 */
export interface ScrapJobContext {
    organizationId: string;
    userId: string;
    influencerId?: string;
    jobType: 'profile' | 'posts';
}
