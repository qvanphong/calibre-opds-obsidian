
import { Platform } from "obsidian";
import { EPUBViewer } from "src/views/epub-viewer";

export default class EpubNavigator {
    
    private epubViewer: EPUBViewer;
        
    // Mobile navigator properties
    private touchStartTime?: number;
    private startX = 0;
    private startY = 0;

    private onEpubViewTouchStart: (e: TouchEvent) => void;
    private onEpubViewTouchEnd: (e: TouchEvent) => void;

    constructor(epubViewer: EPUBViewer) {
        this.epubViewer = epubViewer;
    }

    public initialize(): void {
        if (!this.epubViewer.getRendition())  return;
        if (Platform.isMobile || Platform.isTablet) {
            this.initializeMobileNavigator();
        } else {
            this.initializeDesktopNavigator();
        }
        this.initializeKeyboardControls();
    }

    private initializeDesktopNavigator(): void {
        const container = this.epubViewer.getEpubContainerView();
        if (!container) return;

        // Remove any existing arrows or legacy nav areas
        container.querySelector('.epub-arrow-left')?.remove();
        container.querySelector('.epub-arrow-right')?.remove();

        // Left arrow
        const leftArrow = container.createEl('div', {
            cls: 'epub-arrow epub-arrow-left',
            text: '‹'
        });
        leftArrow.addEventListener('click', () => this.epubViewer.trigger('prev-page'));

        // Right arrow
        const rightArrow = container.createEl('div', {
            cls: 'epub-arrow epub-arrow-right',
            text: '›'
        });
        rightArrow.addEventListener('click', () => this.epubViewer.trigger('next-page'));
    }

    private initializeKeyboardControls() {
        const goToNextOrPrevPage = (event: KeyboardEvent) => {
            if (event.code == 'ArrowLeft') {
                this.epubViewer.trigger('prev-page');
            }
            if (event.code == 'ArrowRight') {
                this.epubViewer.trigger('next-page');
            }
        }

        // document.addEventListener('keydown', goToNextOrPrevPage, false);
        this.epubViewer.getRendition()?.on('keydown', goToNextOrPrevPage);
    }

    private initializeMobileNavigator(): void {
        this.onEpubViewTouchStart = this.handleEpubViewTouchStart.bind(this);
        this.onEpubViewTouchEnd = this.handleEpubViewTouchEnd.bind(this);

        this.epubViewer.getRendition()?.on("touchstart", this.onEpubViewTouchStart);
        this.epubViewer.getRendition()?.on("touchend", this.onEpubViewTouchEnd);
    }

    // Mobile handlers
    private handleEpubViewTouchStart(e: TouchEvent): void {
        console.log('touch start');
        const touch = e.touches[0];
        this.touchStartTime = Date.now();
        this.startX = touch.clientX;
        this.startY = touch.clientY;
    }

    private handleEpubViewTouchEnd(e: TouchEvent): void {
        if (!this.touchStartTime) return;

        // When user is selecting text, ignore it to prevent accidental page change
        const textSelection = e.view?.getSelection?.();
        
        if (!!textSelection && !textSelection.isCollapsed) {
            return;
        } 

        const touch = e.changedTouches[0];
        const touchDuration = Date.now() - this.touchStartTime;
        const dx = Math.abs(touch.clientX - this.startX);
        const dy = Math.abs(touch.clientY - this.startY);
        
        if (touchDuration >= 300 || dx > 4 || dy > 4) return;

        if (touch.clientX > window.innerWidth / 2) {
            this.epubViewer.trigger('next-page')
        } else {
            this.epubViewer.trigger('prev-page')
        }
    }
}