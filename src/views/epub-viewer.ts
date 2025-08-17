import { debounce, ItemView, requestUrl, WorkspaceLeaf } from 'obsidian';
import { Book, Location, Rendition } from 'epubjs';
import { showAppearanceSettingsModal, AppearanceSettings } from '../modal/appearance-settings-modal';
import { EpubTopBar } from './epub-top-bar';
import Navigation from 'epubjs/types/navigation';
import { Plugin } from 'obsidian';
import { EPUBViewerSettings, OPDSBookFormat } from '../interfaces';
import { hashArrayBuffer } from 'src/utils/crypto';

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
    private plugin: Plugin;

    private bookUrl = '';
    private bookTitle = '';
    private format: OPDSBookFormat | null = null;
    private settings: EPUBViewerSettings = { ...DEFAULT_SETTINGS };
    private currentRendition: Rendition | null = null;
    private book?: Book;
    private bookHash?: string;

    private topBar: EpubTopBar;
    private epubView?: HTMLElement;
    private epubContainerView?: HTMLElement;
    private resizeObservers: ResizeObserver[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
        super(leaf);
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
        this.bookUrl = state.epubUrl || '';
        this.bookTitle = state.bookTitle || '';
        this.format = state.format || '';
        await super.setState(state, result);
        await this.renderEpubViewer();
    }

    async onOpen() {
        await this.renderEpubViewer();
    }

    async onClose() {
        // Cleanup if needed
        this.currentRendition = null;
        this.resizeObservers.forEach(observer => observer.disconnect());
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

        if (!this.bookUrl || !this.bookTitle) {
            host.createEl("div", { text: "No EPUB file specified", cls: "epub-empty-message" });
            return;
        }

        const { viewerContainer, readerHost, loadingEl, topBar } = this.buildViewerShell(host);
        this.epubContainerView = viewerContainer;
        this.epubView = readerHost;
        this.topBar = topBar;
        this.setupResizeObserver();
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
            this.book = await this.loadBookFromUrl();

            // Remove loading
            loadingEl.remove();

            // Make rendition
            this.currentRendition = this.makeRendition();
            this.initializeKeyboardControls();

            // Apply layout & show first page
            this.applyLayout();
            await this.loadLastReadingLocation();

            // Theme/styles
            this.applyAppearanceSetting();

            // Controls and listeners
            this.addNavigationControls();

            if (this.topBar) await this.wireTopBar();

        } catch (error) {
            throw new Error(`Failed to initialize EPUB viewer: ${error.message}`);
        }
    }
    initializeKeyboardControls() {
        const rendition = this.currentRendition;
        if (!rendition) return;

        const goToNextOrPrevPage = (event: KeyboardEvent) => {
            if (event.code == 'ArrowLeft') {
                this.toNextOrPrevPage('prev');
            }
            if (event.code == 'ArrowRight') {
                this.toNextOrPrevPage('next');
            }
        }

        document.addEventListener('keydown', goToNextOrPrevPage, false);
        rendition.on('keydown', goToNextOrPrevPage);
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

                // Apply styles
                this.applyAppearanceSetting();
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
                this.applyAppearanceSetting();
            },
            onClose: () => { }
        });
    }

    private applyAppearanceSetting(): void {
        const rendition = this.currentRendition
        // Determine current theme
        const isDarkMode = document.body.classList.contains('theme-dark');
        const theme = isDarkMode ? this.settings.darkMode : this.settings.lightMode;

        if (rendition) {
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
        }

        const epubView = this.epubView
        // Prevent flickering when switching pages
        if (epubView) {
            epubView.style.backgroundColor = theme.backgroundColor;
        }
    }

    private setupResizeObserver(): void {
        if (this.epubContainerView) {
            const epubContainerViewObserver: ResizeObserver = new ResizeObserver((entries) => {
                entries.forEach((entry) => {
                    const itemViewWidth: number = entry.contentRect.width;
                    if (itemViewWidth <= 650) {
                        if (!this.epubContainerView?.classList.contains('small-screen')) {
                            this.epubContainerView?.classList.add('small-screen');
                        }
                    } else {
                        this.epubContainerView?.classList.remove('small-screen');
                    }
                });
            });
            epubContainerViewObserver.observe(this.epubContainerView);
            this.resizeObservers.push(epubContainerViewObserver);
        }
    }

    private showTableOfContents(toc: Navigation): void {
        // Create modal for table of contents
        const modal = document.createElement('div');
        modal.className = 'epub-toc-modal';

        const content = document.createElement('div');
        content.className = 'epub-toc-content';

        content.innerHTML = `
            <h3 class="epub-toc-title">Table of Contents</h3>
            <div id="toc-list" class="epub-toc-list"></div>
            <button id="close-toc" class="epub-toc-close-btn">Close</button>
        `;

        const tocList = content.querySelector('#toc-list');
        if (toc && toc.toc) {
            toc.toc.forEach((item: { href: string; label: string }) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'epub-toc-item';
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
        const container = this.epubContainerView;
        if (!container) return;

        // Remove any existing arrows or legacy nav areas
        container.querySelector('.epub-arrow-left')?.remove();
        container.querySelector('.epub-arrow-right')?.remove();

        // Left arrow
        const leftArrow = container.createEl('div', {
            cls: 'epub-arrow epub-arrow-left',
            text: '‹'
        });
        leftArrow.addEventListener('click', () => this.toNextOrPrevPage('prev'));

        // Right arrow
        const rightArrow = container.createEl('div', {
            cls: 'epub-arrow epub-arrow-right',
            text: '›'
        });
        rightArrow.addEventListener('click', () => this.toNextOrPrevPage('next'));
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
        const viewerContainer = host.createEl("div", { cls: "epub-viewer-container" });
        const topBar = new EpubTopBar().attach(viewerContainer);

        // Reader host
        const readerHost = viewerContainer.createEl('div', { cls: 'epub-reader-host' });
        const loadingEl = readerHost.createEl('div', { text: 'Loading EPUB...', cls: 'epub-loading' });
        return { viewerContainer, readerHost, loadingEl, topBar };
    }

    private async loadBookFromUrl(): Promise<Book> {
        if (!this.bookUrl) {
            throw new Error('No book URL found');
        }

        const res = await requestUrl({ url: this.bookUrl, method: "GET" });
        const arrayBuffer = res.arrayBuffer;
        const blob = new Blob([arrayBuffer], { type: this.format?.type || "application/epub+zip" });
        const book: Book = new Book(blob as any, { openAs: 'binary', replacements: 'blobUrl' });
        await book.ready;

        // Hashing book array buffer to use as a local storage key
        this.bookHash = await hashArrayBuffer(arrayBuffer);

        return book;
    }

    private makeRendition(): Rendition {
        if (!this.book) throw new Error('Book not loaded');
        if (!this.epubView) throw new Error('Container not found');
        return this.book.renderTo(this.epubView, {
            flow: this.settings.flow,
            width: '100%',
            height: '100%',
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

        this.initBookLocations();

        this.currentRendition?.on('relocated', (location: Location) => {
            this.topBar.setCurrent(location.start.location + 1);
        });

        const goToPage = (requested: number) => {
            const totalPages = this.topBar.getTotal();
            const locations = this.book?.locations;

            if (!locations || totalPages === 0) return;
            const page = Math.max(1, Math.min(totalPages, requested));

            const cfi = locations.cfiFromLocation(page - 1);
            if (cfi) {
                this.topBar.setCurrent(page);
                this.currentRendition?.display(cfi);
            }
        };
    }

    private async initBookLocations(): Promise<void> {

        if (!this.book?.locations) return;

        if (!this.loadBookLocationsFromLocalStorage()) {
            await this.generateTotalPages()
            this.saveBookLocations();
        }

        const total = this.book.locations.length();
        this.topBar.setTotal(total);
        const currentLocation: Location | null = this.currentRendition?.currentLocation() as unknown as Location | null;
        if (currentLocation) {
            this.topBar.setCurrent(currentLocation.start.location + 1);
        }
    }

    private async generateTotalPages(): Promise<number> {
        const locations = this.book?.locations;
        if (!locations) return 0;

        const pages = await locations.generate?.(1200)
        return pages.length;
    }

    private loadBookLocationsFromLocalStorage(): boolean {
        if (!this.bookHash) return false;

        const bookLocations = localStorage.getItem(`${this.bookHash}-locations`);
        if (bookLocations) {
            this.book?.locations.load(JSON.parse(bookLocations));
            return true;
        }
        return false;
    }

    private saveBookLocations(): void {
        if (!this.bookHash) return;
        const bookLocations = this.book?.locations.save();
        localStorage.setItem(`${this.bookHash}-locations`, JSON.stringify(bookLocations));
    }

    private async toNextOrPrevPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.currentRendition?.next();
        } else {
            await this.currentRendition?.prev();
        }
        this.saveCurrentReadingLocation();
    }

    private saveCurrentReadingLocation(): void {
        if (!this.bookHash) return;
        // Don't know why typescript declared is as DisplayedLocation, but it's actually Location
        const currentLocation = this.currentRendition?.currentLocation() as unknown as Location;
        if (currentLocation) {
            localStorage.setItem(`${this.bookHash}-current-location`, currentLocation.start.cfi);
        }
    }

    private async loadLastReadingLocation(): Promise<void> {
        if (!this.bookHash) return;
        const lastReadingLocation = localStorage.getItem(`${this.bookHash}-current-location`);
        if (lastReadingLocation && lastReadingLocation !== 'null' && lastReadingLocation !== 'undefined') {
            this.currentRendition?.display(lastReadingLocation);
        } else {
            this.currentRendition?.display();
        }
    }
}
