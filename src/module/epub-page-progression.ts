import { Location } from "epubjs";
import { EPUBViewer } from "src/views/epub-viewer";

export default class EpubPageProgression {
    private epubViewer: EPUBViewer;
    private justClickedPreviousPage = false;

    constructor(epubViewer: EPUBViewer) {
        this.epubViewer = epubViewer;
        this.epubViewer.on('page-changed', this.saveCurrentReadingLocation.bind(this));
        this.epubViewer.on('next-page', () => this.toNextOrPrevPage('next'));
        this.epubViewer.on('prev-page', () => this.toNextOrPrevPage('prev'));
    }

    public async loadLastReadingLocation(): Promise<void> {
        if (!this.epubViewer.getBookHash()) return;
        const lastReadingLocation = localStorage.getItem(`${this.epubViewer.getBookHash()}-current-location`);
        if (lastReadingLocation && lastReadingLocation !== 'null' && lastReadingLocation !== 'undefined') {
            this.epubViewer.getRendition()?.display(lastReadingLocation);
        } else {
            this.epubViewer.getRendition()?.display();
        }
    }

    private async toNextOrPrevPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.epubViewer.getRendition()?.next();
        } else {
            await this.epubViewer.getRendition()?.prev();
            this.justClickedPreviousPage = true;
        }
        this.saveCurrentReadingLocation();
    }

    private saveCurrentReadingLocation(): void {
        if (!this.epubViewer.getBookHash()) return;
        // Don't know why typescript declared is as DisplayedLocation, but it's actually Location
        const currentLocation = this.epubViewer.getRendition()?.currentLocation() as unknown as Location;
        if (currentLocation) {
            localStorage.setItem(`${this.epubViewer.getBookHash()}-current-location`, currentLocation.start.cfi);
        }
    }

    public isJustClickedPreviousPage(): boolean {
        return this.justClickedPreviousPage;
    }
}