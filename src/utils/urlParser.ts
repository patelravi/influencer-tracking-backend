// Utility to extract handles from social media profile URLs

export class URLParser {
    /**
     * Extract handle from various social media profile URLs
     */
    static extractHandle(platform: string, input: string): string {
        // Clean the input - remove leading/trailing spaces
        const cleaned = input.trim();

        // If it doesn't look like a URL, assume it's already a handle
        if (!cleaned.includes('/') && !cleaned.includes('.')) {
            return cleaned.replace('@', ''); // Remove @ if present
        }

        switch (platform) {
            case 'X':
                return this.extractXHandle(cleaned);
            case 'YouTube':
                return this.extractYouTubeHandle(cleaned);
            case 'Instagram':
                return this.extractInstagramHandle(cleaned);
            case 'LinkedIn':
                return this.extractLinkedInHandle(cleaned);
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    /**
     * Extract X (Twitter) handle from URL
     * Supports: twitter.com/username, x.com/username
     */
    private static extractXHandle(input: string): string {
        // Pattern: twitter.com/username or x.com/username
        const match = input.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
        if (match) {
            return match[1];
        }

        // If no match, assume it's already a handle
        return input.replace('@', '');
    }

    /**
     * Extract YouTube handle from URL
     * Supports: youtube.com/@handle, youtube.com/c/handle, youtube.com/channel/ID
     */
    private static extractYouTubeHandle(input: string): string {
        // Pattern: youtube.com/@handle
        let match = input.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
        if (match) {
            return match[1];
        }

        // Pattern: youtube.com/c/handle
        match = input.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return match[1];
        }

        // Pattern: youtube.com/channel/CHANNEL_ID
        match = input.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return match[1];
        }

        // Pattern: youtu.be links (not common for profiles, but handle it)
        match = input.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return match[1];
        }

        // If no match, assume it's already a handle
        return input.replace('@', '');
    }

    /**
     * Extract Instagram handle from URL
     * Supports: instagram.com/username
     */
    private static extractInstagramHandle(input: string): string {
        // Pattern: instagram.com/username
        const match = input.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
        if (match) {
            // Remove trailing slash if present
            return match[1].replace(/\/$/, '');
        }

        // If no match, assume it's already a handle
        return input.replace('@', '');
    }

    /**
     * Extract LinkedIn handle from URL
     * Supports: linkedin.com/in/handle
     */
    private static extractLinkedInHandle(input: string): string {
        // Pattern: linkedin.com/in/handle
        const match = input.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
        if (match) {
            // Remove trailing slash if present
            return match[1].replace(/\/$/, '');
        }

        // If no match, assume it's already a handle
        return input;
    }

    /**
     * Validate if the extracted handle looks reasonable
     */
    static isValidHandle(handle: string): boolean {
        // Basic validation: not empty, reasonable length, no spaces
        return handle.length > 0 && handle.length < 100 && !handle.includes(' ');
    }
}

