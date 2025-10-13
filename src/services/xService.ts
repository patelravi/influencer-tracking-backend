import axios from 'axios';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

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
}

export class XService {
    private bearerToken: string;
    private baseUrl = 'https://api.twitter.com/2';

    constructor() {
        this.bearerToken = EnvConfig.get('X_BEARER_TOKEN');
    }

    // Get user ID by username
    async getUserByUsername(username: string): Promise<XUser | null> {
        try {
            const response = await axios.get(`${this.baseUrl}/users/by/username/${username}`, {
                headers: {
                    Authorization: `Bearer ${this.bearerToken}`,
                },
                params: {
                    'user.fields': 'profile_image_url',
                },
            });

            return response.data.data;
        } catch (error: any) {
            Logger.error(`Error fetching X user ${username}:`, error.response?.data || error.message);
            return null;
        }
    }

    // Fetch recent tweets for a user
    async getUserTweets(userId: string, maxResults = 10): Promise<any[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/users/${userId}/tweets`, {
                headers: {
                    Authorization: `Bearer ${this.bearerToken}`,
                },
                params: {
                    max_results: maxResults,
                    'tweet.fields': 'created_at,public_metrics,attachments',
                    'media.fields': 'url,preview_image_url',
                    expansions: 'attachments.media_keys',
                },
            });

            const tweets = response.data.data || [];
            const mediaMap = this.buildMediaMap(response.data.includes?.media || []);

            return tweets.map((tweet: XPost) => ({
                platformPostId: tweet.id,
                content: tweet.text,
                postUrl: `https://twitter.com/i/web/status/${tweet.id}`,
                likes: tweet.public_metrics.like_count,
                comments: tweet.public_metrics.reply_count,
                shares: tweet.public_metrics.retweet_count,
                postedAt: new Date(tweet.created_at),
                mediaUrls: this.extractMediaUrls(tweet, mediaMap),
            }));
        } catch (error: any) {
            Logger.error(`Error fetching X tweets for user ${userId}:`, error.response?.data || error.message);
            return [];
        }
    }

    private buildMediaMap(mediaArray: any[]): Map<string, string> {
        const map = new Map();
        mediaArray.forEach((media: any) => {
            map.set(media.media_key, media.url || media.preview_image_url);
        });
        return map;
    }

    private extractMediaUrls(tweet: XPost, mediaMap: Map<string, string>): string[] {
        if (!tweet.attachments?.media_keys) return [];
        return tweet.attachments.media_keys
            .map((key) => mediaMap.get(key))
            .filter((url): url is string => !!url);
    }
}
