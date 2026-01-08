import { App, TFile } from 'obsidian';
import { HomeBaseConfig } from '../types';

type HomeBasePlugin = {
	settings?: Record<string, unknown>;
	saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
	plugins?: Record<string, HomeBasePlugin>;
};

export class HomeBaseConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async loadConfig(): Promise<HomeBaseConfig> {
		const pluginId = 'home-base';
		
		try {
			// Try to use plugin's settings API first
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const homeBasePlugin = plugins?.plugins?.[pluginId];
			
			if (homeBasePlugin && homeBasePlugin.settings) {
				// Return plugin settings as config
				return homeBasePlugin.settings as HomeBaseConfig;
			}
		} catch (error: unknown) {
			console.warn('Failed to load Home Base config from plugin API:', error);
		}
		
		// Fallback to file method
		return await this.loadConfigFallback();
	}

	private async loadConfigFallback(): Promise<HomeBaseConfig> {
		const pluginId = 'home-base';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				const existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
				return existingData as HomeBaseConfig;
			} catch (error: unknown) {
				console.warn('Failed to parse existing Home Base data.json:', error);
				return {};
			}
		}
		
		return {};
	}

	async saveConfig(config: HomeBaseConfig): Promise<void> {
		const pluginId = 'home-base';
		
		try {
			// Try to use plugin's saveSettings method first (like Astro Composer)
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const homeBasePlugin = plugins?.plugins?.[pluginId];
			
			if (homeBasePlugin && homeBasePlugin.settings) {
				// Update via plugin settings API (matching astro-modular-settings pattern)
				const pluginSettings = homeBasePlugin.settings;
				
				// Merge config into plugin settings
				Object.assign(pluginSettings, config);
				
				if (typeof homeBasePlugin.saveSettings === 'function') {
					await homeBasePlugin.saveSettings();
					console.debug('HomeBaseConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}
			
			// Fallback to file method (like Astro Composer fallback)
			await this.saveConfigFallback(config);
		} catch (error: unknown) {
			console.error('Failed to save Home Base config:', error);
			// Try fallback even if plugin method fails
			try {
				await this.saveConfigFallback(config);
			} catch (fallbackError) {
				console.error('Failed to save Home Base config via fallback:', fallbackError);
			}
		}
	}

	private async saveConfigFallback(config: HomeBaseConfig): Promise<void> {
		const pluginId = 'home-base';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		let existingData: Record<string, unknown> = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
			} catch (error: unknown) {
				console.warn('Failed to parse existing Home Base data.json, starting fresh:', error);
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
