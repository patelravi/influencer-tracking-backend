// import axios, { AxiosResponse } from 'axios';
// import { Logger } from '../../utils/logger';
// import { EnvConfig } from '../../utils/config';
// import { IScraper, ProfileData, PostData } from '../../types/scraper';

// /**
//  * X (Twitter) Scraper implementation using Twitter API v2
//  * 
//  * This scraper uses Twitter's official API v2 for authenticated requests
//  * to fetch user profiles and posts data.
//  */
// export class XScraper implements IScraper {
//     private readonly bearerToken: string;
//     private readonly baseUrl = 'https://api.twitter.com/2';
//     private readonly requestTimeout = 10000;

//     constructor() {
//         this.bearerToken = EnvConfig.get('X_BEARER_TOKEN');
//         if (!this.bearerToken) {
//             Logger.warn('X Bearer Token not configured');
//         }
//     }

//     /**
//      * Scrape X profile information
//      * @param handle - X username (with or without @)
//      * @returns Profile data or null if scraping failed
//      */
// async initScrapProfile(handle: string): Promise < void> {

//         if (!this.bearerToken) {
//             Logger.error('Cannot scrape X profile: Bearer token not configured');
//             return null;
//         }

//         try {
//             Logger.info(`Scraping X profile for handle: ${handle}`);

//             // Clean handle (remove @ if present)
//             const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

//             // Get user by username
//             const userData = await this.getUserByUsername(cleanHandle);

//             if (!userData) {
//                 Logger.warn(`X user not found: ${cleanHandle}`);
//                 return null;
//             }

//             // Format profile data
//             const profileData: ProfileData = {
//                 name: userData.name,
//                 avatarUrl: userData.profile_image_url,
//                 platformUserId: userData.id,
//                 bio: userData.description,
//                 followerCount: userData.public_metrics?.followers_count,
//                 verified: userData.verified,
//                 location: '', // X API v2 doesn't provide location in basic user fields
//                 profileUrl: `https://x.com/${cleanHandle}`
//             };

//             Logger.info(`Successfully scraped X profile for: ${cleanHandle}`);
//             return profileData;

//         } catch (error: any) {
//             Logger.error(`Error scraping X profile for ${handle}:`, error.response?.data || error.message);
//             return null;
//         }
// }

//     /**
//      * Scrape X posts from a user
//      * @param handle - X username (with or without @)
//      * @param limit - Maximum number of posts to scrape (default: 20)
//      * @returns Array of post data
//      */
//     async initScrapPosts(handle: string, limit = 20): Promise<> {
//         if (!this.bearerToken) {
//             Logger.error('Cannot scrape X posts: Bearer token not configured');
//             return [];
//         }

//         try {
//             Logger.info(`Scraping X posts from: ${handle}`);

//             // Clean handle (remove @ if present)
//             const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

//             // Get user by username first
//             const userData = await this.getUserByUsername(cleanHandle);

//             if (!userData) {
//                 Logger.warn(`X user not found: ${cleanHandle}`);
//                 return [];
//             }

//             // Get user tweets
//             const posts = await this.getUserTweets(userData.id, limit);



//         } catch (error: any) {
//             Logger.error(`Error scraping X posts from ${handle}:`, error.response?.data || error.message);
//             return [];
//         }
//     }

//     /**
//      * Get user information by username
//      * @param username - X username (without @)
//      * @returns User data or null if not found
//      */
//     private async getUserByUsername(username: string): Promise<any | null> {
//         try {
//             const response: AxiosResponse = await axios.get(
//                 `${this.baseUrl}/users/by/username/${username}`,
//                 {
//                     headers: {
//                         Authorization: `Bearer ${this.bearerToken}`,
//                     },
//                     params: {
//                         'user.fields': 'profile_image_url,description,verified,public_metrics',
//                     },
//                     timeout: this.requestTimeout,
//                 }
//             );

//             return response.data.data || null;
//         } catch (error: any) {
//             Logger.error(`Error fetching X user ${username}:`, error.response?.data || error.message);
//             return null;
//         }
//     }

//     /**
//      * Get user tweets by user ID
//      * @param userId - X user ID
//      * @param limit - Maximum number of tweets to fetch
//      * @returns Array of formatted post data
//      */
//     private async initTweetSyncgetUserTweets(userId: string, limit: number): Promise<PostData[]> {
//         try {
//             const response: AxiosResponse = await axios.get(
//                 `${this.baseUrl}/users/${userId}/tweets`,
//                 {
//                     headers: {
//                         Authorization: `Bearer ${this.bearerToken}`,
//                     },
//                     params: {
//                         'tweet.fields': 'created_at,public_metrics,attachments',
//                         'expansions': 'attachments.media_keys',
//                         'media.fields': 'url,preview_image_url',
//                         'max_results': Math.min(limit, 100), // Twitter API limit is 100 per request
//                     },
//                     timeout: this.requestTimeout,
//                 }
//             );

//             const tweets = response.data.data || [];
//             const mediaMap = this.buildMediaMap(response.data.includes?.media || []);

//             // Format tweets to PostData
//             const formattedPosts = tweets.map((tweet: any) => this.formatTweet(tweet, mediaMap));

//             return formattedPosts;

//         } catch (error: any) {
//             Logger.error(`Error fetching X tweets for user ${userId}:`, error.response?.data || error.message);
//             return [];
//         }
//     }

//     /**
//      * Build media map from API response
//      * @param media - Media array from API response
//      * @returns Map of media_key to media URL
//      */
//     private buildMediaMap(media: any[]): Map<string, string> {
//         const mediaMap = new Map<string, string>();

//         media.forEach((item: any) => {
//             if (item.media_key && (item.url || item.preview_image_url)) {
//                 mediaMap.set(item.media_key, item.url || item.preview_image_url);
//             }
//         });

//         return mediaMap;
//     }

//     /**
//      * Format X tweet to PostData
//      * @param tweet - Raw tweet data from API
//      * @param mediaMap - Map of media keys to URLs
//      * @returns Formatted post data
//      */
//     private formatTweet(tweet: any, mediaMap: Map<string, string>): PostData {
//         const mediaUrls: string[] = [];

//         // Extract media URLs
//         if (tweet.attachments?.media_keys) {
//             tweet.attachments.media_keys.forEach((key: string) => {
//                 const mediaUrl = mediaMap.get(key);
//                 if (mediaUrl) {
//                     mediaUrls.push(mediaUrl);
//                 }
//             });
//         }

//         return {
//             platformPostId: tweet.id,
//             content: tweet.text || '',
//             postUrl: `https://x.com/i/web/status/${tweet.id}`,
//             likes: tweet.public_metrics?.like_count || 0,
//             comments: tweet.public_metrics?.reply_count || 0,
//             shares: tweet.public_metrics?.retweet_count || 0,
//             postedAt: new Date(tweet.created_at),
//             mediaUrls: mediaUrls,
//         };
//     }
// }
