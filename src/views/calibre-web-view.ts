import { ItemView, WorkspaceLeaf, normalizePath, Notice, TFile } from 'obsidian';
import sanitize from 'sanitize-filename';
import PDFConflictModal from '../modal/conflict-modal';
import { getAvailablePath, getBookPathOrResourcePath } from '../utils/path-util';
import { getFormatDisplayName } from '../utils/name-utils';
import { CalibreWebPluginSettings, OPDSBook, OPDSCategory } from '../types';
import { OPDSClient } from '../opds';


export const VIEW_TYPE_CALIBRE = "calibre-web-view";

export class CalibreWebView extends ItemView {
    private navigationStack: Array<{ title: string, url: string, content: OPDSCategory[] | { books: OPDSBook[], subcategories: OPDSCategory[] } }> = [];
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
        await this.loadMainCatalog(container);
    }

    private async loadMainCatalog(container: HTMLElement) {
        container.empty();

        // Add header with title
        const headerEl = container.createEl("div", { cls: "calibre-header" });
        headerEl.createEl("h4", { text: "Calibre-web OPDS Catalog" });

        // Show loading state
        const loadingEl = container.createEl("div", { text: "Loading OPDS catalog..." });

        try {
            const categories = await this.opdsClient.getCatalog();

            // Remove loading message
            loadingEl.remove();

            // Store in navigation stack
            this.navigationStack = [{ title: "Main Catalog", url: this.opdsClient.getCatalogUrl(), content: categories }];

            // Display categories
            this.displayCategories(container, categories);

        } catch (error) {
            console.error('Error fetching OPDS feed:', error);
            loadingEl.setText(`Error loading OPDS catalog: ${error.message}`);
        }
    }

    private displayCategories(container: HTMLElement, categories: OPDSCategory[]) {
        if (categories.length === 0) {
            container.createEl("p", { text: "No categories found in the OPDS feed." });
            return;
        }

        const categoriesContainer = container.createEl("div", { cls: "calibre-categories" });

        categories.forEach((category) => {
            const categoryEl = categoriesContainer.createEl("div", { cls: "calibre-category-item" });

            categoryEl.createEl("h5", { text: category.title, cls: "calibre-category-title" });

            if (category.bookCount !== undefined && category.bookCount > 0) {
                categoryEl.createEl("small", { text: `${category.bookCount} books`, cls: "calibre-book-count" });
            }

            // Add click handler to open category
            categoryEl.addEventListener('click', () => {
                this.openCategory(category);
            });
        });
    }

    private displayBooks(container: HTMLElement, books: OPDSBook[], subcategories: OPDSCategory[], categoryTitle: string) {
        let hasContent = false;

        // Display subcategories first if they exist
        if (subcategories.length > 0) {
            hasContent = true;
            container.createEl("h5", { text: "Subcategories", cls: "calibre-section-title" });

            const subcategoriesContainer = container.createEl("div", { cls: "calibre-subcategories" });

            subcategories.forEach((subcategory) => {
                const subcategoryEl = subcategoriesContainer.createEl("div", { cls: "calibre-subcategory-item" });

                subcategoryEl.createEl("span", { text: subcategory.title, cls: "calibre-subcategory-title" });

                // Add click handler to open subcategory
                subcategoryEl.addEventListener('click', () => {
                    this.openCategory(subcategory);
                });
            });
        }

        // Display books if they exist
        if (books.length > 0) {
            hasContent = true;
            container.createEl("h5", { text: "Books", cls: "calibre-section-title" });

            const booksContainer = container.createEl("div", { cls: "calibre-books" });

            books.forEach((book) => {
                const bookEl = booksContainer.createEl("div", { cls: "calibre-book-item" });

                bookEl.createEl("h5", { text: book.title, cls: "calibre-book-title" });

                if (book.author) {
                    bookEl.createEl("p", { text: `Author: ${book.author}`, cls: "calibre-book-author" });
                }

                if (book.summary) {
                    const fullSummary = book.summary;
                    const truncatedSummary = fullSummary.length > 200 ? fullSummary.substring(0, 200) + '...' : fullSummary;
                    const isTruncated = fullSummary.length > 200;

                    const summaryEl = bookEl.createEl("p", {
                        text: truncatedSummary,
                        cls: "calibre-book-summary"
                    });

                    if (isTruncated) {
                        const readMoreBtn = summaryEl.createEl("span", { text: "Read more", cls: "calibre-read-more-btn" });
                        readMoreBtn.addEventListener('click', () => {
                            summaryEl.textContent = fullSummary;
                        });
                    }
                }

                if (book.formats.length > 0) {
                    bookEl.createEl("p", { text: "Formats:", cls: "calibre-formats-label" });
                    const formatsContainer = bookEl.createEl("div", { cls: "calibre-formats" });
                    book.formats.sort((a, b) => {
                        if (a.type === 'application/pdf') return -1;
                        if (b.type === 'application/pdf') return 1;
                        return 0;
                    });
                    book.formats.forEach((format) => {
                        const buttonText = 'View in ' + getFormatDisplayName(format.type);
                        const isPdf = format.type === 'application/pdf';
                        const formatEl = formatsContainer.createEl("a", { 
                            text: buttonText, 
                            cls: `calibre-format-btn ${isPdf ? 'calibre-format-btn-pdf' : 'calibre-format-btn-default'}`,
                            attr: { href: format.href }
                        });
                        formatEl.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.openFormat(format, book.title);
                        });
                    });
                }
            });
        }

        if (!hasContent) {
            container.createEl("p", { text: "No content found in this category." });
        }
    }

    private async openCategory(category: OPDSCategory) {
        if (!this.currentContainer) return;

        this.currentContainer.empty();

        // Add back button and header
        const headerEl = this.currentContainer.createEl("div", { cls: "calibre-header" });
        const backBtn = headerEl.createEl("button", { text: "← Back", cls: "calibre-back-btn" });

        backBtn.addEventListener('click', () => {
            this.goBack();
        });

        headerEl.createEl("h4", { text: category.title });

        // Show loading state
        const loadingEl = this.currentContainer.createEl("div", { text: "Loading books..." });

        try {
            const { books, subcategories } = await this.opdsClient.getCategory(category.href);

            // Remove loading message
            loadingEl.remove();

            // Add to navigation stack
            this.navigationStack.push({ title: category.title, url: category.href, content: { books, subcategories } });

            // Display books
            this.displayBooks(this.currentContainer, books, subcategories, category.title);

        } catch (error) {
            console.error('Error fetching category:', error);
            loadingEl.setText(`Error loading category: ${error.message}`);
        }
    }

    private goBack() {
        if (this.navigationStack.length <= 1 || !this.currentContainer) return;

        // Remove current page from stack
        this.navigationStack.pop();

        // Get previous page
        const previousPage = this.navigationStack[this.navigationStack.length - 1];

        this.currentContainer.empty();

        if (previousPage.title === "Main Catalog") {
            // Go back to main catalog
            this.displayCategories(this.currentContainer, previousPage.content as OPDSCategory[]);
        } else {
            // Go back to previous category
            const content = previousPage.content as { books: OPDSBook[], subcategories: OPDSCategory[] };
            this.displayBooks(this.currentContainer, content.books, content.subcategories, previousPage.title);
        }
    }

    async onClose() {
        // Clean up when the view is closed
        this.navigationStack = [];
        this.currentContainer = null;
    }

    private async openPDFInObsidian(pdfUrl: string, bookTitle: string) {
        try {
            const santiizedBookTitle = sanitize(bookTitle);
            const fileName = santiizedBookTitle + '.pdf';
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
            // Fallback to external browser
            window.open(pdfUrl, '_blank');
        }
    }

    private async openFormat(format: { type: string, href: string, title?: string }, bookTitle: string) {
        const downloadUrl = this.opdsClient.getauthenticatedBaseUrl() + format.href;

        if (format.type === 'application/pdf') {
            // For PDFs, try to open in Obsidian first
            await this.openPDFInObsidian(downloadUrl, bookTitle);
        } else if (format.type === 'application/epub+zip') {
            // For EPUBs, open in EPUB viewer
            await this.openEPUBInObsidian(downloadUrl, bookTitle);
        } else {
            // For other formats, open in external browser
            window.open(format.href, '_blank');
        }
    }

    private async openEPUBInObsidian(epubUrl: string, bookTitle: string) {
        try {
            // Create a new leaf for the EPUB viewer
            const leaf = this.app.workspace.getLeaf('tab');
            if (leaf) {
                await leaf.setViewState({
                    type: 'epub-viewer',
                    state: {
                        epubUrl: epubUrl,
                        bookTitle: bookTitle
                    },
                    active: true,
                });
                this.app.workspace.revealLeaf(leaf);
            }
        } catch (error) {
            console.error('Error opening EPUB in Obsidian:', error);
            // Fallback to external browser
            window.open(epubUrl, '_blank');
        }
    }
}