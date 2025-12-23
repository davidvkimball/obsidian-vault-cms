import { App, TFile } from 'obsidian';
import { PropertyOverFileNameConfig } from '../types';

export class PropertyOverFileNameConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(config: PropertyOverFileNameConfig): Promise<void> {
		const pluginId = 'property-over-file-name';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		try {
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile instanceof TFile) {
				const existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
				const mergedData = { ...existingData, ...config };
				await this.app.vault.modify(dataFile, JSON.stringify(mergedData, null, 2));
			}
		} catch (error: unknown) {
			console.error('Failed to save Property Over File Name config:', error);
		}
	}
}

