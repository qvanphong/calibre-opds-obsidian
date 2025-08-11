export interface OPDSCategory {
    title: string;
    href: string;
    bookCount?: number;
}

export interface OPDSBook {
    title: string;
    author?: string;
    summary?: string;
    formats: Array<{ type: string, href: string, title?: string }>;
    updated?: string;
}

export interface CalibreWebPluginSettings {
	address: string;
    username: string;
    password: string;
    dummyEpubFile: boolean;
    bookPath?: string;
}


export interface EPUBViewerSettings {
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
    columns: 1 | 2; // Number of columns for paginated mode
    // Padding and margins
    padding: string;
    margin: string;
}

export type ConflictAction = 'overwrite' | 'newname' | 'cancel' | 'open';
