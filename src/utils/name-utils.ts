
export function getFormatDisplayName(type: string): string {
    switch (type) {
        case 'application/epub+zip':
            return 'EPUB';
        case 'application/pdf':
            return 'PDF';
        case 'application/mobi+xml':
        case 'application/x-mobipocket-ebook':
            return 'MOBI';
        case 'application/x-fictionbook+xml':
            return 'FB2';
        case 'application/x-ibooks+xml':
            return 'iBooks';
        case 'application/x-cbr+zip':
            return 'CBR';
        case 'application/x-cbz+zip':
            return 'CBZ';
        case 'application/x-rar':
            return 'RAR';
        case 'application/x-7z-compressed':
            return '7Z';
        case 'application/x-tar':
            return 'TAR';
        case 'application/x-zip':
            return 'ZIP';
        case 'application/x-bzip2':
            return 'BZIP2';
        case 'application/x-gzip':
            return 'GZIP';
        case 'application/x-xz':
            return 'XZ';
        case 'application/x-zstd':
            return 'ZSTD';
        case 'application/x-lzip':
            return 'LZIP';
        case 'application/x-lzma':
            return 'LZMA';
        case 'application/x-lz4':
            return 'LZ4';
        case 'application/x-brotli':
            return 'BROTLI';
        default:
            return type;
    }
}
