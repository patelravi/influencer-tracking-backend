// import axios, { AxiosResponse } from 'axios';
// import { Logger } from '../utils/logger';
// import { EnvConfig } from '../utils/config';

// /**
//  * LinkedIn Scraper Service using Bright Data Web Scraper API
//  * 
//  * This service uses Bright Data's Web Scraper API to fetch structured data
//  * from LinkedIn competitor profiles without API limitations.
//  * 
//  * Bright Data handles:
//  * - CAPTCHA solving
//  * - Browser fingerprinting
//  * - IP rotation
//  * - Anti-bot detection
//  */

// interface LinkedInPostData {
//     platformPostId: string;
//     content: string;
//     postUrl: string;
//     likes: number;
//     comments: number;
//     shares: number;
//     postedAt: Date;
//     mediaUrls: string[];
// }

// export class LinkedInScraperService {
//     private readonly apiToken: string;
//     private readonly webScraperUrl = 'https://api.brightdata.com/datasets/v3';
//     private readonly linkedInDatasetId = 'gd_lyy3tktm25m4avu764'; // LinkedIn posts dataset
//     private readonly requestTimeout = 10000;
//     private readonly maxPollingAttempts = 100;
//     private readonly pollingDelay = 2000;

//     constructor() {
//         this.apiToken = EnvConfig.get('BRIGHT_DATA_API_TOKEN');
//         if (!this.apiToken) {
//             Logger.warn('Bright Data API token not configured');
//         }
//     }


//     /**
//      * Fetch recent posts from a LinkedIn profile or company page
//      * @param profileUrl - LinkedIn profile URL
//      * @param limit - Maximum number of posts to fetch (default: 20)
//      * @returns Array of formatted post data ready for database storage
//      */
//     async scrapeProfilePosts(profileUrl: string, limit = 20): Promise<LinkedInPostData[]> {
//         if (!this.apiToken) {
//             Logger.error('Cannot scrape LinkedIn: API token not configured');
//             return [];
//         }

//         try {
//             Logger.info(`Scraping LinkedIn posts from: ${profileUrl}`);

//             // Trigger scraping job
//             const snapshotId = await this.triggerScrapingJob(profileUrl, limit);

//             // Poll for results
//             const posts = await this.pollScrapingJob(snapshotId);

//             // Extract target user_id from the posts
//             const targetUserId = this.extractTargetUserId(posts);

//             // Filter posts to only include those authored by the target user
//             const ownPosts = this.filterOwnPosts(posts, targetUserId);

//             // Format posts to match PostModel
//             const formattedPosts = ownPosts.map(post => this.formatPost(post));

//             Logger.info(`Successfully scraped ${formattedPosts.length} posts from ${profileUrl} (filtered from ${posts.length} total)`);
//             return formattedPosts;

//         } catch (error: any) {
//             Logger.error(`Error scraping LinkedIn posts from ${profileUrl}:`, error.response?.data || error.message);
//             return [];
//         }
//     }

//     /**
//      * Trigger a Bright Data scraping job
//      * @param profileUrl - LinkedIn profile URL to scrape
//      * @param limit - Maximum number of posts to fetch
//      * @returns Snapshot ID for polling
//      */
//     private async triggerScrapingJob(profileUrl: string, limit: number): Promise<string> {
//         const url = `${this.webScraperUrl}/trigger?dataset_id=${this.linkedInDatasetId}&include_errors=true&type=discover_new&discover_by=profile_url`;
//         const payload = JSON.stringify([{ url: profileUrl }]);

//         const response: AxiosResponse = await axios.post(url, payload, {
//             headers: {
//                 'Authorization': `Bearer ${this.apiToken}`,
//                 'Content-Type': 'application/json',
//             },
//             timeout: this.requestTimeout,
//         });

//         const snapshotId = response.data.snapshot_id;
//         Logger.info(`Scraping job triggered: ${snapshotId}, LIMIT: ${limit}`);

//         return snapshotId;
//     }

//     /**
//      * Poll for scraping job completion
//      * @param snapshotId - Snapshot ID to poll
//      * @returns Scraped data when ready
//      */
//     private async pollScrapingJob(snapshotId: string): Promise<any[]> {
//         for (let attempt = 0; attempt < this.maxPollingAttempts; attempt++) {
//             await this.delay(this.pollingDelay);

//             try {
//                 const response: AxiosResponse = await axios.get(
//                     `${this.webScraperUrl}/snapshot/${snapshotId}?format=json`,
//                     {
//                         headers: {
//                             'Authorization': `Bearer ${this.apiToken}`
//                         },
//                         timeout: this.requestTimeout,
//                     }
//                 );

//                 const status = response.data.status;
//                 Logger.info(`Scraping job status(attempt #${attempt + 1}): ${status}`);
//                 if (status === 'running') {
//                     continue;
//                 }

//                 return response.data || [];

//             } catch (error: any) {
//                 if (error.message === 'Scraping job failed') {
//                     throw error;
//                 }
//                 Logger.error(`Error polling job ${snapshotId}:`, error.message);
//             }
//         }

//         throw new Error(`Scraping job ${snapshotId} timeout after ${this.maxPollingAttempts} attempts`);
//     }

//     /**
//      * Format Bright Data post response to match our PostModel structure
//      * @param post - Raw post data from Bright Data
//      * @returns Formatted post data
//      */
//     private formatPost(post: any): LinkedInPostData {
//         return {
//             platformPostId: post.post_id || post.id || this.generateFallbackId(post),
//             content: post.post_text_html || '',
//             postUrl: post.url || post.post_url || post.link || '',
//             likes: this.parseNumber(post.likes || post.reactions || post.like_count),
//             comments: this.parseNumber(post.comments || post.num_comments || post.comment_count),
//             shares: this.parseNumber(post.shares || post.reposts || post.share_count),
//             postedAt: this.parseDate(post.posted_at || post.created_at || post.timestamp),
//             mediaUrls: this.parseMediaUrls(post),
//         };
//     }

//     /**
//      * Parse media URLs from various possible response formats
//      * @param post - Raw post data
//      * @returns Array of media URLs
//      */
//     private parseMediaUrls(post: any): string[] {
//         const urls: string[] = [];

//         // Try different field names for media
//         const media = post.images || post.media || post.media_urls || post.attachments || [];

//         if (Array.isArray(media)) {
//             media.forEach((item: any) => {
//                 if (typeof item === 'string') {
//                     urls.push(item);
//                 } else if (item.url) {
//                     urls.push(item.url);
//                 } else if (item.image_url) {
//                     urls.push(item.image_url);
//                 }
//             });
//         }

//         // Single image URL
//         if (post.image_url && typeof post.image_url === 'string') {
//             urls.push(post.image_url);
//         }

//         return urls;
//     }

//     /**
//      * Parse number from various formats (string, number, "1.2K", etc.)
//      * @param value - Value to parse
//      * @returns Parsed number or 0 if invalid
//      */
//     private parseNumber(value: any): number {
//         if (typeof value === 'number') {
//             return value;
//         }

//         if (typeof value === 'string') {
//             // Handle "1.2K", "5.3M" format
//             const match = value.match(/^([\d.]+)([KkMm])?$/);
//             if (match) {
//                 const num = parseFloat(match[1]);
//                 const suffix = match[2]?.toLowerCase();

//                 if (suffix === 'k') return Math.round(num * 1000);
//                 if (suffix === 'm') return Math.round(num * 1000000);
//                 return Math.round(num);
//             }
//         }

//         return 0;
//     }

//     /**
//      * Parse date from various formats
//      * @param value - Date value to parse
//      * @returns Parsed date or current date if invalid
//      */
//     private parseDate(value: any): Date {
//         if (!value) {
//             return new Date();
//         }

//         if (value instanceof Date) {
//             return value;
//         }

//         // Try parsing as ISO string or timestamp
//         const date = new Date(value);
//         return isNaN(date.getTime()) ? new Date() : date;
//     }

//     /**
//      * Generate fallback ID if post doesn't have one
//      * @param post - Post data
//      * @returns Generated fallback ID
//      */
//     private generateFallbackId(post: any): string {
//         const urlHash = Buffer.from(post.url || post.post_url || String(Date.now()))
//             .toString('base64')
//             .substring(0, 32);
//         return `linkedin_${urlHash}`;
//     }

//     /**
//      * Extract the target user_id from the posts
//      * This identifies which user's profile we're scraping
//      * @param posts - Array of scraped posts
//      * @returns Target user ID or null if not found
//      */
//     private extractTargetUserId(posts: any[]): string | null {
//         // Try to extract from the most common post author
//         const userIds = posts
//             .map(post => post.user_id || post.author_id || post.author?.id)
//             .filter(Boolean);

//         if (userIds.length === 0) {
//             Logger.warn('No user IDs found in scraped posts');
//             return null;
//         }

//         // Count frequency of each user_id
//         const userIdCounts = userIds.reduce((acc: any, id: string) => {
//             acc[id] = (acc[id] || 0) + 1;
//             return acc;
//         }, {});

//         // Return the most frequent user_id (the profile owner)
//         const targetUserId = Object.keys(userIdCounts).reduce((a, b) =>
//             userIdCounts[a] > userIdCounts[b] ? a : b
//         );

//         Logger.info(`Target user ID identified: ${targetUserId}`);
//         return targetUserId;
//     }

//     /**
//      * Filter posts to only include those authored by the target user
//      * Excludes posts the user has liked or commented on
//      * @param posts - Array of scraped posts
//      * @param targetUserId - Target user ID to filter by
//      * @returns Filtered array of posts
//      */
//     private filterOwnPosts(posts: any[], targetUserId: string | null): any[] {
//         if (!targetUserId) {
//             Logger.warn('No target user ID provided, returning all posts');
//             return posts;
//         }

//         const filtered = posts.filter(post => {
//             const postAuthorId = post.user_id || post.author_id || post.author?.id;
//             return postAuthorId === targetUserId;
//         });

//         Logger.info(`Filtered ${filtered.length} own posts from ${posts.length} total posts`);
//         return filtered;
//     }

//     /**
//      * Utility delay function for polling
//      * @param ms - Milliseconds to delay
//      * @returns Promise that resolves after delay
//      */
//     private delay(ms: number): Promise<void> {
//         return new Promise(resolve => setTimeout(resolve, ms));
//     }
// }