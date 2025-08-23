import { Location } from "epubjs";
import { EPUBViewer } from "src/views/epub-viewer";

export default class EpubBookLocation {
    private epubViewer: EPUBViewer;

    constructor(epubViewer: EPUBViewer) {
        this.epubViewer = epubViewer;
        this.epubViewer.on('top-bar-ready', this.initBookLocations.bind(this));
    }

    public async initBookLocations(): Promise<void> {

        if (!this.epubViewer.getBook()?.locations) return;

        if (!this.loadBookLocationsFromLocalStorage()) {
            await this.generateTotalPages()
            this.saveBookLocations();
        }

        const total = this.epubViewer.getBook()?.locations.length();
        if (!total) return;
        this.epubViewer.getTopBar().setTotal(total);

        const currentLocation: Location | null = this.epubViewer.getRendition()?.currentLocation() as unknown as Location | null;
        if (currentLocation) {
            this.epubViewer.getTopBar().setCurrent(currentLocation.start.location + 1);
        }
        
    }

    private async generateTotalPages(): Promise<number> {
        const locations = this.epubViewer.getBook()?.locations;
        if (!locations) return 0;

        const pages = await locations.generate?.(1200)
        return pages.length;
    }

    private loadBookLocationsFromLocalStorage(): boolean {
        if (!this.epubViewer.getBookHash()) return false;

        const bookLocations = localStorage.getItem(`${this.epubViewer.getBookHash()}-locations`);
        if (bookLocations) {
            this.epubViewer.getBook()?.locations.load(JSON.parse(bookLocations));
            return true;
        }
        return false;
    }

    private saveBookLocations(): void {
        if (!this.epubViewer.getBookHash()) return;
        const bookLocations = this.epubViewer.getBook()?.locations.save();
        localStorage.setItem(`${this.epubViewer.getBookHash()}-locations`, JSON.stringify(bookLocations));
    }
}