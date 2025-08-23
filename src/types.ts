export type ConflictAction = 'overwrite' | 'newname' | 'cancel' | 'open';
export type DisplayType = 'catalogs' | 'books';
export type NavigationEvent = 'page-changed' | 'next-page' | 'prev-page';
export type PageProgressionEvent = 'page-changed' | 'book-loaded';
export type EpubViewResponsiveEvent = 'epub-viewer-resize';
export type EpubViewerEvent = 'refresh-book-location' | 'top-bar-ready' | EpubViewResponsiveEvent | NavigationEvent | PageProgressionEvent;