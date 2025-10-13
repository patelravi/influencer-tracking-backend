import axios from 'axios';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

interface InstagramMedia {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    permalink: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
}

export class InstagramService {
    private accessToken: string;
    private baseUrl = 'https://graph.instagram.com';

    constructor() {
        this.accessToken = EnvConfig.get('INSTAGRAM_ACCESS_TOKEN');
    }

    // Get Instagram user by username
    // Note: This requires Instagram Business or Creator account
    async getUserByUsername(username: string): Promise<any | null> {
        try {
            // Instagram Graph API requires user ID, not username
            // This is a placeholder - in production, you'd need to maintain a mapping
            Logger.warn('Instagram Graph API requires user ID. Username lookup not directly supported.');
            return null;
        } catch (error: any) {
            Logger.error(`Error fetching Instagram user ${username}:`, error.response?.data || error.message);
            return null;
        }
    }

    // Fetch recent media for an Instagram Business/Creator account
    async getUserMedia(userId: string, limit = 10): Promise<any[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/${userId}/media`, {
                params: {
                    fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
                    limit,
                    access_token: this.accessToken,
                },
            });

            return (response.data.data || []).map((media: InstagramMedia) => ({
                platformPostId: media.id,
                content: media.caption || '',
                postUrl: media.permalink,
                likes: media.like_count || 0,
                comments: media.comments_count || 0,
                shares: 0, // Instagram doesn't provide share count
                postedAt: new Date(media.timestamp),
                mediaUrls: [media.media_url],
            }));
        } catch (error: any) {
            Logger.error(`Error fetching Instagram media for user ${userId}:`, error.response?.data || error.message);
            return [];
        }
    }
}