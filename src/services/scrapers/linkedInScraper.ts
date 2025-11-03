import axios from 'axios';
// import moment from 'moment';
import { IScraper, PostData, ProfileData, ScrapJobContext } from '../../types/scraper';
import { EnvConfig } from '../../utils/config';
import { Logger } from '../../utils/logger';
import { ScrapperServiceBase } from './scrapperServiceBase';
import { PlatformType } from '../../utils/const';


/**
 * LinkedIn Scraper implementation using Bright Data Web Scraper API
 * 
 * This scraper uses Bright Data's Web Scraper API to fetch structured data
 * from LinkedIn profiles and posts without API limitations.
 * 
 * Bright Data handles:
 * - CAPTCHA solving
 * - Browser fingerprinting
 * - IP rotation
 * - Anti-bot detection
 */
export class LinkedInScraper extends ScrapperServiceBase implements IScraper {
    private readonly apiToken: string;
    private readonly webScraperUrl = 'https://api.brightdata.com/datasets/v3';
    private readonly requestTimeout = 10000;
    private readonly webhookUrl: string = 'https://influencer-tracking-backend-240655696079.asia-south1.run.app/scrap-webhook';
    // private readonly webhookUrl: string = 'https://eo85bamru7wval9.m.pipedream.net';

    // BrightData dataset IDs for LinkedIn
    private readonly datasets = {
        profile: 'gd_l1viktl72bvl7bjuj0', // LinkedIn profiles dataset
        posts: 'gd_lyy3tktm25m4avu764',   // LinkedIn posts dataset
    };

    constructor() {
        super();
        this.apiToken = EnvConfig.get('BRIGHT_DATA_API_TOKEN');
        if (!this.apiToken) {
            Logger.warn('Bright Data API token not configured');
        }
    }

    /**
     * Scrape LinkedIn profile information
     * @param handle - LinkedIn handle or profile URL
     * @param jobContext - Optional context for creating scrap job entries
     * @returns Profile data or null if scraping failed
     */
    async initScrapProfile(handle: string, jobContext: ScrapJobContext): Promise<void> {
        if (!this.apiToken) {
            Logger.error('Cannot scrape LinkedIn profile: API token not configured');
            throw new Error('Cannot scrape LinkedIn profile: API token not configured');
        }

        try {
            Logger.info(`Scraping LinkedIn profile for handle: ${handle}`);

            const profileUrl = this._buildProfileUrl(handle);

            // Create Job.
            const jobId = await this.createScrapJob({
                handle,
                targetUrl: profileUrl,
                jobType: 'profile',
                jobContext,
                platform: PlatformType.LinkedIn,
                status: 'processing'
            });

            // Trigger scraping job
            const snapshotId = await this.callProfileScrapingApi(profileUrl, jobId);

            Logger.info(`Successfully scraped LinkedIn profile for: ${handle}, snapshot id:`, snapshotId);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error(`Error scraping LinkedIn profile for ${handle}:`, errorMessage);
            throw error;
        }
    }

    /**
     * Scrape LinkedIn posts from a profile
     * @param handle - LinkedIn handle or profile URL
     * @param limit - Maximum number of posts to scrape (default: 20)
     * @param jobContext - Optional context for creating scrap job entries
     * @returns Array of post data
     */
    async initScrapPosts(handle: string, jobContext: ScrapJobContext): Promise<void> {
        if (!this.apiToken) {
            Logger.error('Cannot scrape LinkedIn posts: API token not configured');
            throw new Error('Cannot scrape LinkedIn posts: API token not configured');
        }

        try {
            Logger.info(`Scraping LinkedIn posts from: ${handle}`);

            const profileUrl = this._buildProfileUrl(handle);

            // Create Job.
            const jobId = await this.createScrapJob({
                handle,
                targetUrl: profileUrl,
                jobType: 'posts',
                jobContext,
                platform: PlatformType.LinkedIn,
                status: 'processing'
            });

            // Trigger scraping job
            const snapshotId = await this.callPostScrapingApi(profileUrl, jobId);

            // Poll for results
            // const response = await this.pollScrapingJob(snapshotId);
            // const posts = response.data as LinkedInPost[] || [];

            // Extract target user_id from the posts
            // const targetUserId = this.extractTargetUserId(posts);

            // // Filter posts to only include those authored by the target user
            // const ownPosts = this.filterOwnPosts(posts, targetUserId);

            // // Format posts to match PostData interface
            // const formattedPosts = ownPosts.map(post => this.formatPost(post));

            Logger.info(`Initialized post scrapping request for ${handle}, snapshot id:`, snapshotId);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error(`Error scraping LinkedIn posts from ${handle}:`, errorMessage);
            throw error;
        }
    }

    /**
     * Build LinkedIn profile URL from handle
     * @param handle - LinkedIn handle or profile URL
     * @returns Full LinkedIn profile URL
     */
    private _buildProfileUrl(handle: string): string {
        // Remove @ symbol if present
        const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

        // If it's already a full URL, return as is
        if (cleanHandle.includes('linkedin.com')) {
            return cleanHandle;
        }

        // Build profile URL
        return `https://linkedin.com/in/${cleanHandle}`;
    }

    private async callProfileScrapingApi(profileUrl: string, jobId: string): Promise<string> {

        const queryParams = new URLSearchParams({
            dataset_id: this.datasets.profile,
            format: 'json',
            include_errors: 'true',

            // Webhook for results.
            uncompressed_webhook: 'true',
            endpoint: `${this.webhookUrl}/${jobId}`,
            webhook_endpoint: `${this.webhookUrl}/${jobId}`,
            notify: 'true',
        }).toString();

        const options = {
            method: 'POST',
            url: `${this.webScraperUrl}/trigger?${queryParams}`,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify([{ url: profileUrl }]),
            timeout: this.requestTimeout,
        };

        Logger.info("Start: Hit Profile Scrap Api:", JSON.stringify(options));
        const response = await axios(options);
        Logger.info("End: Hit Profile Scrap Api:", JSON.stringify(response.data));

        return response.data.snapshot_id;
    }

    private async callPostScrapingApi(profileUrl: string, jobId: string): Promise<string> {

        const queryParams = new URLSearchParams({
            dataset_id: this.datasets.posts,
            format: 'json',
            type: 'discover_new',
            'discover_by': 'profile_url',
            // Removed limit_multiple_results to allow fetching all posts within date range

            include_errors: 'true',

            // Webhook for results.
            uncompressed_webhook: 'true',
            endpoint: `${this.webhookUrl}/${jobId}`,
            webhook_endpoint: `${this.webhookUrl}/${jobId}`,
            notify: 'true',
        }).toString();

        // Set date range to last month (30 days) to ensure all recent posts are synced
        // const endDate = moment().format('YYYY-MM-DD') + 'T23:59:59.999Z';
        // const startDate = moment().subtract(30, 'days').format('YYYY-MM-DD') + 'T00:00:00.000Z';

        const options = {
            method: 'POST',
            url: `${this.webScraperUrl}/trigger?${queryParams}`,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify([{
                url: profileUrl,
                // start_date: startDate,
                // end_date: endDate
            }]),
            timeout: this.requestTimeout,
        };

        // Logger.info(`Start: Hit Post Scrap Api for ${profileUrl}. Date range: ${startDate} to ${endDate}`, JSON.stringify(options));
        Logger.info(`Start: Hit Post Scrap Api for ${profileUrl}.`, JSON.stringify(options));
        const response = await axios(options);
        const snapshotId = response.data.snapshot_id;
        Logger.info("End: Hit Post Scrap Api:", JSON.stringify(response.data));

        return snapshotId;
    }

    /**
     * Poll for scraping job completion
     * @param snapshotId - Snapshot ID to poll
     * @returns Scraped data when ready
     */
    // private async pollScrapingJob(snapshotId: string): Promise<LinkedInApiResponse> {
    //     for (let attempt = 0; attempt < this.maxPollingAttempts; attempt++) {
    //         await this.delay(this.pollingDelay);

    //         try {
    //             const response: AxiosResponse = await axios.get(
    //                 `${this.webScraperUrl}/snapshot/${snapshotId}?format=json`,
    //                 {
    //                     headers: {
    //                         'Authorization': `Bearer ${this.apiToken}`
    //                     },
    //                     timeout: this.requestTimeout,
    //                 }
    //             );

    //             const status = response.data.status;
    //             Logger.info(`LinkedIn scraping job status(attempt #${attempt + 1}): ${status}`);
    //             if (status === 'running') {
    //                 continue;
    //             }

    //             return response.data as LinkedInApiResponse || { status: 'completed', data: [] };

    //         } catch (error: unknown) {
    //             const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    //             if (errorMessage === 'Scraping job failed') {
    //                 throw error;
    //             }
    //             Logger.error(`Error polling LinkedIn job ${snapshotId}:`, errorMessage);
    //         }
    //     }

    //     throw new Error(`LinkedIn scraping job ${snapshotId} timeout after ${this.maxPollingAttempts} attempts`);
    // }

    /**
     * Format profile data from Bright Data response
     * @param data - Raw profile data from Bright Data
     * @param profileUrl - Original profile URL
     * @returns Formatted profile data
     */
    public parseProfileData(payload: any): ProfileData {

        return {
            name: payload.name || payload.full_name || payload.title || '',
            profileUrl: payload.url || payload.profile_url || payload.input_url || '',
            avatarUrl: payload.avatar || payload.profile_picture || payload.image_url || payload.photo_url,
            platformUserId: payload.profile_id || payload.user_id || payload.linkedin_id,
            bio: payload.headline || payload.summary || payload.about,
            followerCount: this._parseNumber(payload.followers || payload.follower_count || payload.connections),
            verified: payload.verified || false,
            location: payload.city || payload.location || ''
        };
    }

    /**
     * Format post data from Bright Data response
     * @param post - Raw post data from Bright Data
     * @returns Formatted post data
     */
    public parsePostData(post: any): PostData {
        return {
            platformPostId: post.post_id || post.id || this.generateFallbackId(post),
            content: post.post_text_html || '',
            postUrl: post.url || post.post_url || post.link || '',
            likes: this._parseNumber(post.likes || post.reactions || post.like_count),
            comments: this._parseNumber(post.comments || post.num_comments || post.comment_count),
            shares: this._parseNumber(post.shares || post.reposts || post.share_count),
            postedAt: this.parseDate(post.posted_at || post.date_posted || post.timestamp),
            mediaUrls: this._parseMediaUrls(post),
        };
    }

    /**
     * Parse media URLs from various possible response formats
     * @param post - Raw post data
     * @returns Array of media URLs
     */
    private _parseMediaUrls(post: any): string[] {
        const urls: string[] = [];

        // Try different field names for media
        const media = post.images || post.media || post.media_urls || post.attachments || [];

        if (Array.isArray(media)) {
            media.forEach((item: any) => {
                if (typeof item === 'string') {
                    urls.push(item);
                } else if (item.url) {
                    urls.push(item.url);
                } else if (item.image_url) {
                    urls.push(item.image_url);
                }
            });
        }

        // Single image URL
        if (post.image_url && typeof post.image_url === 'string') {
            urls.push(post.image_url);
        }

        return urls;
    }

    /**
     * Parse number from various formats (string, number, "1.2K", etc.)
     * @param value - Value to parse
     * @returns Parsed number or 0 if invalid
     */
    private _parseNumber(value: string | number | undefined): number {
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

        return 0;
    }

    /**
     * Parse date from various formats and return as epoch timestamp in milliseconds
     * @param value - Date value to parse
     * @returns Epoch timestamp in milliseconds, or current time if invalid
     */
    private parseDate(value: string | Date | number | undefined): number {
        if (!value) {
            return Date.now();
        }

        if (value instanceof Date) {
            return value.getTime();
        }

        if (typeof value === 'number') {
            // If it's already a number, check if it's in seconds or milliseconds
            // Assume milliseconds if > year 2000 in ms, otherwise assume seconds
            return value > 946684800000 ? value : value * 1000;
        }

        // Try parsing as ISO string or timestamp
        const date = new Date(value);
        return isNaN(date.getTime()) ? Date.now() : date.getTime();
    }

    /**
     * Generate fallback ID if post doesn't have one
     * @param post - Post data
     * @returns Generated fallback ID
     */
    private generateFallbackId(post: any): string {
        const urlHash = Buffer.from(post.url || post.post_url || String(Date.now()))
            .toString('base64')
            .substring(0, 32);
        return `linkedin_${urlHash}`;
    }

    /**
     * Extract the target user_id from the posts
     * This identifies which user's profile we're scraping
     * @param posts - Array of scraped posts
     * @returns Target user ID or null if not found
     */
    // private extractTargetUserId(posts: LinkedInPost[]): string | null {
    //     // Try to extract from the most common post author
    //     const userIds = posts
    //         .map(post => post.user_id || post.author_id || post.author?.id)
    //         .filter((id): id is string => Boolean(id));

    //     if (userIds.length === 0) {
    //         Logger.warn('No user IDs found in scraped LinkedIn posts');
    //         return null;
    //     }

    //     // Count frequency of each user_id
    //     const userIdCounts = userIds.reduce((acc: Record<string, number>, id: string) => {
    //         acc[id] = (acc[id] || 0) + 1;
    //         return acc;
    //     }, {});

    //     // Return the most frequent user_id (the profile owner)
    //     const targetUserId = Object.keys(userIdCounts).reduce((a, b) =>
    //         userIdCounts[a] > userIdCounts[b] ? a : b
    //     );

    //     Logger.info(`Target LinkedIn user ID identified: ${targetUserId}`);
    //     return targetUserId;
    // }

    /**
     * Filter posts to only include those authored by the target user
     * Excludes posts the user has liked or commented on
     * @param posts - Array of scraped posts
     * @param targetUserId - Target user ID to filter by
     * @returns Filtered array of posts
     */
    // private filterOwnPosts(posts: LinkedInPost[], targetUserId: string | null): LinkedInPost[] {
    //     if (!targetUserId) {
    //         Logger.warn('No target user ID provided, returning all LinkedIn posts');
    //         return posts;
    //     }

    //     const filtered = posts.filter(post => {
    //         const postAuthorId = post.user_id || post.author_id || post.author?.id;
    //         return postAuthorId === targetUserId;
    //     });

    //     Logger.info(`Filtered ${filtered.length} own posts from ${posts.length} total LinkedIn posts`);
    //     return filtered;
    // }

    /**
     * Utility delay function for polling
     * @param ms - Milliseconds to delay
     * @returns Promise that resolves after delay
     */
    // private delay(ms: number): Promise<void> {
    //     return new Promise(resolve => setTimeout(resolve, ms));
    // }
}