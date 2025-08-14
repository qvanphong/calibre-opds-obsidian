import { ItemView, WorkspaceLeaf, normalizePath, Notice, TFile } from 'obsidian';
import sanitize from 'sanitize-filename';
import PDFConflictModal from '../modal/conflict-modal';
import { getAvailablePath, getBookPathOrResourcePath } from '../utils/path-util';
import { getFormatDisplayName } from '../utils/name-utils';
import { CalibreWebPluginSettings, OPDSBook, OPDSBookFormat, OPDSCatalog, OPDSEntry, NavigationItem } from '../interfaces';
import { OPDSClient } from '../opds';

export const VIEW_TYPE_CALIBRE = "calibre-web-view";


export class CalibreWebView extends ItemView {
    private navigationStack: NavigationItem[] = [];
    private currentContainer: HTMLElement | null = null;
    private opdsClient: OPDSClient;
    private settings: CalibreWebPluginSettings;

    constructor(leaf: WorkspaceLeaf, settings: CalibreWebPluginSettings) {
        super(leaf);
        this.settings = settings;
        this.opdsClient = new OPDSClient(settings.address, settings.username, settings.password);
    }

    getViewType(): string {
        return VIEW_TYPE_CALIBRE;
    }

    getDisplayText(): string {
        return "Calibre-web OPDS";
    }

    getIcon(): string {
        return "book-open";
    }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        this.currentContainer = container;
        await this.loadMainCatalog();
    }

    async onClose() {
        this.navigationStack = [];
        this.currentContainer = null;
    }

    // ===== MAIN LOADING METHODS =====

    private async loadMainCatalog() {
        if (!this.currentContainer) return;

        this.clearContainer();
        this.createHeader("Calibre-web OPDS Catalog");
        
        const loadingEl = this.showLoading("Loading OPDS catalog...");

        try {
            const entry: OPDSEntry = await this.opdsClient.getEntry();
            loadingEl.remove();

            // Initialize navigation stack
            this.navigationStack = [{
                title: "Main Catalog",
                url: this.opdsClient.getOpdsUrl(),
                type: 'catalogs',
                data: entry
            }];
            this.displayCatalogsOrBooks(entry);

        } catch (error) {
            console.error('Error fetching OPDS feed:', error);
            loadingEl.setText(`Error loading OPDS catalog: ${error.message}`);
        }
    }

    private async goToCatalog(catalog: OPDSCatalog) {
        if (!this.currentContainer) return;

        this.clearContainer();
        this.createHeader(catalog.title, true);
        
        const loadingEl = this.showLoading("Loading...");

        try {
            const entry: OPDSEntry = await this.opdsClient.getEntry(catalog.href);
            loadingEl.remove();

            // Add to navigation stack
            this.navigationStack.push({
                title: catalog.title,
                url: catalog.href,
                type: 'books',
                data: entry
            });

            this.displayCatalogsOrBooks(entry);

        } catch (error) {
            console.error('Error fetching category:', error);
            loadingEl.setText(`Error loading category: ${error.message}`);
        }
    }

    // ===== DISPLAY METHODS =====

    private displayCatalogsOrBooks(entry: OPDSEntry) {
        if (!this.currentContainer) return;

        let hasContent = false;

        // Display subcategories first
        if (entry.catalogs.length > 0) {
            hasContent = true;
            this.displayCategories(entry.catalogs);
            return;
        }

        // Display books
        if (entry.books.length > 0) {
            hasContent = true;
            this.displayBooks(entry.books);
            return;
        }

        if (!hasContent) {
            this.currentContainer.createEl("p", { text: "No content found in this category." });
        }
    }

    private displayCategories(categories: OPDSCatalog[]) {
        if (!this.currentContainer) return;

        if (categories.length === 0) {
            this.currentContainer.createEl("p", { text: "No categories found in the OPDS feed." });
            return;
        }

        const categoriesContainer = this.currentContainer.createEl("div", { cls: "calibre-categories" });

        categories.forEach((category) => {
            const categoryEl = this.createCategoryElement(category);
            categoriesContainer.appendChild(categoryEl);
        });
    }

    private displayBooks(books: OPDSBook[]) {
        if (!this.currentContainer) return;

        const booksContainer = this.currentContainer.createEl("div", { cls: "calibre-books" });

        books.forEach((book) => {
            const bookEl = this.createBookElement(book);
            booksContainer.appendChild(bookEl);
        });
    }

    // ===== ELEMENT CREATION METHODS =====

    private createCategoryElement(category: OPDSCatalog): HTMLElement {
        const categoryEl = createEl("div", { cls: "calibre-category-item" });

        categoryEl.createEl("h5", { text: category.title, cls: "calibre-category-title" });

        if (category.bookCount !== undefined && category.bookCount > 0) {
            categoryEl.createEl("small", { 
                text: `${category.bookCount} books`, 
                cls: "calibre-book-count" 
            });
        }

        categoryEl.addEventListener('click', () => {
            this.goToCatalog(category);
        });

        return categoryEl;
    }

    private createBookElement(book: OPDSBook): HTMLElement {
        const bookEl = createEl("div", { cls: "calibre-book-item" });

        // Thumbnail container
        const thumbnailContainer = bookEl.createEl("div", { cls: "calibre-book-thumbnail" });
        
        if (book.thumbnailUrl) {
            const thumbnail = thumbnailContainer.createEl("img", {
                cls: "calibre-book-cover",
                attr: {
                    src: book.thumbnailUrl,
                    alt: `Cover of ${book.title}`,
                    loading: "lazy"
                }
            });
            // Add error handling for broken images
            thumbnail.addEventListener('error', () => {
                thumbnail.style.display = 'none';
                thumbnailContainer.createEl("div", {
                    cls: "calibre-book-cover-placeholder",
                    text: "📖"
                });
            });
        } else {
            // Placeholder when no thumbnail available
            thumbnailContainer.createEl("div", {
                cls: "calibre-book-cover-placeholder",
                text: "📖"
            });
        }

        // Content container (right side)
        const contentContainer = bookEl.createEl("div", { cls: "calibre-book-content" });

        // Title
        contentContainer.createEl("h5", { text: book.title, cls: "calibre-book-title" });

        // Author
        if (book.author) {
            contentContainer.createEl("p", { 
                text: `Author: ${book.author}`, 
                cls: "calibre-book-author" 
            });
        }

        // Summary
        if (book.summary) {
            this.addBookSummary(contentContainer, book.summary);
        }

        // Formats
        if (book.formats.length > 0) {
            this.addBookFormats(contentContainer, book);
        }

        return bookEl;
    }

    // ===== HELPER METHODS FOR BOOK DETAILS =====

    private addBookSummary(bookEl: HTMLElement, summary: string) {
        const fullSummary = summary;
        const truncatedSummary = fullSummary.length > 200 ? 
            fullSummary.substring(0, 200) + '...' : fullSummary;
        const isTruncated = fullSummary.length > 200;

        const summaryEl = bookEl.createEl("p", {
            text: truncatedSummary,
            cls: "calibre-book-summary"
        });

        if (isTruncated) {
            const readMoreBtn = summaryEl.createEl("span", { 
                text: "Read more", 
                cls: "calibre-read-more-btn" 
            });
            readMoreBtn.addEventListener('click', () => {
                summaryEl.textContent = fullSummary;
            });
        }
    }

    private addBookFormats(bookEl: HTMLElement, book: OPDSBook) {
        bookEl.createEl("p", { text: "Formats:", cls: "calibre-formats-label" });
        const formatsContainer = bookEl.createEl("div", { cls: "calibre-formats" });

        // Sort formats to prioritize PDF
        const sortedFormats = [...book.formats].sort((a, b) => {
            if (a.type === 'application/pdf') return -1;
            if (b.type === 'application/pdf') return 1;
            return 0;
        });

        sortedFormats.forEach((format) => {
            const formatEl = this.createFormatButton(format, book.title);
            formatsContainer.appendChild(formatEl);
        });
    }

    private createFormatButton(format: OPDSBookFormat, bookTitle: string): HTMLElement {
        const buttonText = 'View in ' + getFormatDisplayName(format.type);
        const isPdf = format.type === 'application/pdf';
        
        const formatEl = createEl("p", { 
            text: buttonText, 
            cls: `calibre-format-btn ${isPdf ? 'calibre-format-btn-pdf' : 'calibre-format-btn-default'}`,
            attr: { href: format.href }
        });

        formatEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openFormat(format, bookTitle);
        });

        return formatEl;
    }

    // ===== UI HELPER METHODS =====

    private clearContainer() {
        if (this.currentContainer) {
            this.currentContainer.empty();
        }
    }

    private createHeader(title: string, showBackButton = false) {
        if (!this.currentContainer) return;

        const headerEl = this.currentContainer.createEl("div", { cls: "calibre-header" });

        if (showBackButton) {
            const backBtn = headerEl.createEl("button", { 
                text: "← Back", 
                cls: "calibre-back-btn" 
            });
            backBtn.addEventListener('click', () => {
                this.goBack();
            });
        }

        headerEl.createEl("h4", { text: title });
    }

    private showLoading(message: string): HTMLElement {
        if (!this.currentContainer) {
            return createEl("div", {
                cls: "loader"
            });
        }
        
        const loaderContainer = this.currentContainer.createEl("div", {cls: "loader-container" });
        loaderContainer.createEl("div", {cls: "loader"});

        return loaderContainer;
    }

    // ===== NAVIGATION =====

    private goBack() {
        if (this.navigationStack.length <= 1 || !this.currentContainer) return;

        // Remove current page from stack
        this.navigationStack.pop();

        // Get previous page
        const previousPage = this.navigationStack[this.navigationStack.length - 1];

        this.clearContainer();
        this.createHeader(previousPage.title, this.navigationStack.length > 1);
        this.displayCatalogsOrBooks(previousPage.data);
    }

    // ===== FILE HANDLING METHODS =====

    private async openFormat(format: OPDSBookFormat, bookTitle: string) {
        const downloadUrl = this.opdsClient.getBasicAuthenticatedBaseUrl() + format.href;

        if (format.type === 'application/pdf') {
            await this.openPDFInObsidian(downloadUrl, bookTitle);
        } else if (format.type === 'application/epub+zip') {
            await this.openEPUBInObsidian(downloadUrl, bookTitle, format);
        } else {
            window.open(format.href, '_blank');
        }
    }

    private async openPDFInObsidian(pdfUrl: string, bookTitle: string) {
        try {
            const sanitizedBookTitle = sanitize(bookTitle);
            const fileName = sanitizedBookTitle + '.pdf';
            const folderPath = getBookPathOrResourcePath(this.settings, this.app);
            
            const folderExists = !!(this.app.vault.getFolderByPath(folderPath));
            if (!folderExists) {
                await this.app.vault.createFolder(folderPath);
            }

            const filePath = normalizePath(folderPath + '/' + fileName);
            const leaf = this.app.workspace.getLeaf('tab');

            // Check if file exists
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile) {
                // Prompt user for action
                new PDFConflictModal(this.app, fileName, async (action) => {
                    let fileToOpen: TFile = existingFile as TFile;
                    
                    if (action === 'cancel') {
                        return;
                    } else if (action === 'overwrite') {
                        await this.app.vault.modify(existingFile as TFile, pdfUrl);
                        new Notice('File overwritten.');
                    } else if (action === 'newname') {
                        const newFilePath = getAvailablePath(filePath, this.app);
                        const newFile = await this.app.vault.create(newFilePath, pdfUrl);
                        fileToOpen = newFile as TFile;
                        new Notice('File created with new name.');
                    }

                    await leaf.openFile(fileToOpen as TFile);
                }).open();
                return;
            } else {
                // File does not exist, create it
                const newFile = await this.app.vault.create(filePath, pdfUrl);
                await leaf.openFile(newFile as TFile);
            }

        } catch (error) {
            console.error('Error opening PDF in Obsidian:', error);
            window.open(pdfUrl, '_blank');
        }
    }

    private async openEPUBInObsidian(epubUrl: string, bookTitle: string, format: OPDSBookFormat) {
        try {
            const leaf = this.app.workspace.getLeaf('tab');
            if (leaf) {
                await leaf.setViewState({
                    type: 'epub-viewer',
                    state: {
                        epubUrl: epubUrl,
                        bookTitle: bookTitle,
                        format: format
                    },
                    active: true,
                });
                this.app.workspace.revealLeaf(leaf);
            }
        } catch (error) {
            console.error('Error opening EPUB in Obsidian:', error);
            window.open(epubUrl, '_blank');
        }
    }
}