import { request, requestUrl } from 'obsidian';
import { OPDSBook, OPDSBookFormat, OPDSCatalog, OPDSEntry } from './interfaces';
import { getFormatDisplayName } from './utils/name-utils';

export class OPDSClient {
    private baseUrl: string;
    private username: string;
    private password: string;

    constructor(baseUrl: string, username: string, password: string) {
        this.baseUrl = baseUrl;
        this.username = username;
        this.password = password;
    }

    // ===== URL METHODS =====

    getOpdsUrl(): string {
        return `${this.baseUrl}/opds`;
    }

    /**
     * Converting the base URL to a basic authenticated base URL with username and password in the URL.
     * E.g: https://calibreweb.yourdomain.com/ -> https://username:password@calibreweb.yourdomain.com/
     * 
     * @returns The basic authenticated base URL.
     */
    getBasicAuthenticatedBaseUrl(): string {
        const isHttps = this.baseUrl.startsWith('https://');
        return `${isHttps ? 'https' : 'http'}://${this.username}:${this.password}@${this.baseUrl.replaceAll('https://', '').replaceAll('http://', '')}`;
    }

    /**
     * Converting the base URL to a basic authenticated base URL with username and password in the URL.
     * E.g: https://calibreweb.yourdomain.com/ -> https://username:password@calibreweb.yourdomain.com/
     * 
     * @returns The basic authenticated base URL.
     */
    toAuthenticateUrlParams(url: string): string {
        if (url.includes('?')) {
            return `${url}&username=${this.username}&password=${this.password}`;
        }
        return `${url}?username=${this.username}&password=${this.password}`;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    // ===== REQUEST METHODS =====

    async getEntry(path?: string): Promise<OPDSEntry> {
        const url = (path ? this.baseUrl + path : this.getOpdsUrl());
        const response = await request({ url: url, 
            method: 'GET', 
            headers: { 'Authorization': `Basic ${btoa(`${this.username}:${this.password}`)}` }
        });
        return this.parseXML(response);
    }

    async fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
        const response = await requestUrl({ url: url, method: 'GET', 
            headers: { 'Authorization': `Basic ${btoa(`${this.username}:${this.password}`)}` } 
        });
        
        return response.arrayBuffer;
    }

    // ===== PARSING METHODS =====

    private parseXML(xmlText: string): OPDSEntry {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const books: OPDSBook[] = [];
        const subCatalogs: OPDSCatalog[] = [];
        const entries = xmlDoc.querySelectorAll('entry');
        entries.forEach((entry) => {
            const title = entry.querySelector('title')?.textContent || 'Unknown';

            books.push(...this.toOPDSBooks(entry, title));
            subCatalogs.push(...this.toOPDSCatalogs(entry, title));
        });
        return { books, catalogs: subCatalogs };
    }

    private toOPDSCatalogs(entry: Element, title: string): OPDSCatalog[] {
        const subCatalogs: OPDSCatalog[] = [];

        const catalog = entry.querySelector('link[type*="profile=opds-catalog"]');
        if (catalog) {
            const href = catalog.getAttribute('href');
            if (href) {
                subCatalogs.push({
                    title: title,
                    href: href,
                    bookCount: 0
                });
            }
        }
        return subCatalogs;
    }

    private toOPDSBooks(entry: Element, title: string): OPDSBook[] {
        const books: OPDSBook[] = [];
        const acquisitionLinks = entry.querySelectorAll('link[rel="http://opds-spec.org/acquisition"]');
        if (acquisitionLinks.length > 0) {
            const authorElement = entry.querySelector('author name');
            const summaryElement = entry.querySelector('summary');
            const updatedElement = entry.querySelector('updated');
            const thumbnailElement = entry.querySelector('link[rel="http://opds-spec.org/image/thumbnail"]');
            const formats: Array<{ type: string, href: string, title?: string }> = [];
            acquisitionLinks.forEach((link) => {
                const href = link.getAttribute('href');
                const type = link.getAttribute('type') || 'unknown';
                const title = link.getAttribute('title');
                if (href) {
                    formats.push({
                        type: type,
                        href: href,
                        title: title || getFormatDisplayName(type)
                    } as OPDSBookFormat);
                }
            });

            let thumbnailUrl: string | undefined;
            if (thumbnailElement?.getAttribute('href')) {
                thumbnailUrl = this.baseUrl + thumbnailElement.getAttribute('href');
            }
            const book: OPDSBook = {
                title: title,
                author: authorElement?.textContent || undefined,
                summary: summaryElement?.textContent || undefined,
                formats: formats,
                updated: updatedElement?.textContent || undefined,
                thumbnailUrl: thumbnailUrl
            };
            books.push(book);
        }
        return books;
    }

}
