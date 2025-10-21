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
    static getScraper(platform: 'LinkedIn' | 'X'): IScraper {

        // Return cached instance if available
        if (this.scrapers.has(platform)) {
            return this.scrapers.get(platform)!;
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
        this.scrapers.set(platform, scraper);
        Logger.info(`Created ${platform} scraper instance`);

        return scraper;
    }
}
