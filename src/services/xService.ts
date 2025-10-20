import axios, { AxiosResponse } from 'axios';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

/**
 * X (Twitter) Service for fetching user data and posts
 * Uses Twitter API v2 for authenticated requests
 */
interface XPost {
    id: string;
    text: string;
    created_at: string;
    public_metrics: {
        like_count: number;
        retweet_count: number;
        reply_count: number;
    };
    attachments?: {
        media_keys?: string[];
    };
}

interface XUser {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
    description?: string;
    verified?: boolean;
    public_metrics?: {
        followers_count: number;
    };
}

interface XPostData {
    platformPostId: string;
    content: string;
    postUrl: string;
    likes: number;
    comments: number;
    shares: number;
    postedAt: Date;
    mediaUrls: string[];
}

export class XService {
    private readonly bearerToken: string;
    private readonly baseUrl = 'https://api.twitter.com/2';
    private readonly requestTimeout = 10000;

    constructor() {
        this.bearerToken = EnvConfig.get('X_BEARER_TOKEN');
        if (!this.bearerToken) {
            Logger.warn('X Bearer Token not configured');
        }
    }

    /**
     * Get user information by username
     * @param username - X username (without @)
     * @returns User data or null if not found
     */
    async getUserByUsername(username: string): Promise<XUser | null> {
        if (!this.bearerToken) {
            Logger.error('X Bearer Token not configured');
            return null;
        }

        try {
            const response: AxiosResponse = await axios.get(
                `${this.baseUrl}/users/by/username/${username}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.bearerToken}`,
                    },
                    params: {
                        'user.fields': 'profile_image_url,description,verified,public_metrics',
                    },
                    timeout: this.requestTimeout,
                }
            );

            return response.data.data || null;
        } catch (error: any) {
            Logger.error(`Error fetching X user ${username}:`, error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Get user information by user ID
     * @param userId - X user ID
     * @returns User data or null if not found
     */
    async getUserById(userId: string): Promise<XUser | null> {
        if (!this.bearerToken) {
            Logger.error('X Bearer Token not configured');
            return null;
        }

        try {
            const response: AxiosResponse = await axios.get(
                `${this.baseUrl}/users/${userId}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.bearerToken}`,
                    },
                    params: {
                        'user.fields': 'profile_image_url,description,verified,public_metrics',
                    },
                    timeout: this.requestTimeout,
                }
            );

            return response.data.data || null;
        } catch (error: any) {
            Logger.error(`Error fetching X user by ID ${userId}:`, error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Fetch recent tweets for a user
     * @param userId - X user ID
     * @param maxResults - Maximum number of tweets to fetch (default: 10)
     * @returns Array of formatted post data
     */
    async getUserTweets(userId: string, maxResults = 10): Promise<XPostData[]> {
        if (!this.bearerToken) {
            Logger.error('X Bearer Token not configured');
            return [];
        }

        try {
            const response: AxiosResponse = await axios.get(
                `${this.baseUrl}/users/${userId}/tweets`,
                {
                    headers: {
                        Authorization: `Bearer ${this.bearerToken}`,
                    },
                    params: {
                        max_results: maxResults,
                        'tweet.fields': 'created_at,public_metrics,attachments',
                        'media.fields': 'url,preview_image_url',
                        expansions: 'attachments.media_keys',
                    },
                    timeout: this.requestTimeout,
                }
            );

            const tweets: XPost[] = response.data.data || [];
            const mediaMap = this.buildMediaMap(response.data.includes?.media || []);

            return tweets.map((tweet: XPost) => this.formatPost(tweet, mediaMap));
        } catch (error: any) {
            Logger.error(`Error fetching X tweets for user ${userId}:`, error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Format a tweet into standardized post data
     * @param tweet - Raw tweet data from API
     * @param mediaMap - Map of media keys to URLs
     * @returns Formatted post data
     */
    private formatPost(tweet: XPost, mediaMap: Map<string, string>): XPostData {
        return {
            platformPostId: tweet.id,
            content: tweet.text,
            postUrl: `https://twitter.com/i/web/status/${tweet.id}`,
            likes: tweet.public_metrics.like_count,
            comments: tweet.public_metrics.reply_count,
            shares: tweet.public_metrics.retweet_count,
            postedAt: new Date(tweet.created_at),
            mediaUrls: this.extractMediaUrls(tweet, mediaMap),
        };
    }

    /**
     * Build a map of media keys to URLs for efficient lookup
     * @param mediaArray - Array of media objects from API response
     * @returns Map of media keys to URLs
     */
    private buildMediaMap(mediaArray: any[]): Map<string, string> {
        const map = new Map<string, string>();
        mediaArray.forEach((media: any) => {
            if (media.media_key && (media.url || media.preview_image_url)) {
                map.set(media.media_key, media.url || media.preview_image_url);
            }
        });
        return map;
    }

    /**
     * Extract media URLs from a tweet's attachments
     * @param tweet - Tweet with potential media attachments
     * @param mediaMap - Map of media keys to URLs
     * @returns Array of media URLs
     */
    private extractMediaUrls(tweet: XPost, mediaMap: Map<string, string>): string[] {
        if (!tweet.attachments?.media_keys) return [];
        return tweet.attachments.media_keys
            .map((key) => mediaMap.get(key))
            .filter((url): url is string => !!url);
    }
}
