import { App, TFile } from 'obsidian';

type SimpleBannerPlugin = {
	settings?: {
		properties?: {
			image?: string;
		};
		[key: string]: unknown;
	};
	saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
	plugins?: Record<string, SimpleBannerPlugin>;
};

export class SimpleBannerConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(imageProperty: string): Promise<void> {
		const pluginId = 'simple-banner';
		
		try {
			// Try to use plugin's saveSettings method first (like Astro Composer)
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const simpleBannerPlugin = plugins?.plugins?.[pluginId];
			
			if (simpleBannerPlugin && simpleBannerPlugin.settings) {
				// Update via plugin settings API
				if (!simpleBannerPlugin.settings.properties) {
					simpleBannerPlugin.settings.properties = {};
				}
				simpleBannerPlugin.settings.properties.image = imageProperty;
				
				if (typeof simpleBannerPlugin.saveSettings === 'function') {
					await simpleBannerPlugin.saveSettings();
					console.debug('SimpleBannerConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}
			
			// Fallback to file method (like Astro Composer fallback)
			await this.saveConfigFallback(imageProperty);
		} catch (error: unknown) {
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
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		let existingData: Record<string, unknown> = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
			} catch (error: unknown) {
				console.warn('Failed to parse existing Simple Banner data.json, starting fresh:', error);
				existingData = {};
			}
		}
		
		// Update image property in properties section
		const properties = (existingData.properties as Record<string, unknown>) || {};
		if (!existingData.properties) {
			existingData.properties = properties;
		}
		properties.image = imageProperty;
		
		// Try to modify first, if file doesn't exist it will throw, then we create
		if (dataFile && dataFile instanceof TFile) {
			await this.app.vault.modify(dataFile, JSON.stringify(existingData, null, 2));
		} else {
			// Ensure plugin directory exists
			const pluginDir = `${configDir}/plugins/${pluginId}`;
			const pluginDirFile = this.app.vault.getAbstractFileByPath(pluginDir);
			if (!pluginDirFile) {
				try {
					await this.app.vault.createFolder(pluginDir);
				} catch (error: unknown) {
					// Ignore "already exists" errors
					const errorMessage = error instanceof Error ? error.message : String(error);
					if (errorMessage && !errorMessage.includes('already exists') && !errorMessage.includes('File already exists')) {
						throw error;
					}
				}
			}
			// Create the file
			try {
				await this.app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
			} catch (error: unknown) {
				// If file was created between check and create, try to modify it
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage && (errorMessage.includes('already exists') || errorMessage.includes('File already exists'))) {
					const retryFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
					if (retryFile instanceof TFile) {
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

