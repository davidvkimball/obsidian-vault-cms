import { App } from 'obsidian';
import { ImageInserterConfig } from '../types';

export class ImageInserterConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(config: ImageInserterConfig, imageProperty?: string): Promise<void> {
		const pluginId = 'insert-unsplash-image';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			let existingData: any = {};
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile) {
				existingData = JSON.parse(await this.app.vault.read(dataFile as any));
			}
			
			const mergedData = {
				...existingData,
				...config
			};
			
			// Set image property if specified
			if (imageProperty) {
				mergedData.insertIntoProperty = imageProperty;
			}
			
			if (dataFile) {
				await this.app.vault.modify(dataFile as any, JSON.stringify(mergedData, null, 2));
			} else {
				await this.app.vault.create(pluginDataPath, JSON.stringify(mergedData, null, 2));
			}
		} catch (error) {
			console.error('Failed to save Image Inserter config:', error);
		}
	}
}

