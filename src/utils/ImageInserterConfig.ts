import { App, TFile } from 'obsidian';
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
			// Try to use plugin's saveSettings method first (like Astro Composer)
			const plugins = (this.app as any).plugins;
			const imageInserterPlugin = plugins?.plugins?.[pluginId];
			
			if (imageInserterPlugin && imageInserterPlugin.settings) {
				// Update via plugin settings API (matching astro-modular-settings pattern)
				const pluginSettings = imageInserterPlugin.settings;
				
				// Initialize frontmatter object if it doesn't exist
				if (!pluginSettings.frontmatter) {
					pluginSettings.frontmatter = {};
				}
				
				// Update frontmatter.valueFormat (this is the main setting)
				if (config.valueFormat) {
					pluginSettings.frontmatter.valueFormat = config.valueFormat;
				}
				
				// Update frontmatter.key if imageProperty is provided
				if (imageProperty) {
					pluginSettings.frontmatter.key = imageProperty;
				}
				
				if (typeof imageInserterPlugin.saveSettings === 'function') {
					await imageInserterPlugin.saveSettings();
					console.log('ImageInserterConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}
			
			// Fallback to file method (like Astro Composer fallback)
			await this.saveConfigFallback(config, imageProperty);
		} catch (error) {
			console.error('Failed to save Image Inserter config:', error);
			// Try fallback even if plugin method fails
			try {
				await this.saveConfigFallback(config, imageProperty);
			} catch (fallbackError) {
				console.error('Failed to save Image Inserter config via fallback:', fallbackError);
			}
		}
	}

	private async saveConfigFallback(config: ImageInserterConfig, imageProperty?: string): Promise<void> {
		const pluginId = 'insert-unsplash-image';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		let existingData: any = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile));
			} catch (error) {
				console.warn('Failed to parse existing Image Inserter data.json, starting fresh:', error);
				existingData = {};
			}
		}
		
		// Merge config into existing data (matching plugin structure)
		const mergedData = {
			...existingData
		};
		
		// Initialize frontmatter object if it doesn't exist
		if (!mergedData.frontmatter) {
			mergedData.frontmatter = {};
		}
		
		// Update frontmatter.valueFormat
		if (config.valueFormat) {
			mergedData.frontmatter.valueFormat = config.valueFormat;
		}
		
		// Update frontmatter.key if imageProperty is provided
		if (imageProperty) {
			mergedData.frontmatter.key = imageProperty;
		}
		
		// Try to modify first, if file doesn't exist it will throw, then we create
		if (dataFile && dataFile instanceof TFile) {
			await this.app.vault.modify(dataFile, JSON.stringify(mergedData, null, 2));
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
				await this.app.vault.create(pluginDataPath, JSON.stringify(mergedData, null, 2));
			} catch (error: any) {
				// If file was created between check and create, try to modify it
				if (error.message && (error.message.includes('already exists') || error.message.includes('File already exists'))) {
					const retryFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
					if (retryFile && retryFile instanceof TFile) {
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

