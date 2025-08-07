import { request } from 'obsidian';
import { OPDSBook, OPDSCategory } from './types';

export class OPDSClient {
    private baseUrl: string;
    private username: string;
    private password: string;
    private authenticatedBaseUrl: string;

    constructor(baseUrl: string, username: string, password: string) {
        this.baseUrl = baseUrl;
        this.username = username;
        this.password = password;
        
        const isHttps = this.baseUrl.startsWith('https://');
        this.authenticatedBaseUrl =  `${isHttps ? 'https' : 'http'}://${this.username}:${this.password}@${this.baseUrl.replaceAll('https://', '').replaceAll('http://', '')}`;
    }

    getCatalogUrl(): string {
        return `${this.authenticatedBaseUrl}/opds`;
    }

    getauthenticatedBaseUrl(): string {
        return this.authenticatedBaseUrl;
    }

    async getCatalog(): Promise<OPDSCategory[]> {
        const url = this.getCatalogUrl();
        const response = await request({ url, method: 'GET' });
        return this.parseOPDSXML(response);
    }

    async getCategory(categoryUrl: string): Promise<{ books: OPDSBook[], subcategories: OPDSCategory[] }> {
        const response = await request({ url: categoryUrl, method: 'GET' });
        return this.parseBooksXML(response);
    }

    private parseOPDSXML(xmlText: string): OPDSCategory[] {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const categories: OPDSCategory[] = [];
        const entries = xmlDoc.querySelectorAll('entry');
        entries.forEach((entry) => {
            const titleElement = entry.querySelector('title');
            const linkElement = entry.querySelector('link');
            if (titleElement && linkElement) {
                const title = titleElement.textContent || 'Unknown';
                const href = linkElement.getAttribute('href');
                if (href) {
                    const fullHref = href.startsWith('http') ? href : `${this.authenticatedBaseUrl}${href}`;
                    categories.push({
                        title: title,
                        href: fullHref,
                        bookCount: 0
                    });
                }
            }
        });
        return categories;
    }

    private parseBooksXML(xmlText: string): { books: OPDSBook[], subcategories: OPDSCategory[] } {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const books: OPDSBook[] = [];
        const subcategories: OPDSCategory[] = [];
        const entries = xmlDoc.querySelectorAll('entry');
        entries.forEach((entry) => {
            const titleElement = entry.querySelector('title');
            const linkElement = entry.querySelector('link');
            if (titleElement && linkElement) {
                const title = titleElement.textContent || 'Unknown';
                const href = linkElement.getAttribute('href');
                if (href) {
                    const acquisitionLinks = entry.querySelectorAll('link[rel="http://opds-spec.org/acquisition"]');
                    if (acquisitionLinks.length > 0) {
                        const authorElement = entry.querySelector('author name');
                        const summaryElement = entry.querySelector('summary');
                        const updatedElement = entry.querySelector('updated');
                        const formats: Array<{ type: string, href: string, title?: string }> = [];
                        acquisitionLinks.forEach((link) => {
                            const href = link.getAttribute('href');
                            const type = link.getAttribute('type') || 'unknown';
                            const title = link.getAttribute('title');
                            if (href) {
                                formats.push({
                                    type: type,
                                    href: href,
                                    title: title || this.getFormatDisplayName(type)
                                });
                            }
                        });
                        const book: OPDSBook = {
                            title: title,
                            author: authorElement?.textContent || undefined,
                            summary: summaryElement?.textContent || undefined,
                            formats: formats,
                            updated: updatedElement?.textContent || undefined
                        };
                        books.push(book);
                    } else {
                        const fullHref = href.startsWith('http') ? href : `${this.authenticatedBaseUrl}${href}`;
                        subcategories.push({
                            title: title,
                            href: fullHref,
                            bookCount: 0
                        });
                    }
                }
            }
        });
        return { books, subcategories };
    }

    private getFormatDisplayName(type: string): string {
        switch (type) {
            case 'application/epub+zip': return 'EPUB';
            case 'application/pdf': return 'PDF';
            case 'application/mobi+xml':
            case 'application/x-mobipocket-ebook': return 'MOBI';
            case 'application/x-fictionbook+xml': return 'FB2';
            case 'application/x-ibooks+xml': return 'iBooks';
            case 'application/x-cbr+zip': return 'CBR';
            case 'application/x-cbz+zip': return 'CBZ';
            case 'application/x-rar': return 'RAR';
            case 'application/x-7z-compressed': return '7Z';
            case 'application/x-tar': return 'TAR';
            case 'application/x-zip': return 'ZIP';
            case 'application/x-bzip2': return 'BZIP2';
            case 'application/x-gzip': return 'GZIP';
            case 'application/x-xz': return 'XZ';
            case 'application/x-zstd': return 'ZSTD';
            case 'application/x-lzip': return 'LZIP';
            case 'application/x-lzma': return 'LZMA';
            case 'application/x-lz4': return 'LZ4';
            case 'application/x-brotli': return 'BROTLI';
            default: return type;
        }
    }
}
