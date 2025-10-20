/**
 * Scrapers module exports
 * 
 * This module provides a centralized way to import all scraper-related components.
 * Use ScraperFactory.getScraper(platform) to get the appropriate scraper instance.
 */

export { IScraper, ProfileData, PostData } from '../../types/scraper';
export { LinkedInScraper } from './linkedInScraper';
// export { XScraper } from './xScraper';
export { ScraperFactory } from './scraperFactory';
