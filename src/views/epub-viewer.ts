import { debounce, ItemView, requestUrl, WorkspaceLeaf } from 'obsidian';
import { Book, Location, Rendition } from 'epubjs';
import { showAppearanceSettingsModal, AppearanceSettings } from '../modal/appearance-settings-modal';
import { EpubTopBar } from './epub-top-bar';
import Navigation from 'epubjs/types/navigation';
import { Plugin } from 'obsidian';
import { EPUBViewerSettings } from '../types';

const VIEW_TYPE_EPUB = "epub-viewer";


const DEFAULT_SETTINGS: EPUBViewerSettings = {
    darkMode: {
        backgroundColor: '#1a1a1a',
        textColor: '#dcddde'
    },
    lightMode: {
        backgroundColor: '#ffffff',
        textColor: '#2e3338'
    },
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    flow: 'paginated',
    columns: 1,
    padding: '20px',
    margin: '0'
};

export class EPUBViewer extends ItemView {
    private epubUrl = '';
    private bookTitle = '';
    private settings: EPUBViewerSettings = { ...DEFAULT_SETTINGS };
    private currentRendition: Rendition | null = null;
    private book?: Book;
    topBar: EpubTopBar;
    private plugin: Plugin;
    private epubViewContainer?: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
        super(leaf);
        this.plugin = plugin;
        this.loadSettings();
    }

    private loadSettings(): void {
        const savedSettings = localStorage.getItem('epub-viewer-settings');
        if (savedSettings) {
            try {
                this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
            } catch (error) {
                console.error('Failed to load EPUB viewer settings:', error);
                this.settings = { ...DEFAULT_SETTINGS };
            }
        }
    }

    private saveSettings(): void {
        localStorage.setItem('epub-viewer-settings', JSON.stringify(this.settings));
    }

    getViewType(): string {
        return VIEW_TYPE_EPUB;
    }

    getDisplayText(): string {
        return `EPUB: ${this.bookTitle || 'Loading...'}`;
    }

    getIcon(): string {
        return "book-open";
    }

    async setState(state: any, result: any): Promise<void> {
        this.epubUrl = state.epubUrl || '';
        this.bookTitle = state.bookTitle || '';
        await super.setState(state, result);
        await this.renderEpubViewer();
    }

    async onOpen() {
        await this.renderEpubViewer();
    }

    async onClose() {
        // Cleanup if needed
        this.currentRendition = null;
    }

    private debouncedResize = debounce(async () => {
        console.log('found resize, rerender');
        this.currentRendition?.flow(this.settings.flow);
        if (this.settings.flow === 'paginated') {
            if (this.settings.columns === 2) {
                this.currentRendition?.spread('auto');
            } else {
                this.currentRendition?.spread('none');
            }
        }
    }, 500, true); // false ⇒ trailing; true ⇒ leading

    onResize(): void {
        this.debouncedResize();
    }


    private async renderEpubViewer() {
        const host = this.containerEl.children[1] as HTMLElement;
        host.empty();

        if (!this.epubUrl || !this.bookTitle) {
            host.createEl("div", {
                text: "No EPUB file specified",
                attr: { style: "text-align: center; padding: 20px; color: var(--text-muted);" }
            });
            return;
        }

        const { readerHost, loadingEl, topBar } = this.buildViewerShell(host);
        this.epubViewContainer = readerHost;
        this.topBar = topBar;
        try {
            await this.initializeEpubViewer(loadingEl);
        } catch (error) {
            console.error('Error loading EPUB:', error);
            loadingEl.setText(`Error loading EPUB: ${error.message}`);
        }
    }

    private async initializeEpubViewer(loadingEl: HTMLElement): Promise<void> {
        try {
            // Load book
            this.book = await this.loadBookFromUrl(this.epubUrl);

            // Remove loading
            loadingEl.remove();

            // Make rendition
            this.currentRendition = this.makeRendition();

            // Apply layout & show first page
            this.applyLayout();
            await this.currentRendition.display();

            // Theme/styles
            this.applyTheme();

            // Controls and listeners
            this.addNavigationControls();
            this.setupThemeChangeListener();

            if (this.topBar) await this.wireTopBar();

        } catch (error) {
            throw new Error(`Failed to initialize EPUB viewer: ${error.message}`);
        }
    }

    private addNavigationControls(): void {
        // Add navigation areas for paginated mode
        if (this.currentRendition)
            this.updateNavigationAreas(this.currentRendition);
    }

    private showSettingsModal(): void {
        const currentSettings: AppearanceSettings = {
            darkMode: { ...this.settings.darkMode },
            lightMode: { ...this.settings.lightMode },
            fontFamily: this.settings.fontFamily,
            fontSize: this.settings.fontSize,
            lineHeight: this.settings.lineHeight,
            flow: this.settings.flow,
            columns: this.settings.columns,
            padding: this.settings.padding,
            margin: this.settings.margin,
        };

        showAppearanceSettingsModal({
            settings: currentSettings,
            defaultSettings: { ...(DEFAULT_SETTINGS as unknown as AppearanceSettings) },
            onApply: (updated: AppearanceSettings) => {
                const prevFlow = this.settings.flow;
                const prevColumns = this.settings.columns;

                // Save new settings
                this.settings = { ...this.settings, ...updated };
                this.saveSettings();

                const flowChanged = prevFlow !== this.settings.flow;
                const columnsChanged = prevColumns !== this.settings.columns;

                // Preserve location
                const currentLocation: number | undefined = this.currentRendition?.location?.start.location;

                // Apply flow change
                if (flowChanged && this.currentRendition) {
                    this.currentRendition.flow(this.settings.flow);
                }

                // Apply spread for columns in paginated
                if (this.currentRendition && this.settings.flow === 'paginated') {
                    if (this.settings.columns === 2) this.currentRendition.spread('auto');
                    else this.currentRendition.spread('none');
                }

                // Restore location
                if ((flowChanged || columnsChanged) && currentLocation && this.currentRendition) {
                    setTimeout(() => {
                        const cfi = this.book?.locations.cfiFromLocation(currentLocation);
                        if (cfi) {
                            this.currentRendition?.display(cfi);
                            this.currentRendition?.display(currentLocation);
                        }
                    }, 100);
                }

                // Update nav areas
                if (this.currentRendition) {
                    this.updateNavigationAreas(this.currentRendition);
                }

                // Apply styles
                if (this.currentRendition) {
                    this.applySettingsToRendition(this.currentRendition);
                }
            },
            onReset: () => {
                const prevFlow = this.settings.flow;
                const prevColumns = this.settings.columns;

                this.settings = { ...DEFAULT_SETTINGS } as any;
                this.saveSettings();

                const flowChanged = prevFlow !== this.settings.flow;
                const columnsChanged = prevColumns !== this.settings.columns;
                const currentLocation = this.currentRendition?.location?.start?.location;

                if (flowChanged && this.currentRendition) {
                    this.currentRendition.flow(this.settings.flow);
                }
                if (this.currentRendition && this.settings.flow === 'paginated') {
                    if (this.settings.columns === 2) this.currentRendition.spread('auto');
                    else this.currentRendition.spread('none');
                }
                if ((flowChanged || columnsChanged) && currentLocation && this.currentRendition) {
                    setTimeout(() => this.currentRendition?.display(currentLocation), 100);
                }
                if (this.currentRendition) {
                    this.updateNavigationAreas(this.currentRendition);
                    this.applySettingsToRendition(this.currentRendition);
                }
            },
            onClose: () => { }
        });
    }

    private applySettingsToRendition(rendition: Rendition): void {
        if (!rendition) return;

        // Determine current theme
        const isDarkMode = document.body.classList.contains('theme-dark');
        const theme = isDarkMode ? this.settings.darkMode : this.settings.lightMode;

        // Create CSS content
        // const styleContent = `
        //     html, body {
        //         background: ${theme.backgroundColor} !important;
        //         color: ${theme.textColor} !important;
        //         font-family: ${this.getEffectiveFontFamily()} !important;
        //         font-size: ${this.settings.fontSize} !important;
        //         line-height: ${this.settings.lineHeight} !important;
        //         margin: ${this.settings.margin} !important;
        //     }

        //     * {
        //         color: ${theme.textColor} !important;
        //     }

        //     h1, h2, h3, h4, h5, h6 {
        //         color: ${theme.textColor} !important;
        //         font-family: ${this.getEffectiveFontFamily()} !important;
        //         margin-top: 1.5em !important;
        //         margin-bottom: 0.5em !important;
        //     }

        //     p, div, span {
        //         color: ${theme.textColor} !important;
        //         font-family: ${this.getEffectiveFontFamily()} !important;
        //         font-size: ${this.settings.fontSize} !important;
        //         line-height: ${this.settings.lineHeight} !important;
        //         margin-bottom: 1em !important;
        //     }

        //     a {
        //         color: ${theme.textColor} !important;
        //         text-decoration: underline !important;
        //     }

        //     a:hover {
        //         color: ${theme.textColor} !important;
        //         text-decoration: none !important;
        //     }
        // `;

        // Apply styles to the rendition
        rendition.themes.default({
            body: {
                'background': theme.backgroundColor,
                'color': theme.textColor,
                'font-family': this.getEffectiveFontFamily(),
                'font-size': this.settings.fontSize,
                'line-height': this.settings.lineHeight,
                'margin': this.settings.margin
            },
            'h1, h2, h3, h4, h5, h6': {
                'color': theme.textColor,
                'font-family': this.getEffectiveFontFamily()
            },
            'p, div, span': {
                'color': theme.textColor,
                'font-family': this.getEffectiveFontFamily(),
                'font-size': this.settings.fontSize,
                'line-height': this.settings.lineHeight
            }
        });

        // Apply spread setting for columns
        if (this.settings.flow === 'paginated') {
            if (this.settings.columns === 2) {
                rendition.spread('auto');
            } else {
                rendition.spread('none');
            }
        }

        // Update navigation areas if needed
        this.updateNavigationAreas(rendition);
    }

    private applyStylesToCurrentIframe(styleContent: string, theme: any): void {
        // Find the current iframe
        const currentIframe = document.querySelector('.epub-viewer-container iframe') as HTMLIFrameElement;
        if (currentIframe && currentIframe.contentDocument) {
            const iframe = currentIframe.contentDocument;

            // Remove existing style if present
            const existingStyle = iframe.head?.querySelector('#epub-custom-styles');
            if (existingStyle) {
                existingStyle.remove();
            }

            // Add new style
            if (iframe.head) {
                const newStyle = iframe.createElement('style');
                newStyle.id = 'epub-custom-styles';
                newStyle.textContent = styleContent;
                iframe.head.appendChild(newStyle);
            }

            // Apply styles to body element (without padding)
            if (iframe.body) {
                iframe.body.style.background = theme.backgroundColor;
                iframe.body.style.color = theme.textColor;
                iframe.body.style.fontFamily = this.getEffectiveFontFamily();
                iframe.body.style.fontSize = this.settings.fontSize;
                iframe.body.style.lineHeight = this.settings.lineHeight;
                iframe.body.style.margin = this.settings.margin;
                // iframe.body.style.padding = '0';
            }

            // Apply styles to html element as well
            if (iframe.documentElement) {
                iframe.documentElement.style.background = theme.backgroundColor;
                iframe.documentElement.style.color = theme.textColor;
            }
        }
    }

    private setupThemeChangeListener(): void {
        // Listen for theme changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Reapply settings when theme changes
                    if (this.currentRendition) {
                        setTimeout(() => {
                            if (this.currentRendition) {
                                this.applySettingsToRendition(this.currentRendition);
                            }
                        }, 100);
                    }
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    private showTableOfContents(toc: Navigation): void {
        // Create modal for table of contents
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); z-index: 2000; display: flex; 
            align-items: center; justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--background-primary); border: 1px solid var(--background-modifier-border); 
            border-radius: 8px; padding: 20px; max-width: 400px; max-height: 80vh; overflow-y: auto;
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">Table of Contents</h3>
            <div id="toc-list"></div>
            <button id="close-toc" style="margin-top: 15px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        `;

        const tocList = content.querySelector('#toc-list');
        if (toc && toc.toc) {
            toc.toc.forEach((item: any) => {
                const itemEl = document.createElement('div');
                itemEl.style.cssText = 'padding: 8px; cursor: pointer; border-bottom: 1px solid var(--background-modifier-border);';
                itemEl.textContent = item.label;
                itemEl.addEventListener('click', () => {
                    this.currentRendition?.display(item.href);
                    modal.remove();
                });
                tocList?.appendChild(itemEl);
            });
        }

        content.querySelector('#close-toc')?.addEventListener('click', () => {
            modal.remove();
        });

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    private updateNavigationAreas(rendition: Rendition): void {
        const container = this.epubViewContainer;
        if (!container) return;

        // Remove existing navigation areas
        const existingLeftNav = container.querySelector('.epub-nav-left');
        const existingRightNav = container.querySelector('.epub-nav-right');

        if (existingLeftNav) existingLeftNav.remove();
        if (existingRightNav) existingRightNav.remove();

        // Left navigation area
        const leftNav = container.createEl("div", {
            cls: "epub-nav-left"
        });

        // Add hover effect
        leftNav.addEventListener('mouseenter', () => {
            leftNav.style.backgroundColor = 'rgba(0,0,0,0.1)';
        });

        leftNav.addEventListener('mouseleave', () => {
            leftNav.style.backgroundColor = 'transparent';
        });

        // Add click handler
        leftNav.addEventListener('click', () => {
            rendition.prev();
        });

        // Right navigation area
        const rightNav = container.createEl("div", {
            cls: "epub-nav-right"
        });

        // Add hover effect
        rightNav.addEventListener('mouseenter', () => {
            rightNav.style.backgroundColor = 'rgba(0,0,0,0.1)';
        });

        rightNav.addEventListener('mouseleave', () => {
            rightNav.style.backgroundColor = 'transparent';
        });

        // Add click handler
        rightNav.addEventListener('click', () => {
            rendition.next();
        });

        // Workaround for scroll issue when mouse hovering on the navigators, the mouse scroll is not working
        if (this.settings.flow === 'scrolled') {
            leftNav.addEventListener('wheel', (e) => {
                e.preventDefault();
                container.querySelector('.epub-container')?.scrollBy({
                    top: e.deltaY,
                    behavior: 'auto' // Or 'smooth' if you like
                });
            }, { passive: false });

            rightNav.addEventListener('wheel', (e) => {
                e.preventDefault();
                container.querySelector('.epub-container')?.scrollBy({
                    top: e.deltaY,
                    behavior: 'auto' // Or 'smooth' if you like
                });
            }, { passive: false });
        }
    }

    // Compute effective font family with a safe fallback
    private getEffectiveFontFamily(): string {
        const configured = (this.settings.fontFamily || '').trim();
        if (!configured) return 'Arial, sans-serif';
        // If user already includes Arial or a generic family, keep as is
        if (/\barial\b/i.test(configured) || /\bserif\b|\bsans-serif\b|\bmonospace\b/i.test(configured)) {
            return configured;
        }
        return `${configured}, Arial, sans-serif`;
    }

    // Helpers
    private buildViewerShell(host: HTMLElement): { viewerContainer: HTMLElement; readerHost: HTMLElement; loadingEl: HTMLElement; topBar: EpubTopBar } {
        const viewerContainer = host.createEl("div", {
            cls: "epub-viewer-container",
            attr: {
                style: "width: 100%; height: calc(100vh - 100px); border: 1px solid var(--background-modifier-border); border-radius: 4px; display:flex; flex-direction:column; overflow:hidden;"
            }
        });
        const topBar = new EpubTopBar().attach(viewerContainer);

        // Reader host
        const readerHost = viewerContainer.createEl('div', { cls: 'epub-reader-host', attr: { style: 'flex:1 1 auto; position:relative; overflow:hidden; width:100%;' } });
        const loadingEl = readerHost.createEl('div', { text: 'Loading EPUB...', attr: { style: 'text-align:center; padding:20px; color:var(--text-muted);' } });
        return { viewerContainer, readerHost, loadingEl, topBar };
    }

    private async loadBookFromUrl(url: string): Promise<Book> {
        const res = await requestUrl({ url, method: "GET" });
        const arrayBuffer = res.arrayBuffer;
        const blob = new Blob([arrayBuffer], { type: "application/epub+zip" });
        const book: Book = new Book(blob as any, { openAs: 'binary', replacements: 'blobUrl' });
        await book.ready;
        console.log(book);
        return book;
    }

    private makeRendition(): Rendition {
        if (!this.book) throw new Error('Book not loaded');
        if (!this.epubViewContainer) throw new Error('Container not found');
        return this.book.renderTo(this.epubViewContainer, {
            flow: this.settings.flow,
            width: '100%',
            height: '100%'
        });
    }

    private applyLayout(): void {
        if (!this.currentRendition) {
            console.error('No rendition found, book should load & rendition should be made first before applyLayout');
            return;
        }

        if (this.settings.flow) this.currentRendition.flow(this.settings.flow);
        if (this.settings.flow === 'paginated') {
            if (this.settings.columns === 2) this.currentRendition.spread('auto');
            else this.currentRendition.spread('none');
        }
    }

    private applyTheme(): void {
        if (!this.currentRendition) {
            console.error('No rendition found, book should load & rendition should be made first before applyTheme');
            return;
        }
        this.applySettingsToRendition(this.currentRendition);
    }

    private async generateTotalPages(): Promise<number> {
        const locations = this.book?.locations;
        if (!locations) return 0;

        const pages = await locations.generate?.(1200)
        return pages.length;
    }

    private async wireTopBar() {

        if (!this.book || !this.currentRendition) {
            console.error('No book or rendition found, book should load & rendition should be made first before wireTopBar');
            return;
        }

        this.topBar.setHandlers({
            onTOC: async () => {
                const toc: Navigation | undefined = await this.book?.loaded?.navigation;
                if (toc) {
                    this.showTableOfContents(toc);
                }
            },
            onSettings: () => this.showSettingsModal(),
            onGoto: (page: number) => goToPage(page),
        });

        const locations = this.book?.locations;
        if (locations) {
            this.generateTotalPages()
                .then(total => {
                    this.topBar.setTotal(total);
                    const currentLocation: Location | null = this.currentRendition?.currentLocation() as unknown as Location | null;
                    if (currentLocation) {
                        this.topBar.setCurrent(currentLocation.start.location + 1);
                    }
                });
        }

        this.currentRendition?.on('relocated', (location: Location) => {
            this.topBar.setCurrent(location.start.location + 1);
        });

        const goToPage = (requested: number) => {
            const totalPages = this.topBar.getTotal();
            if (!locations || totalPages === 0) return;
            const page = Math.max(1, Math.min(totalPages, requested));

            const cfi = locations.cfiFromLocation(page - 1);
            if (cfi) {
                this.topBar.setCurrent(page);
                this.currentRendition?.display(cfi);
            }
        };
    }
}
