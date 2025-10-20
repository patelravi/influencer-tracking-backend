import { IScraper } from '../../types/scraper';
import { LinkedInScraper } from './linkedInScraper';
// import { XScraper } from './xScraper';
import { Logger } from '../../utils/logger';
import { PlatformType } from '../../utils/const';

/**
 * Factory class for creating platform-specific scrapers
 * Provides a centralized way to instantiate the appropriate scraper based on platform type
 */
export class ScraperFactory {
    private static scrapers: Map<string, IScraper> = new Map();

    /**
     * Get or create a scraper instance for the specified platform
     * @param platform - Platform type (LinkedIn, X, etc.)
     * @returns IScraper instance for the platform
     * @throws Error if platform is not supported
     */
    static getScraper(platform: string): IScraper {
        // Normalize platform name
        const normalizedPlatform = this.normalizePlatform(platform);

        // Return cached instance if available
        if (this.scrapers.has(normalizedPlatform)) {
            return this.scrapers.get(normalizedPlatform)!;
        }

        // Create new instance based on platform
        let scraper: IScraper;

        switch (platform) {
            case PlatformType.LinkedIn:
                scraper = new LinkedInScraper();
                break;

            // case PlatformType.X:
            //     scraper = new XScraper();
            //     break;

            default:
                Logger.error(`Unsupported platform: ${platform}`);
                throw new Error(`Unsupported platform: ${platform}`);
        }

        // Cache the instance for future use
        this.scrapers.set(normalizedPlatform, scraper);
        Logger.info(`Created ${normalizedPlatform} scraper instance`);

        return scraper;
    }

    /**
     * Get all supported platforms
     * @returns Array of supported platform names
     */
    static getSupportedPlatforms(): string[] {
        return [PlatformType.LinkedIn, PlatformType.X];
    }

    /**
     * Check if a platform is supported
     * @param platform - Platform name to check
     * @returns True if platform is supported, false otherwise
     */
    static isPlatformSupported(platform: string): boolean {
        const normalizedPlatform = this.normalizePlatform(platform);
        return this.getSupportedPlatforms().includes(normalizedPlatform);
    }

    /**
     * Clear all cached scraper instances
     * Useful for testing or when you need fresh instances
     */
    static clearCache(): void {
        this.scrapers.clear();
        Logger.info('Scraper cache cleared');
    }

    /**
     * Normalize platform name for consistent comparison
     * @param platform - Platform name to normalize
     * @returns Normalized platform name
     */
    private static normalizePlatform(platform: string): string {
        return platform.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
}
