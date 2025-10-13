import axios from 'axios';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';

/**
 * Profile Scraper Service using Bright Data
 * 
 * Fetches influencer profile information (name, avatar, platformUserId, etc.)
 * when an influencer is added to the system.
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

export class ProfileScraperService {
    private apiToken: string;
    private webScraperUrl = 'https://api.brightdata.com/datasets/v3';

    // BrightData dataset IDs for different platforms
    private datasets = {
        LinkedIn: {
            Post: 'gd_lpl42d21kip61030r', // LinkedIn posts dataset
            LinkedInProfile: 'gd_l1viktl72bvl7bjuj0', // LinkedIn profiles dataset
        }, Instagram: 'gd_l7q7dkf244hwzny1p', // Instagram profiles dataset
        YouTube: 'gd_lwb9ubreathqo5rp', // YouTube channels dataset
        X: 'gd_lhkle8ukh1bqqrir4', // X/Twitter profiles dataset
    };

    constructor() {
        this.apiToken = EnvConfig.get('BRIGHT_DATA_API_TOKEN');
    }

    /**
     * Fetch profile data for an influencer based on platform and handle
     */
    async fetchProfileData(platform: 'LinkedIn' | 'X' | 'YouTube' | 'Instagram', handle: string): Promise<ProfileData | null> {
        try {
            if (!this.apiToken) {
                Logger.warn('Cannot fetch profile data: BrightData API token not configured');
                return null;
            }

            Logger.info(`Fetching profile data for ${platform} handle: ${handle}`);

            const profileUrl = this.buildProfileUrl(platform, handle);
            let datasetId = '';
            if (platform == 'LinkedIn') datasetId = this.datasets['LinkedIn']['Post'];
            else datasetId = this.datasets[platform];

            // Trigger scraping job
            const snapshotId = await this.triggerProfileScraping(datasetId, profileUrl, platform);

            // Poll for results
            const profileData = await this.pollScrapingJob(snapshotId);

            // Format the response based on platform
            const formattedData = this.formatProfileData(profileData, platform);

            Logger.info(`Successfully fetched profile data for ${handle} on ${platform}`);
            return formattedData;

        } catch (error: any) {
            Logger.error(`Error fetching profile data for ${handle} on ${platform}:`, error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Build profile URL from platform and handle
     */
    private buildProfileUrl(platform: string, handle: string): string {
        // Remove @ symbol if present
        const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

        switch (platform) {
            case 'LinkedIn':
                // Handle can be company URL or profile URL
                if (cleanHandle.includes('linkedin.com')) {
                    return cleanHandle;
                }
                return `https://www.linkedin.com/in/${cleanHandle}`;

            case 'Instagram':
                if (cleanHandle.includes('instagram.com')) {
                    return cleanHandle;
                }
                return `https://www.instagram.com/${cleanHandle}`;

            case 'YouTube':
                if (cleanHandle.includes('youtube.com')) {
                    return cleanHandle;
                }
                return `https://www.youtube.com/@${cleanHandle}`;

            case 'X':
                if (cleanHandle.includes('twitter.com') || cleanHandle.includes('x.com')) {
                    return cleanHandle;
                }
                return `https://x.com/${cleanHandle}`;

            default:
                return cleanHandle;
        }
    }

    /**
     * Trigger a BrightData profile scraping job
     */
    private async triggerProfileScraping(datasetId: string, profileUrl: string, platform: string): Promise<string> {
        let url: string;
        let payload: string;

        if (platform === 'LinkedIn') {
            url = `${this.webScraperUrl}/trigger?dataset_id=gd_l1viktl72bvl7bjuj0&include_errors=true`;
            payload = JSON.stringify([{ url: profileUrl }]);
        } else if (platform === 'Instagram') {
            url = `${this.webScraperUrl}/trigger?dataset_id=${datasetId}&include_errors=true&type=discover_new&discover_by=profile_url`;
            payload = JSON.stringify([profileUrl]);
        } else if (platform === 'YouTube') {
            url = `${this.webScraperUrl}/trigger?dataset_id=${datasetId}&include_errors=true&type=discover_new&discover_by=channel_url`;
            payload = JSON.stringify([profileUrl]);
        } else if (platform === 'X') {
            url = `${this.webScraperUrl}/trigger?dataset_id=${datasetId}&include_errors=true`;
            payload = JSON.stringify([profileUrl]);
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });

        const snapshotId = response.data.snapshot_id;
        Logger.info(`Profile scraping job triggered for ${platform}: ${snapshotId}`);

        return snapshotId;
    }

    /**
     * Poll for scraping job completion
     */
    private async pollScrapingJob(snapshotId: string, maxAttempts = 50): Promise<any> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await this.delay(2000); // Wait 2 seconds between polls

            try {
                const options = {
                    method: 'GET',
                    url: `${this.webScraperUrl}/snapshot/${snapshotId}?format=json`,
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`
                    }
                };


                console.info("Start: Fetching job details", JSON.stringify(options));
                const response = await axios(options);
                console.info("End: Fetching job details", response.data);

                const status = response.data.status;
                if (status === 'running') {
                    continue;
                }

                return response.data || [];

            } catch (error: any) {
                if (error.message.includes('failed with status')) {
                    throw error;
                }
                Logger.error(`Error polling job ${snapshotId}:`, error.message);
            }
        }

        throw new Error(`Profile scraping job ${snapshotId} timeout after ${maxAttempts} attempts`);
    }

    /**
     * Format profile data based on platform
     */
    private formatProfileData(data: any, platform: string): ProfileData {
        // The response is usually an array, get the first result
        const profile = Array.isArray(data) ? data[0] : data;

        if (!profile) {
            throw new Error('No profile data returned');
        }

        switch (platform) {
            case 'LinkedIn':
                return {
                    name: profile.name || profile.full_name || profile.title || '',
                    profileUrl: profile.url || profile.profile_url || profile.input_url,
                    avatarUrl: profile.avatar || profile.profile_picture || profile.image_url || profile.photo_url,
                    platformUserId: profile.profile_id || profile.user_id || profile.linkedin_id,
                    bio: profile.headline || profile.summary || profile.about,
                    followerCount: this.parseNumber(profile.followers || profile.follower_count || profile.connections),
                    verified: profile.verified || false,
                    location: profile.city || profile.location || ''
                };

            case 'Instagram':
                return {
                    name: profile.full_name || profile.name || profile.username || '',
                    avatarUrl: profile.profile_pic_url || profile.profile_picture || profile.avatar,
                    platformUserId: profile.user_id || profile.id || profile.pk,
                    bio: profile.biography || profile.bio,
                    followerCount: this.parseNumber(profile.follower_count || profile.followers),
                    verified: profile.is_verified || profile.verified || false,
                    location: '',
                    profileUrl: ''
                };

            case 'YouTube':
                return {
                    name: profile.channel_name || profile.title || profile.name || '',
                    avatarUrl: profile.thumbnail || profile.channel_thumbnail || profile.avatar,
                    platformUserId: profile.channel_id || profile.id,
                    bio: profile.description || profile.about,
                    followerCount: this.parseNumber(profile.subscriber_count || profile.subscribers),
                    verified: profile.verified || profile.is_verified || false,
                    location: '',
                    profileUrl: ''
                };

            case 'X':
                return {
                    name: profile.name || profile.display_name || profile.screen_name || '',
                    avatarUrl: profile.profile_image_url || profile.avatar || profile.profile_pic,
                    platformUserId: profile.user_id || profile.id || profile.id_str,
                    bio: profile.description || profile.bio,
                    followerCount: this.parseNumber(profile.followers_count || profile.followers),
                    verified: profile.verified || profile.is_verified || false,
                    location: '',
                    profileUrl: ''
                };

            default:
                return {
                    name: profile.name || '',
                    location: '',
                    profileUrl: ''
                };
        }
    }

    /**
     * Parse number from various formats
     */
    private parseNumber(value: any): number | undefined {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            // Handle "1.2K", "5.3M" format
            const match = value.match(/^([\d.]+)([KkMmBb])?$/);
            if (match) {
                const num = parseFloat(match[1]);
                const suffix = match[2]?.toLowerCase();

                if (suffix === 'k') return Math.round(num * 1000);
                if (suffix === 'm') return Math.round(num * 1000000);
                if (suffix === 'b') return Math.round(num * 1000000000);
                return Math.round(num);
            }
        }

        return undefined;
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

