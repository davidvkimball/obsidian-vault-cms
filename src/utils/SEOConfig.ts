import { App, TFile } from 'obsidian';
import { SEOConfig, ContentTypeConfig, FrontmatterProperties, ProjectDetectionResult } from '../types';
import { PathResolver } from './PathResolver';

export class SEOConfigurator {
	private app: App;
	private pathResolver: PathResolver;

	constructor(app: App) {
		this.app = app;
		this.pathResolver = new PathResolver(app);
	}

	generateSEOConfig(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties },
		projectDetection?: ProjectDetectionResult
	): SEOConfig {
		// Use the first content type's properties as defaults
		const firstType = contentTypes.find(ct => ct.enabled);
		const firstProps = firstType ? frontmatterProperties[firstType.id] : undefined;

		// Build scan directories from all enabled content types
		const scanDirectories = contentTypes
			.filter(ct => ct.enabled)
			.map(ct => this.pathResolver.getFolderPathFromVaultRoot(ct.folder, projectDetection))
			.join(',');

		const config: SEOConfig = {
			// Only set titleProperty if it exists (not blank) - this comes from the wizard
			titleProperty: firstProps?.titleProperty && firstProps.titleProperty.trim() !== '' 
				? firstProps.titleProperty 
				: 'title', // Default fallback
			// Only set descriptionProperty if it exists (not blank) - this comes from the wizard
			descriptionProperty: firstProps?.descriptionProperty && firstProps.descriptionProperty.trim() !== ''
				? firstProps.descriptionProperty
				: undefined,
			scanDirectories: scanDirectories,
			// Don't set these - we don't collect them in the wizard
			keywordProperty: undefined,
			useFilenameAsTitle: false,
			useFilenameAsSlug: true
		};

		return config;
	}

	async saveConfig(config: SEOConfig): Promise<void> {
		try {
			// Try to use plugin's saveSettings method first (like Astro Composer)
			const plugins = (this.app as any).plugins;
			const seoPlugin = plugins?.plugins?.['seo'];
			
			if (seoPlugin && seoPlugin.settings) {
				const pluginSettings = seoPlugin.settings;
				
				// Update settings from config - only update what we collect in the wizard
				// 1. scanDirectories - always update (generated from content types)
				if (config.scanDirectories) {
					pluginSettings.scanDirectories = config.scanDirectories;
				}
				// 2. titleProperty - update if provided (collected in wizard)
				if (config.titleProperty !== undefined) {
					pluginSettings.titleProperty = config.titleProperty;
				}
				// 3. descriptionProperty - update if provided (collected in wizard)
				if (config.descriptionProperty !== undefined) {
					pluginSettings.descriptionProperty = config.descriptionProperty;
				}
				// Don't update keywordProperty, useFilenameAsTitle, or useFilenameAsSlug
				// - we don't collect these in the wizard, let user configure in SEO plugin settings
				
				// Save the settings using plugin's saveSettings method
				if (typeof seoPlugin.saveSettings === 'function') {
					await seoPlugin.saveSettings();
					console.log('SEOConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}
			
			// Fallback to file method
			await this.saveConfigFallback(config);
		} catch (error) {
			console.error('Failed to save SEO config via plugin method:', error);
			// Fallback to file method
			await this.saveConfigFallback(config);
		}
	}

	private async saveConfigFallback(config: SEOConfig): Promise<void> {
		const pluginId = 'seo';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			let existingData: any = {};
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			
			// Read existing data if file exists
			if (dataFile && dataFile instanceof TFile) {
				try {
					existingData = JSON.parse(await this.app.vault.read(dataFile));
				} catch (error) {
					console.warn('Failed to parse existing SEO data.json, starting fresh:', error);
					existingData = {};
				}
			}
			
			// Merge config into existing data (preserve all existing settings)
			// Only update the properties we collect in the wizard:
			// 1. scanDirectories (generated from content types)
			// 2. titleProperty (collected in wizard)
			// 3. descriptionProperty (collected in wizard)
			// Don't touch keywordProperty, useFilenameAsTitle, useFilenameAsSlug, etc.
			const mergedData = {
				...existingData,
				// Always update scanDirectories
				scanDirectories: config.scanDirectories,
				// Update titleProperty if provided (from wizard)
				...(config.titleProperty !== undefined && { titleProperty: config.titleProperty }),
				// Update descriptionProperty if provided (from wizard)
				...(config.descriptionProperty !== undefined && { descriptionProperty: config.descriptionProperty })
				// All other properties (keywordProperty, useFilenameAsTitle, useFilenameAsSlug, etc.)
				// are preserved from existingData - we don't collect them in the wizard
			};
			
			// Try to modify first, if file doesn't exist it will throw, then create
			if (dataFile && dataFile instanceof TFile) {
				await this.app.vault.modify(dataFile, JSON.stringify(mergedData, null, 2));
				console.log('SEOConfig: Successfully updated SEO plugin data.json (via file)');
			} else {
				// Ensure plugin directory exists
				const pluginDir = `.obsidian/plugins/${pluginId}`;
				const pluginDirFile = this.app.vault.getAbstractFileByPath(pluginDir);
				if (!pluginDirFile) {
					await this.app.vault.createFolder(pluginDir);
				}
				// Create the file
				await this.app.vault.create(pluginDataPath, JSON.stringify(mergedData, null, 2));
				console.log('SEOConfig: Successfully created SEO plugin data.json (via file)');
			}
		} catch (error) {
			console.error('Failed to save SEO config (fallback):', error);
			throw error;
		}
	}
}

