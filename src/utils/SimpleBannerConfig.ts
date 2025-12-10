import { App } from 'obsidian';

export class SimpleBannerConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(imageProperty: string): Promise<void> {
		const pluginId = 'simple-banner';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			let existingData: any = {};
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile) {
				existingData = JSON.parse(await this.app.vault.read(dataFile as any));
			}
			
			// Update image property in properties section
			if (!existingData.properties) {
				existingData.properties = {};
			}
			existingData.properties.image = imageProperty;
			
			if (dataFile) {
				await this.app.vault.modify(dataFile as any, JSON.stringify(existingData, null, 2));
			} else {
				await this.app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
			}
		} catch (error) {
			console.error('Failed to save Simple Banner config:', error);
		}
	}
}

