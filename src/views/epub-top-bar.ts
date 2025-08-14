export interface TopBarHandlers {
    onTOC?: () => void;
    onSettings?: () => void;
    onGoto?: (page: number) => void;
}

export class EpubTopBar {
    private rootEl: HTMLElement | null = null;
    private pageInputEl: HTMLInputElement | null = null;
    private totalSpanEl: HTMLElement | null = null;
    private currentPage = 1;
    private totalPages = 0;
    private handlers: TopBarHandlers = {};

    constructor(initialHandlers?: TopBarHandlers) {
        if (initialHandlers) this.handlers = { ...initialHandlers };
    }

    attach(parent: HTMLElement): this {
        // Root
        const root = parent.createEl('div', {
            cls: 'epub-viewer-topbar',
        });

        // Left spacer
        root.createEl('div', { cls: 'left-space' });

        // Center controls
        const center = root.createEl('div', {
            cls: 'center-space',
        });
        const pageInput = center.createEl('input', {
            cls: 'curr-page-input',
            attr: {
                type: 'number',
                min: '1',
                value: '1',
            },
        }) as HTMLInputElement;
        center.createEl('span', {
            text: ' / ',
            attr: { style: 'color:var(--text-muted);' },
        });
        const totalSpan = center.createEl('span', {
            text: '…',
            attr: {
                style: 'min-width:40px; text-align:left; color:var(--text-muted); font-size: 14px;',
            },
        });

        // Right buttons
        const right = root.createEl('div', {
            cls: 'right-space',
        });
        const tocBtn = right.createEl('button', {
            text: 'TOC',
            cls: 'btn-toc',
        });
        const settingsBtn = right.createEl('button', {
            text: '⚙️',
            cls: 'btn-settings',
        });

        // Wire internal events
        tocBtn.addEventListener('click', () => this.handlers.onTOC?.());
        settingsBtn.addEventListener('click', () => this.handlers.onSettings?.());

        const commitGoto = () => {
            const n = parseInt(pageInput.value || '1', 10);
            if (!isFinite(n)) return;
            this.handlers.onGoto?.(Math.max(1, n));
        };

        pageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitGoto();
                pageInput.blur();
            }
        });

        // Save refs
        this.rootEl = root;
        this.pageInputEl = pageInput;
        this.totalSpanEl = totalSpan;

        // Initialize UI state
        this.renderCurrent();
        this.renderTotal();
        return this;
    }

    setHandlers(handlers: TopBarHandlers): void {
        this.handlers = { ...handlers };
    }

    setTotal(total: number): void {
        this.totalPages = Math.max(1, Math.floor(total || 0));
        this.renderTotal();
    }

    getTotal(): number {
        return this.totalPages;
    }

    setCurrent(page: number): void {
        this.currentPage = Math.max(1, Math.floor(page || 1));
        this.renderCurrent();
    }

    getRoot(): HTMLElement | null {
        return this.rootEl;
    }

    private renderCurrent(): void {
        if (this.pageInputEl) this.pageInputEl.value = String(this.currentPage);
    }

    private renderTotal(): void {
        if (this.totalSpanEl) this.totalSpanEl.setText(String(this.totalPages || '…'));
    }
}
