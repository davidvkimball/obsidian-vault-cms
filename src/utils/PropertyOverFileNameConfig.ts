import { App, TFile } from 'obsidian';
import { PropertyOverFileNameConfig } from '../types';

export class PropertyOverFileNameConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(config: PropertyOverFileNameConfig): Promise<void> {
		try {
			// Try to use plugin's saveSettings method first (like Astro Composer and SEO)
			type PluginsAPI = {
				plugins?: Record<string, {
					settings?: Record<string, unknown>;
					saveSettings?: () => Promise<void>;
				}>;
			};
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const propertyOverFileNamePlugin = plugins?.plugins?.['property-over-file-name'];
			
			if (propertyOverFileNamePlugin && propertyOverFileNamePlugin.settings) {
				const pluginSettings = propertyOverFileNamePlugin.settings;
				
				console.debug('PropertyOverFileNameConfig: Using plugin.saveSettings() method');
				console.debug('PropertyOverFileNameConfig: Input config.enableMdxSupport =', config.enableMdxSupport);
				
				// Update propertyKey if provided
				if (config.propertyKey) {
					pluginSettings.propertyKey = config.propertyKey;
				}
				
				// ALWAYS update enableMdxSupport if provided (even if false)
				if (config.enableMdxSupport !== undefined) {
					pluginSettings.enableMdxSupport = config.enableMdxSupport;
					console.debug('PropertyOverFileNameConfig: Set pluginSettings.enableMdxSupport to', config.enableMdxSupport);
				} else {
					console.warn('PropertyOverFileNameConfig: config.enableMdxSupport is undefined!');
				}
				
				// Save the settings using plugin's saveSettings method
				if (typeof propertyOverFileNamePlugin.saveSettings === 'function') {
					await propertyOverFileNamePlugin.saveSettings();
					console.debug('PropertyOverFileNameConfig: Successfully saved via plugin.saveSettings()');
					return;
				} else {
					console.warn('PropertyOverFileNameConfig: Plugin saveSettings not available, using fallback');
				}
			} else {
				console.warn('PropertyOverFileNameConfig: Plugin not found or settings not available, using fallback');
			}
			
			// Fallback to file method
			await this.saveConfigFallback(config);
		} catch (error: unknown) {
			console.error('Failed to save Property Over File Name config via plugin method:', error);
			// Fallback to file method
			await this.saveConfigFallback(config);
		}
	}

	private async saveConfigFallback(config: PropertyOverFileNameConfig): Promise<void> {
		const pluginId = 'property-over-file-name';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		try {
			let existingData: Record<string, unknown> = {};
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile instanceof TFile) {
				existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
			}
			
			console.debug('PropertyOverFileNameConfig: Using fallback file method');
			console.debug('PropertyOverFileNameConfig: Input config =', JSON.stringify(config));
			console.debug('PropertyOverFileNameConfig: Input config.enableMdxSupport =', config.enableMdxSupport);
			console.debug('PropertyOverFileNameConfig: Existing data =', JSON.stringify(existingData));
			
			// Merge config, preserving existing settings
			// First spread existing data, then spread config (which may include enableMdxSupport)
			const mergedData = { 
				...existingData, 
				...config
			};
			
			// ALWAYS explicitly set enableMdxSupport if it's provided in config (even if false)
			// This ensures it overrides any existing value
			if (config.enableMdxSupport !== undefined) {
				mergedData.enableMdxSupport = config.enableMdxSupport;
				console.debug('PropertyOverFileNameConfig: Explicitly set enableMdxSupport to', config.enableMdxSupport);
			} else {
				console.warn('PropertyOverFileNameConfig: config.enableMdxSupport is undefined!');
			}
			
			console.debug('PropertyOverFileNameConfig: Final mergedData.enableMdxSupport =', mergedData.enableMdxSupport);
			console.debug('PropertyOverFileNameConfig: Final mergedData =', JSON.stringify(mergedData));
			
			if (dataFile instanceof TFile) {
				await this.app.vault.modify(dataFile, JSON.stringify(mergedData, null, 2));
			} else {
				// Ensure plugin directory exists
				const pluginDir = `${configDir}/plugins/${pluginId}`;
				const pluginDirFile = this.app.vault.getAbstractFileByPath(pluginDir);
				if (!pluginDirFile) {
					try {
						await this.app.vault.createFolder(pluginDir);
					} catch (error: unknown) {
						// Folder might already exist (race condition), ignore error
						if (error instanceof Error && !error.message.includes('already exists')) {
							throw error;
						}
					}
				}
				// Create the file
				await this.app.vault.create(pluginDataPath, JSON.stringify(mergedData, null, 2));
			}
		} catch (error: unknown) {
			console.error('Failed to save Property Over File Name config (fallback):', error);
			throw error;
		}
	}
}

