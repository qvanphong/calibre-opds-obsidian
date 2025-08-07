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

export type ConflictAction = 'overwrite' | 'newname' | 'cancel' | 'open';
