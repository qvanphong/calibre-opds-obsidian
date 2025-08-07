import { ItemView, requestUrl, WorkspaceLeaf } from 'obsidian';
import { Book } from 'epubjs';

const VIEW_TYPE_EPUB = "epub-viewer";

interface EPUBViewerSettings {
    // Theme settings
    darkMode: {
        backgroundColor: string;
        textColor: string;
    };
    lightMode: {
        backgroundColor: string;
        textColor: string;
    };
    // Typography settings
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    // Layout settings
    flow: 'paginated' | 'scrolled';
    // Padding and margins
    padding: string;
    margin: string;
}

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
    padding: '20px',
    margin: '0'
};

export class EPUBViewer extends ItemView {
    private epubUrl = '';
    private bookTitle = '';
    private settings: EPUBViewerSettings = { ...DEFAULT_SETTINGS };
    private currentRendition: any = null;

    constructor(leaf: WorkspaceLeaf) {
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
        this.epubUrl = state.epubUrl || '';
        this.bookTitle = state.bookTitle || '';
        await super.setState(state, result);
        await this.renderEpub();
    }

    async onOpen() {
        await this.renderEpub();
    }

    private async renderEpub() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();

        if (!this.epubUrl || !this.bookTitle) {
            container.createEl("div", {
                text: "No EPUB file specified",
                attr: { style: "text-align: center; padding: 20px; color: var(--text-muted);" }
            });
            return;
        }
        // Create EPUB viewer container
        const viewerContainer = container.createEl("div", {
            cls: "epub-viewer-container",
            attr: {
                style: "width: 100%; height: calc(100vh - 100px); border: 1px solid var(--background-modifier-border); border-radius: 4px; position: relative;"
            }
        });

        // Show loading state
        const loadingEl = viewerContainer.createEl("div", {
            text: "Loading EPUB...",
            attr: { style: "text-align: center; padding: 20px; color: var(--text-muted);" }
        });

        try {
            // Load epub.js dynamically
            // await this.loadEpubJS();

            // Initialize EPUB viewer
            await this.initializeEpubViewer(viewerContainer, loadingEl);
        } catch (error) {
            console.error('Error loading EPUB:', error);
            loadingEl.setText(`Error loading EPUB: ${error.message}`);
        }
    }

    private async initializeEpubViewer(container: HTMLElement, loadingEl: HTMLElement): Promise<void> {
        try {
            // Since we can't get the book directly from 
            const res = await requestUrl({ url: this.epubUrl, method: "GET" });
            const arrayBuffer = res.arrayBuffer;
            const blob = new Blob([arrayBuffer], { type: "application/epub+zip" });

            // Create EPUB book instance
            const book = new Book(blob as any, {openAs: 'binary', replacements: 'blobUrl'});
            // const book = ePub(objectUrl);

            // Wait for book to be ready
            await book.ready;
            // await book.resources.replacements();
            book.loaded.resources.then((resou) => {
                console.log(resou);
            })

            // Remove loading element
            loadingEl.remove();

            // Create rendition with settings
            const rendition = book.renderTo(container, {
                width: '100%',
                height: '100%',
                flow: this.settings.flow
            });

            // Store the current rendition
            this.currentRendition = rendition;

            // Display first page
            await rendition.display();

            // Apply current settings
            this.applySettingsToRendition(rendition);

            // Set up the rendered event listener for future page changes
            rendition.on('rendered', (section: any, view: any) => {
                const iframe = view.document;
                if (iframe && iframe.head) {
                    // Apply current settings to newly rendered pages
                    const isDarkMode = document.body.classList.contains('theme-dark');
                    const theme = isDarkMode ? this.settings.darkMode : this.settings.lightMode;
                    
                    const styleContent = `
                        html, body {
                            background: ${theme.backgroundColor} !important;
                            color: ${theme.textColor} !important;
                            font-family: ${this.settings.fontFamily} !important;
                            font-size: ${this.settings.fontSize} !important;
                            line-height: ${this.settings.lineHeight} !important;
                            margin: ${this.settings.margin} !important;
                            padding: ${this.settings.padding} !important;
                        }

                        * {
                            color: ${theme.textColor} !important;
                        }

                        h1, h2, h3, h4, h5, h6 {
                            color: ${theme.textColor} !important;
                            font-family: ${this.settings.fontFamily} !important;
                            margin-top: 1.5em !important;
                            margin-bottom: 0.5em !important;
                        }

                        p, div, span {
                            color: ${theme.textColor} !important;
                            font-family: ${this.settings.fontFamily} !important;
                            font-size: ${this.settings.fontSize} !important;
                            line-height: ${this.settings.lineHeight} !important;
                            margin-bottom: 1em !important;
                        }

                        a {
                            color: ${theme.textColor} !important;
                            text-decoration: underline !important;
                        }

                        a:hover {
                            color: ${theme.textColor} !important;
                            text-decoration: none !important;
                        }
                    `;

                    const existingStyle = iframe.head.querySelector('#epub-custom-styles');
                    if (existingStyle) {
                        existingStyle.remove();
                    }

                    const newStyle = iframe.createElement('style');
                    newStyle.id = 'epub-custom-styles';
                    newStyle.textContent = styleContent;
                    iframe.head.appendChild(newStyle);

                    if (iframe.body) {
                        iframe.body.style.background = theme.backgroundColor;
                        iframe.body.style.color = theme.textColor;
                        iframe.body.style.fontFamily = this.settings.fontFamily;
                        iframe.body.style.fontSize = this.settings.fontSize;
                        iframe.body.style.lineHeight = this.settings.lineHeight;
                        iframe.body.style.margin = this.settings.margin;
                        iframe.body.style.padding = this.settings.padding;
                    }

                    if (iframe.documentElement) {
                        iframe.documentElement.style.background = theme.backgroundColor;
                        iframe.documentElement.style.color = theme.textColor;
                    }
                }
            });

            // Add navigation controls
            this.addNavigationControls(container, rendition, book);

            // Set up theme change listener
            this.setupThemeChangeListener();

        } catch (error) {
            throw new Error(`Failed to initialize EPUB viewer: ${error.message}`);
        }
    }

    private addNavigationControls(container: HTMLElement, rendition: any, book: any): void {
        const controlsEl = container.createEl("div", {
            cls: "epub-controls",
            attr: {
                style: "position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 8px; display: flex; gap: 8px; z-index: 1000;"
            }
        });

        // Previous button
        const prevBtn = controlsEl.createEl("button", {
            text: "← Previous",
            attr: {
                style: "background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 4px 8px; border-radius: 3px; cursor: pointer;"
            }
        });
        prevBtn.addEventListener('click', () => {
            rendition.prev();
        });

        // Next button
        const nextBtn = controlsEl.createEl("button", {
            text: "Next →",
            attr: {
                style: "background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 4px 8px; border-radius: 3px; cursor: pointer;"
            }
        });
        nextBtn.addEventListener('click', () => {
            rendition.next();
        });

        // Table of contents button
        const tocBtn = controlsEl.createEl("button", {
            text: "TOC",
            attr: {
                style: "background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 4px 8px; border-radius: 3px; cursor: pointer;"
            }
        });
        tocBtn.addEventListener('click', async () => {
            const toc = await book.loaded.navigation;
            this.showTableOfContents(toc, rendition);
        });

        // Settings button
        const settingsBtn = controlsEl.createEl("button", {
            text: "⚙️",
            attr: {
                style: "background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 14px;"
            }
        });
        settingsBtn.addEventListener('click', () => {
            this.showSettingsModal(rendition);
        });
    }

    private showSettingsModal(rendition: any): void {
        // Create modal for settings
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); z-index: 2000; display: flex; 
            align-items: center; justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--background-primary); border: 1px solid var(--background-modifier-border); 
            border-radius: 8px; padding: 20px; max-width: 600px; max-height: 80vh; overflow-y: auto;
            color: var(--text-normal);
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: var(--text-normal);">EPUB Viewer Settings</h3>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Dark Mode</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <label style="color: var(--text-normal);">Background Color:</label>
                    <input type="color" id="dark-bg" value="${this.settings.darkMode.backgroundColor}" style="width: 100%;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <label style="color: var(--text-normal);">Text Color:</label>
                    <input type="color" id="dark-text" value="${this.settings.darkMode.textColor}" style="width: 100%;">
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Light Mode</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <label style="color: var(--text-normal);">Background Color:</label>
                    <input type="color" id="light-bg" value="${this.settings.lightMode.backgroundColor}" style="width: 100%;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <label style="color: var(--text-normal);">Text Color:</label>
                    <input type="color" id="light-text" value="${this.settings.lightMode.textColor}" style="width: 100%;">
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Typography</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <label style="color: var(--text-normal);">Font Family:</label>
                    <select id="font-family" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
                        <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" ${this.settings.fontFamily.includes('Segoe UI') ? 'selected' : ''}>System Default</option>
                        <option value="Georgia, serif" ${this.settings.fontFamily.includes('Georgia') ? 'selected' : ''}>Georgia</option>
                        <option value="'Times New Roman', serif" ${this.settings.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman</option>
                        <option value="Arial, sans-serif" ${this.settings.fontFamily.includes('Arial') ? 'selected' : ''}>Arial</option>
                        <option value="'Courier New', monospace" ${this.settings.fontFamily.includes('Courier') ? 'selected' : ''}>Courier New</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <label style="color: var(--text-normal);">Font Size:</label>
                    <input type="text" id="font-size" value="${this.settings.fontSize}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <label style="color: var(--text-normal);">Line Height:</label>
                    <input type="text" id="line-height" value="${this.settings.lineHeight}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Layout</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <label style="color: var(--text-normal);">Flow Mode:</label>
                    <select id="flow-mode" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
                        <option value="paginated" ${this.settings.flow === 'paginated' ? 'selected' : ''}>Paginated</option>
                        <option value="scrolled" ${this.settings.flow === 'scrolled' ? 'selected' : ''}>Scrolled</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <label style="color: var(--text-normal);">Padding:</label>
                    <input type="text" id="padding" value="${this.settings.padding}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <label style="color: var(--text-normal);">Margin:</label>
                    <input type="text" id="margin" value="${this.settings.margin}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
                </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button id="reset-settings" style="background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 8px 16px; border-radius: 4px; cursor: pointer;">Reset to Default</button>
                <button id="apply-settings" style="background: var(--interactive-accent); color: var(--text-on-accent); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Apply Settings</button>
                <button id="close-settings" style="background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        `;

        // Add event listeners
        content.querySelector('#apply-settings')?.addEventListener('click', () => {
            this.applySettingsFromModal(content);
            this.saveSettings();
            
            // Check if flow mode changed
            const flowMode = (content.querySelector('#flow-mode') as HTMLSelectElement)?.value as 'paginated' | 'scrolled';
            const flowModeChanged = flowMode && flowMode !== this.settings.flow;
            
            if (flowModeChanged) {
                // Show a message that flow mode change requires re-rendering
                const message = document.createElement('div');
                message.style.cssText = `
                    position: fixed; top: 20px; right: 20px; 
                    background: var(--background-primary); 
                    border: 1px solid var(--background-modifier-border); 
                    border-radius: 4px; padding: 10px; 
                    color: var(--text-normal); z-index: 3000;
                `;
                message.textContent = 'Flow mode changed. Page will reload to apply changes.';
                document.body.appendChild(message);
                
                // Remove message after 3 seconds
                setTimeout(() => {
                    message.remove();
                }, 3000);
            }
            
            this.applySettingsToRendition(rendition);
            modal.remove();
        });

        content.querySelector('#reset-settings')?.addEventListener('click', () => {
            this.settings = { ...DEFAULT_SETTINGS };
            this.saveSettings();
            this.applySettingsToRendition(rendition);
            modal.remove();
        });

        content.querySelector('#close-settings')?.addEventListener('click', () => {
            modal.remove();
        });

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    private applySettingsFromModal(content: HTMLElement): void {
        // Dark mode settings
        const darkBg = (content.querySelector('#dark-bg') as HTMLInputElement)?.value;
        const darkText = (content.querySelector('#dark-text') as HTMLInputElement)?.value;
        if (darkBg) this.settings.darkMode.backgroundColor = darkBg;
        if (darkText) this.settings.darkMode.textColor = darkText;

        // Light mode settings
        const lightBg = (content.querySelector('#light-bg') as HTMLInputElement)?.value;
        const lightText = (content.querySelector('#light-text') as HTMLInputElement)?.value;
        if (lightBg) this.settings.lightMode.backgroundColor = lightBg;
        if (lightText) this.settings.lightMode.textColor = lightText;

        // Typography settings
        const fontFamily = (content.querySelector('#font-family') as HTMLSelectElement)?.value;
        const fontSize = (content.querySelector('#font-size') as HTMLInputElement)?.value;
        const lineHeight = (content.querySelector('#line-height') as HTMLInputElement)?.value;
        if (fontFamily) this.settings.fontFamily = fontFamily;
        if (fontSize) this.settings.fontSize = fontSize;
        if (lineHeight) this.settings.lineHeight = lineHeight;

        // Layout settings
        const flowMode = (content.querySelector('#flow-mode') as HTMLSelectElement)?.value as 'paginated' | 'scrolled';
        const padding = (content.querySelector('#padding') as HTMLInputElement)?.value;
        const margin = (content.querySelector('#margin') as HTMLInputElement)?.value;
        
        // Check if flow mode changed
        const flowModeChanged = flowMode && flowMode !== this.settings.flow;
        
        if (flowMode) this.settings.flow = flowMode;
        if (padding) this.settings.padding = padding;
        if (margin) this.settings.margin = margin;

        // If flow mode changed, we need to re-render (this is unavoidable)
        if (flowModeChanged && this.currentRendition) {
            // Store current location if possible
            const currentLocation = this.currentRendition.location?.start;
            
            // Re-render with new flow mode
            this.currentRendition.flow(this.settings.flow);
            
            // Try to restore location if we had one
            if (currentLocation) {
                setTimeout(() => {
                    this.currentRendition.display(currentLocation);
                }, 100);
            }
        }
    }

    private applySettingsToRendition(rendition: any, skipRendering = false): void {
        if (!rendition) return;

        // Determine current theme
        const isDarkMode = document.body.classList.contains('theme-dark');
        const theme = isDarkMode ? this.settings.darkMode : this.settings.lightMode;

        // Create CSS content
        const styleContent = `
            html, body {
                background: ${theme.backgroundColor} !important;
                color: ${theme.textColor} !important;
                font-family: ${this.settings.fontFamily} !important;
                font-size: ${this.settings.fontSize} !important;
                line-height: ${this.settings.lineHeight} !important;
                margin: ${this.settings.margin} !important;
                padding: ${this.settings.padding} !important;
            }

            * {
                color: ${theme.textColor} !important;
            }

            h1, h2, h3, h4, h5, h6 {
                color: ${theme.textColor} !important;
                font-family: ${this.settings.fontFamily} !important;
                margin-top: 1.5em !important;
                margin-bottom: 0.5em !important;
            }

            p, div, span {
                color: ${theme.textColor} !important;
                font-family: ${this.settings.fontFamily} !important;
                font-size: ${this.settings.fontSize} !important;
                line-height: ${this.settings.lineHeight} !important;
                margin-bottom: 1em !important;
            }

            a {
                color: ${theme.textColor} !important;
                text-decoration: underline !important;
            }

            a:hover {
                color: ${theme.textColor} !important;
                text-decoration: none !important;
            }
        `;

        // Apply styles to the rendition
        rendition.themes.default({
            body: {
                'background': theme.backgroundColor,
                'color': theme.textColor,
                'font-family': this.settings.fontFamily,
                'font-size': this.settings.fontSize,
                'line-height': this.settings.lineHeight,
                'margin': this.settings.margin,
                'padding': this.settings.padding
            },
            'h1, h2, h3, h4, h5, h6': {
                'color': theme.textColor,
                'font-family': this.settings.fontFamily
            },
            'p, div, span': {
                'color': theme.textColor,
                'font-family': this.settings.fontFamily,
                'font-size': this.settings.fontSize,
                'line-height': this.settings.lineHeight
            }
        });

        // Apply styles to the current iframe without re-rendering
        this.applyStylesToCurrentIframe(styleContent, theme);
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

            // Apply styles to body element
            if (iframe.body) {
                iframe.body.style.background = theme.backgroundColor;
                iframe.body.style.color = theme.textColor;
                iframe.body.style.fontFamily = this.settings.fontFamily;
                iframe.body.style.fontSize = this.settings.fontSize;
                iframe.body.style.lineHeight = this.settings.lineHeight;
                iframe.body.style.margin = this.settings.margin;
                iframe.body.style.padding = this.settings.padding;
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
                            this.applySettingsToRendition(this.currentRendition);
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

    private showTableOfContents(toc: any, rendition: any): void {
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
                    rendition.display(item.href);
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

    async onClose() {
        // Cleanup if needed
        this.currentRendition = null;
    }
}
