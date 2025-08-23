import { EPUBViewer } from "src/views/epub-viewer";

export class EpubResizeHandler {
    private epubViewer: EPUBViewer;
    private previousWidth = 0;
    private previousHeight = 0;

    constructor(epubViewer: EPUBViewer) {
        this.epubViewer = epubViewer;
        this.epubViewer.on('epub-viewer-resize', this.onResize.bind(this));
    }

    private onResize(): void {
        const currentWidth = this.epubViewer.getEpubContainerView()?.clientWidth ?? 0;
        const currentHeight = this.epubViewer.getEpubContainerView()?.clientHeight ?? 0;
        const isNotFocusing = currentWidth === 0 || currentHeight === 0;
        const hasResized = currentWidth !== this.previousWidth || currentHeight !== this.previousHeight;

        if (hasResized && !isNotFocusing) {
            this.previousWidth = currentWidth;
            this.previousHeight = currentHeight;

            this.updateRenditionSpread();
        }
    }

    private updateRenditionSpread(): void {
        const settings = this.epubViewer.getSettings();
        this.epubViewer.getRendition()?.flow(settings.flow);
        if (settings.flow === 'paginated') {
            if (settings.columns === 2) {
                this.epubViewer.getRendition()?.spread('auto');
            } else {
                this.epubViewer.getRendition()?.spread('none');
            }
        }
     }
}