import { App } from 'obsidian';
import { SEOConfig, ContentTypeConfig, FrontmatterProperties, ProjectDetectionResult } from '../types';
import { PathResolver } from './PathResolver';
import { SafeConfigWriter } from './SafeConfigWriter';

type SEOPlugin = {
	settings?: {
		scanDirectories?: string;
		titleProperty?: string;
		descriptionProperty?: string;
		[key: string]: unknown;
	};
	saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
	plugins?: Record<string, SEOPlugin>;
};

export class SEOConfigurator {
	private app: App;
	private pathResolver: PathResolver;
	private safeWriter: SafeConfigWriter;

	constructor(app: App) {
		this.app = app;
		this.pathResolver = new PathResolver(app);
		this.safeWriter = new SafeConfigWriter(app);
	}

	generateSEOConfig(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties },
		projectDetection?: ProjectDetectionResult,
		enableMdxSupport?: boolean,
		defaultContentTypeId?: string
	): SEOConfig {
		// Use the default content type's properties, falling back to first enabled
		const defaultType = defaultContentTypeId
			? contentTypes.find(ct => ct.id === defaultContentTypeId && ct.enabled)
			: undefined;
		const firstType = defaultType || contentTypes.find(ct => ct.enabled);
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
			useFilenameAsSlug: true,
			enableMDXSupport: enableMdxSupport ?? false
		};

		return config;
	}

	async saveConfig(config: SEOConfig): Promise<void> {
		try {
			// Try to use plugin's saveSettings method first (like Astro Composer)
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
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
				// 4. enableMDXSupport - update if provided (collected in wizard)
				if (config.enableMDXSupport !== undefined) {
					pluginSettings.enableMDXSupport = config.enableMDXSupport;
				}
				// Don't update keywordProperty, useFilenameAsTitle, or useFilenameAsSlug
				// - we don't collect these in the wizard, let user configure in SEO plugin settings
				
				// Save the settings using plugin's saveSettings method
				if (typeof seoPlugin.saveSettings === 'function') {
					await seoPlugin.saveSettings();
					console.debug('SEOConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}
			
			// Fallback to file method
			await this.saveConfigFallback(config);
		} catch (error: unknown) {
			console.error('Failed to save SEO config via plugin method:', error);
			// Fallback to file method
			await this.saveConfigFallback(config);
		}
	}

	private async saveConfigFallback(config: SEOConfig): Promise<void> {
		const pluginId = 'seo';

		try {
			// Read existing data safely
			let existingData = await this.safeWriter.readConfig(pluginId);
			if (!existingData) {
				existingData = {};
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
				...(config.descriptionProperty !== undefined && { descriptionProperty: config.descriptionProperty }),
				// Update enableMDXSupport if provided (from wizard)
				...(config.enableMDXSupport !== undefined && { enableMDXSupport: config.enableMDXSupport })
				// All other properties (keywordProperty, useFilenameAsTitle, useFilenameAsSlug, etc.)
				// are preserved from existingData - we don't collect them in the wizard
			};

			// Write config safely with backup and validation
			const success = await this.safeWriter.writeConfig(pluginId, mergedData, {
				showNotice: true,
				createBackup: true
			});

			if (!success) {
				throw new Error('Failed to save SEO configuration');
			}

			console.debug('SEOConfig: Successfully saved SEO plugin configuration');
		} catch (error: unknown) {
			console.error('Failed to save SEO config (fallback):', error);
			throw error;
		}
	}
}

