import { App, TFile } from 'obsidian';
import { ImageManagerConfig } from '../types';

type ImageManagerPlugin = {
	settings?: Record<string, unknown>;
	saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
	plugins?: Record<string, ImageManagerPlugin>;
};

export class ImageManagerConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async loadConfig(): Promise<ImageManagerConfig> {
		const pluginId = 'image-manager';
		
		try {
			// Try to use plugin's settings API first
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const imageManagerPlugin = plugins?.plugins?.[pluginId];
			
			if (imageManagerPlugin && imageManagerPlugin.settings) {
				// Return plugin settings as config
				return imageManagerPlugin.settings as ImageManagerConfig;
			}
		} catch (error: unknown) {
			console.warn('Failed to load Image Manager config from plugin API:', error);
		}
		
		// Fallback to file method
		return await this.loadConfigFallback();
	}

	private async loadConfigFallback(): Promise<ImageManagerConfig> {
		const pluginId = 'image-manager';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				const existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
				return existingData as ImageManagerConfig;
			} catch (error: unknown) {
				console.warn('Failed to parse existing Image Manager data.json:', error);
				return {};
			}
		}
		
		return {};
	}

	async saveConfig(config: ImageManagerConfig): Promise<void> {
		const pluginId = 'image-manager';
		
		try {
			// Try to use plugin's saveSettings method first (like Astro Composer)
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const imageManagerPlugin = plugins?.plugins?.[pluginId];
			
			if (imageManagerPlugin && imageManagerPlugin.settings) {
				// Update via plugin settings API (matching astro-modular-settings pattern)
				const pluginSettings = imageManagerPlugin.settings;
				
				// Merge config into plugin settings
				Object.assign(pluginSettings, config);
				
				if (typeof imageManagerPlugin.saveSettings === 'function') {
					await imageManagerPlugin.saveSettings();
					console.debug('ImageManagerConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}
			
			// Fallback to file method (like Astro Composer fallback)
			await this.saveConfigFallback(config);
		} catch (error: unknown) {
			console.error('Failed to save Image Manager config:', error);
			// Try fallback even if plugin method fails
			try {
				await this.saveConfigFallback(config);
			} catch (fallbackError) {
				console.error('Failed to save Image Manager config via fallback:', fallbackError);
			}
		}
	}

	private async saveConfigFallback(config: ImageManagerConfig): Promise<void> {
		const pluginId = 'image-manager';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		let existingData: Record<string, unknown> = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
			} catch (error: unknown) {
				console.warn('Failed to parse existing Image Manager data.json, starting fresh:', error);
				existingData = {};
			}
		}
		
		// Merge config into existing data (preserving existing settings not in config)
		const mergedData = {
			...existingData,
			...config
		};
		
		// Try to modify first, if file doesn't exist it will throw, then we create
		if (dataFile && dataFile instanceof TFile) {
			await this.app.vault.modify(dataFile, JSON.stringify(mergedData, null, 2));
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
				await this.app.vault.create(pluginDataPath, JSON.stringify(mergedData, null, 2));
			} catch (error: unknown) {
				// If file was created between check and create, try to modify it
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage && (errorMessage.includes('already exists') || errorMessage.includes('File already exists'))) {
					const retryFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
					if (retryFile instanceof TFile) {
						await this.app.vault.modify(retryFile, JSON.stringify(mergedData, null, 2));
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
