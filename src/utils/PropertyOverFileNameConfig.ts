import { App } from 'obsidian';
import { PropertyOverFileNameConfig } from '../types';

export class PropertyOverFileNameConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(config: PropertyOverFileNameConfig): Promise<void> {
		const pluginId = 'property-over-file-name';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile) {
				const existingData = JSON.parse(await this.app.vault.read(dataFile as any));
				const mergedData = { ...existingData, ...config };
				await this.app.vault.modify(dataFile as any, JSON.stringify(mergedData, null, 2));
			}
		} catch (error) {
			console.error('Failed to save Property Over File Name config:', error);
		}
	}
}

