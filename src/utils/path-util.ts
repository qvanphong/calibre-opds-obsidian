import { App } from "obsidian";
import { CalibreWebPluginSettings } from "src/interfaces";

export function getFilenameExtension(filename: string): string {
	const lastDotIndex = filename.lastIndexOf('.');
	return lastDotIndex !== -1 ? filename.slice(lastDotIndex + 1) : '';
}

export function getAvailablePath(path: string, app: App): string {
	function buildPath(path: string, extenstion: string, hasSlash: boolean, modifier: number): string {
		return `${path}${modifier !== 0 ? ` ${modifier}` : ''}${extenstion ? `.${extenstion}` : ''}${hasSlash ? '/' : ''}`;
	}

	const hasSlash = path.endsWith('/');
	if (hasSlash) path = path.slice(0, -1);

	const extenstion = getFilenameExtension(path);
	if (extenstion) path = path.slice(0, path.lastIndexOf('.'));

	let modifier = 0;

	while (app.vault.getAbstractFileByPath(buildPath(path, extenstion, hasSlash, modifier))) {
		modifier++;
	}

	return buildPath(path, extenstion, hasSlash, modifier);
}

export function getBookPathOrResourcePath(settings: CalibreWebPluginSettings, app: App) {
	return settings.bookPath || this.app.vault.config.attachmentFolderPath;
}