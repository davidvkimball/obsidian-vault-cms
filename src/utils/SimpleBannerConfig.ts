import { App, TFile } from 'obsidian';

export class SimpleBannerConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(imageProperty: string): Promise<void> {
		const pluginId = 'simple-banner';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			// Try to use plugin's saveSettings method first (like Astro Composer)
			const plugins = (this.app as any).plugins;
			const simpleBannerPlugin = plugins?.plugins?.[pluginId];
			
			if (simpleBannerPlugin && simpleBannerPlugin.settings) {
				// Update via plugin settings API
				if (!simpleBannerPlugin.settings.properties) {
					simpleBannerPlugin.settings.properties = {};
				}
				simpleBannerPlugin.settings.properties.image = imageProperty;
				
				if (typeof simpleBannerPlugin.saveSettings === 'function') {
					await simpleBannerPlugin.saveSettings();
					console.log('SimpleBannerConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}
			
			// Fallback to file method (like Astro Composer fallback)
			await this.saveConfigFallback(imageProperty);
		} catch (error) {
			console.error('Failed to save Simple Banner config:', error);
			// Try fallback even if plugin method fails
			try {
				await this.saveConfigFallback(imageProperty);
			} catch (fallbackError) {
				console.error('Failed to save Simple Banner config via fallback:', fallbackError);
			}
		}
	}

	private async saveConfigFallback(imageProperty: string): Promise<void> {
		const pluginId = 'simple-banner';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		let existingData: any = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile));
			} catch (error) {
				console.warn('Failed to parse existing Simple Banner data.json, starting fresh:', error);
				existingData = {};
			}
		}
		
		// Update image property in properties section
		if (!existingData.properties) {
			existingData.properties = {};
		}
		existingData.properties.image = imageProperty;
		
		// Try to modify first, if file doesn't exist it will throw, then we create
		if (dataFile && dataFile instanceof TFile) {
			await this.app.vault.modify(dataFile, JSON.stringify(existingData, null, 2));
		} else {
			// Ensure plugin directory exists
			const pluginDir = `.obsidian/plugins/${pluginId}`;
			const pluginDirFile = this.app.vault.getAbstractFileByPath(pluginDir);
			if (!pluginDirFile) {
				try {
					await this.app.vault.createFolder(pluginDir);
				} catch (error: any) {
					// Ignore "already exists" errors
					if (!error.message || (!error.message.includes('already exists') && !error.message.includes('File already exists'))) {
						throw error;
					}
				}
			}
			// Create the file
			try {
				await this.app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
			} catch (error: any) {
				// If file was created between check and create, try to modify it
				if (error.message && (error.message.includes('already exists') || error.message.includes('File already exists'))) {
					const retryFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
					if (retryFile && retryFile instanceof TFile) {
						await this.app.vault.modify(retryFile, JSON.stringify(existingData, null, 2));
					} else {
						throw error;
					}
				} else {
					throw error;
				}
			}
		}
	}
}

