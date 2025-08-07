import { Plugin} from 'obsidian';
import { DEFAULT_SETTINGS, SettingTab } from './setting';
import { CalibreWebView, VIEW_TYPE_CALIBRE } from './views/calibre-web-view';
import { EPUBViewer } from './epub-viewer';

const VIEW_TYPE_EPUB = "epub-viewer";

export default class CalibreWebPlugin extends Plugin {
    settings = DEFAULT_SETTINGS;

    async onload() {
        console.log('Loading Calibre-web OPDS plugin');

        await this.loadSettings();

        this.addSettingTab(new SettingTab(this.app, this));
        // Register the custom views
        this.registerView(
            VIEW_TYPE_CALIBRE,
            (leaf) => new CalibreWebView(leaf, this.settings)
        );

        this.registerView(
            VIEW_TYPE_EPUB,
            (leaf) => new EPUBViewer(leaf)
        );

        // Add ribbon icon to the left sidebar
        this.addRibbonIcon(
            'book-open', // Using book-open icon for Calibre
            'Calibre-web OPDS',
            async (evt: MouseEvent) => {
                // Open the Calibre-web view in the center note area
                const leaf = this.app.workspace.getLeaf('tab');
                if (leaf) {
                    await leaf.setViewState({
                        type: VIEW_TYPE_CALIBRE,
                        active: true,
                    });
                    this.app.workspace.revealLeaf(leaf);
                }
            }
        );

        // Add a status bar item to show the plugin is loaded
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Calibre-web OPDS Ready');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        console.log('Unloading Calibre-web OPDS plugin');
        // Deregister the view
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALIBRE);
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_EPUB);
    }
}
