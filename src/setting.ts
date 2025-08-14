import { App, debounce, PluginSettingTab, Setting } from 'obsidian';
import CalibrePlugin from './main';
import { CalibreWebPluginSettings } from './interfaces';
// import { CALIBRE_ICON_ID } from './tools';


const DEBOUNCE_TIMEOUT = 1000;
export const DEFAULT_SETTINGS: CalibreWebPluginSettings = {
	address: "http://127.0.0.1:8083",
    username: "admin",
    password: "admin123",
    dummyEpubFile: true,
    bookPath: '',
}

export class SettingTab extends PluginSettingTab {

	constructor(app: App, private plugin: CalibrePlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Calibre-web Settings' });

		new Setting(containerEl)
			.setName("Server Address")
			.setDesc("The address of OPDS from Calibre-web, not needed to include the /opds")
			.addText(text => {
				text.inputEl.size = 25;
				text
					.setPlaceholder('e.g: http://127.0.0.1:8083')
					.setValue(this.plugin.settings.address || '')
					.onChange(debounce(async (value) => {
						this.plugin.settings.address = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});
        
        new Setting(containerEl)
            .setName("OPDS Username")
            .setDesc("The username of OPDS from Calibre-web")
            .addText(text => {
                text.setPlaceholder('e.g: admin')
                text.setValue(this.plugin.settings.username || '')
                text.onChange(debounce(async (value) => {
                    this.plugin.settings.username = value;
                    this.plugin.saveData(this.plugin.settings);
                }, DEBOUNCE_TIMEOUT));
            });
        
        new Setting(containerEl)
            .setName("OPDS Password")
            .setDesc("The password of OPDS from Calibre-web")
            .addText(text => {
                text.setPlaceholder('e.g: admin123')
                text.setValue(this.plugin.settings.password || '')
                text.onChange(debounce(async (value) => {
                    this.plugin.settings.password = value;
                    this.plugin.saveData(this.plugin.settings);
                }, DEBOUNCE_TIMEOUT));
            });

        new Setting(containerEl)
            .setName("Book Folder Path")
            .setDesc("Folder path to store books, leave it blank to use default resource path")
            .addText(text => {
                text.setPlaceholder('e.g: Resource/Books')
                text.setValue(this.plugin.settings.bookPath || '')
                text.onChange(debounce(async (value) => {
                    this.plugin.settings.bookPath = value;
                    this.plugin.saveData(this.plugin.settings);
                }, DEBOUNCE_TIMEOUT));
            });
	}

    hide(): void {
        this.plugin.saveData(this.plugin.settings);
    }

    
}