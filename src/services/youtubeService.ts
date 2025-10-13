import axios from 'axios';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

interface YouTubeChannel {
    id: string;
    snippet: {
        title: string;
        thumbnails: {
            default: { url: string };
        };
    };
}

interface YouTubeVideo {
    id: string;
    snippet: {
        publishedAt: string;
        title: string;
        description: string;
        thumbnails: {
            high: { url: string };
        };
    };
    statistics: {
        viewCount: string;
        likeCount: string;
        commentCount: string;
    };
}

export class YouTubeService {
    private apiKey: string;
    private baseUrl = 'https://www.googleapis.com/youtube/v3';

    constructor() {
        this.apiKey = EnvConfig.get('YOUTUBE_API_KEY');
    }

    // Get channel by handle or username
    async getChannelByHandle(handle: string): Promise<YouTubeChannel | null> {
        try {
            // Try by custom URL/handle
            let response = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'snippet',
                    forHandle: handle,
                    key: this.apiKey,
                },
            });

            if (response.data.items && response.data.items.length > 0) {
                return response.data.items[0];
            }

            // Try by username (legacy)
            response = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'snippet',
                    forUsername: handle,
                    key: this.apiKey,
                },
            });

            return response.data.items?.[0] || null;
        } catch (error: any) {
            Logger.error(`Error fetching YouTube channel ${handle}:`, error.response?.data || error.message);
            return null;
        }
    }

    // Fetch recent videos for a channel
    async getChannelVideos(channelId: string, maxResults = 10): Promise<any[]> {
        try {
            // First, get the uploads playlist ID
            const channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'contentDetails',
                    id: channelId,
                    key: this.apiKey,
                },
            });

            const uploadsPlaylistId =
                channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

            if (!uploadsPlaylistId) {
                Logger.warn(`No uploads playlist found for channel ${channelId}`);
                return [];
            }

            // Get videos from uploads playlist
            const playlistResponse = await axios.get(`${this.baseUrl}/playlistItems`, {
                params: {
                    part: 'snippet',
                    playlistId: uploadsPlaylistId,
                    maxResults,
                    key: this.apiKey,
                },
            });

            const videoIds = playlistResponse.data.items
                .map((item: any) => item.snippet.resourceId.videoId)
                .join(',');

            if (!videoIds) return [];

            // Get detailed video statistics
            const videosResponse = await axios.get(`${this.baseUrl}/videos`, {
                params: {
                    part: 'snippet,statistics',
                    id: videoIds,
                    key: this.apiKey,
                },
            });

            return (videosResponse.data.items || []).map((video: YouTubeVideo) => ({
                platformPostId: video.id,
                content: `${video.snippet.title}\n\n${video.snippet.description.substring(0, 300)}`,
                postUrl: `https://www.youtube.com/watch?v=${video.id}`,
                likes: parseInt(video.statistics.likeCount || '0'),
                comments: parseInt(video.statistics.commentCount || '0'),
                shares: 0, // YouTube doesn't provide share count via API
                postedAt: new Date(video.snippet.publishedAt),
                mediaUrls: [video.snippet.thumbnails.high.url],
            }));
        } catch (error: any) {
            Logger.error(`Error fetching YouTube videos for channel ${channelId}:`, error.response?.data || error.message);
            return [];
        }
    }
}
