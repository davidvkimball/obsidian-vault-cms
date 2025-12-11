import { App, TFile } from 'obsidian';
import { AstroComposerConfig, ContentTypeConfig, FrontmatterProperties } from '../types';
import * as path from 'path';

export class AstroComposerConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async configureAstroComposer(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties },
		projectRoot: string,
		configFilePath: string
	): Promise<AstroComposerConfig> {
		const config: AstroComposerConfig = {
			customContentTypes: [],
			defaultTemplate: '',
			configFilePath: this.relativePath(configFilePath),
			terminalProjectRootPath: this.relativePath(projectRoot)
		};

		// Find posts and pages content types (for legacy support)
		const postsType = contentTypes.find(ct => 
			ct.name === 'Posts' && ct.enabled
		);
		const pagesType = contentTypes.find(ct => 
			ct.name === 'Pages' && ct.enabled
		);

		if (postsType) {
			const props = frontmatterProperties[postsType.id];
			config.postsFolder = postsType.folder;
			config.postsCreationMode = postsType.fileOrganization;
			config.postsIndexFileName = postsType.indexFileName || 'index';
			// Use template from props if available, otherwise generate
			config.defaultTemplate = props?.template || this.generateTemplate(props, true);
		}

		if (pagesType) {
			const props = frontmatterProperties[pagesType.id];
			config.enablePages = true;
			config.pagesFolder = pagesType.folder;
			config.pagesCreationMode = pagesType.fileOrganization;
			config.pagesIndexFileName = pagesType.indexFileName || 'index';
			// Use template from props if available, otherwise generate
			config.pageTemplate = props?.template || this.generateTemplate(props, false);
		}

		// Add all enabled content types to customContentTypes (new unified structure)
		for (const contentType of contentTypes) {
			if (contentType.enabled) {
				const props = frontmatterProperties[contentType.id];
				// Determine linkBasePath: use specified, or default to /folderName/
				// If blank, default to /folderName/. If "/", use "/" for root.
				let linkBasePath = contentType.linkBasePath;
				if (linkBasePath === undefined || linkBasePath === '') {
					// Default: use folder name
					linkBasePath = `/${contentType.folder}/`;
				}
				// If user specified "/", keep it as "/" for root
				
				config.customContentTypes.push({
					id: contentType.id,
					name: contentType.name,
					folder: contentType.folder,
					// Use template from props if available, otherwise generate
					template: props?.template || this.generateTemplate(props, contentType.name === 'Posts' || contentType.name === 'Pages'),
					enabled: true,
					linkBasePath: linkBasePath,
					creationMode: contentType.fileOrganization,
					indexFileName: contentType.indexFileName || 'index'
				});
			}
		}

		return config;
	}

	private generateTemplate(props: FrontmatterProperties | undefined, includeDate: boolean): string {
		// Use template from props if available, otherwise generate default
		if (props?.template) {
			return props.template;
		}

		if (!props) {
			return '---\ntitle: "{{title}}"\n---\n';
		}

		let template = '---\n';
		template += `${props.titleProperty}: "{{title}}"\n`;
		
		if (includeDate) {
			template += `${props.dateProperty}: {{date}}\n`;
		}
		
		if (props.descriptionProperty) {
			template += `${props.descriptionProperty}: ""\n`;
		}
		
		template += 'tags: []\n';
		template += 'draft: true\n';
		template += '---\n';

		return template;
	}

	private getCreationModeFromAttachmentHandling(mode: 'specified-folder' | 'same-folder' | 'subfolder'): 'file' | 'folder' {
		// same-folder means attachments are in the same folder as the file (folder-based approach)
		// specified-folder and subfolder mean attachments are in separate folders (file-based approach)
		return mode === 'same-folder' ? 'folder' : 'file';
	}

	private relativePath(inputPath: string): string {
		// If path is already relative, return as-is
		if (!path.isAbsolute(inputPath)) {
			return inputPath;
		}
		
		// Convert absolute path to relative from vault root
		const adapter = this.app.vault.adapter as any;
		const vaultPath = adapter.basePath || adapter.path;
		if (!vaultPath) {
			return inputPath;
		}
		
		const vaultNormalized = path.normalize(vaultPath);
		const absoluteNormalized = path.normalize(inputPath);
		
		if (absoluteNormalized.startsWith(vaultNormalized)) {
			const relative = absoluteNormalized.slice(vaultNormalized.length);
			// Remove leading path separator
			return relative.startsWith(path.sep) ? relative.slice(1) : relative;
		}
		
		// Path is outside vault, return as-is
		return inputPath;
	}

	async saveConfig(config: AstroComposerConfig): Promise<void> {
		try {
			// Use plugin's saveSettings method like astro-modular-settings does
			const plugins = (this.app as any).plugins;
			const astroComposerPlugin = plugins?.plugins?.['astro-composer'];
			
			if (!astroComposerPlugin) {
				console.warn('AstroComposerConfig: Astro Composer plugin not found, using fallback file method');
				await this.saveConfigFallback(config);
				return;
			}
			
			if (!astroComposerPlugin.settings) {
				console.warn('AstroComposerConfig: Astro Composer plugin settings not available, using fallback file method');
				await this.saveConfigFallback(config);
				return;
			}
			
			const pluginSettings = astroComposerPlugin.settings;
			
			// Update templates from config
			if (config.defaultTemplate) {
				pluginSettings.defaultTemplate = config.defaultTemplate;
			}
			if (config.pageTemplate) {
				pluginSettings.pageTemplate = config.pageTemplate;
			}
			
			// Update posts/pages folder settings
			if (config.postsFolder) {
				pluginSettings.postsFolder = config.postsFolder;
			}
			if (config.postsCreationMode) {
				pluginSettings.creationMode = config.postsCreationMode;
			}
			if (config.postsIndexFileName) {
				pluginSettings.indexFileName = config.postsIndexFileName;
			}
			if (config.enablePages !== undefined) {
				pluginSettings.enablePages = config.enablePages;
			}
			if (config.pagesFolder) {
				pluginSettings.pagesFolder = config.pagesFolder;
			}
			if (config.pagesCreationMode) {
				pluginSettings.pagesCreationMode = config.pagesCreationMode;
			}
			if (config.pagesIndexFileName) {
				pluginSettings.pagesIndexFileName = config.pagesIndexFileName;
			}
			
			// Update config paths
			if (config.configFilePath) {
				pluginSettings.configFilePath = config.configFilePath;
			}
			if (config.terminalProjectRootPath) {
				pluginSettings.terminalProjectRootPath = config.terminalProjectRootPath;
			}
			
			// Update contentTypes array (new unified structure)
			// Initialize contentTypes array if it doesn't exist
			if (!Array.isArray(pluginSettings.contentTypes)) {
				pluginSettings.contentTypes = [];
			}
			
			// Merge/update contentTypes array - match by name AND folder to find existing entries
			for (const newType of config.customContentTypes) {
				// Find existing entry by name AND folder (not just id, since ids might differ)
				const existingIndex = pluginSettings.contentTypes.findIndex((ct: any) => 
					ct.name === newType.name && ct.folder === newType.folder
				);
				if (existingIndex >= 0) {
					// Update existing entry - preserve other properties like ignoreSubfolders, enableUnderscorePrefix, and existing id
					pluginSettings.contentTypes[existingIndex] = {
						...pluginSettings.contentTypes[existingIndex],
						name: newType.name,
						folder: newType.folder,
						linkBasePath: newType.linkBasePath,
						template: newType.template,
						enabled: newType.enabled,
						creationMode: newType.creationMode,
						indexFileName: newType.indexFileName
					};
				} else {
					// Add new entry with all required properties
					pluginSettings.contentTypes.push({
						id: newType.id,
						name: newType.name,
						folder: newType.folder,
						linkBasePath: newType.linkBasePath,
						template: newType.template,
						enabled: newType.enabled,
						creationMode: newType.creationMode,
						indexFileName: newType.indexFileName,
						ignoreSubfolders: false,
						enableUnderscorePrefix: false
					});
				}
			}
			
			// Also update legacy customContentTypes for backwards compatibility
			pluginSettings.customContentTypes = this.mergeCustomContentTypes(
				pluginSettings.customContentTypes || [],
				config.customContentTypes || []
			);
			
			// Save the settings using plugin's saveSettings method
			if (typeof astroComposerPlugin.saveSettings === 'function') {
				await astroComposerPlugin.saveSettings();
				console.log('AstroComposerConfig: Successfully saved via plugin.saveSettings()');
			} else {
				console.warn('AstroComposerConfig: Plugin saveSettings not available, using fallback');
				await this.saveConfigFallback(config);
			}
		} catch (error) {
			console.error('Failed to save Astro Composer config via plugin method:', error);
			// Fallback to file method
			await this.saveConfigFallback(config);
		}
	}

	private async saveConfigFallback(config: AstroComposerConfig): Promise<void> {
		const pluginId = 'astro-composer';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		let existingData: any = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		// Read existing data if file exists
		if (dataFile && dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile));
			} catch (error) {
				console.warn('Failed to parse existing Astro Composer data.json, starting fresh:', error);
				existingData = {};
			}
		}
		
		// Merge config into existing data
		if (config.defaultTemplate) existingData.defaultTemplate = config.defaultTemplate;
		if (config.pageTemplate) existingData.pageTemplate = config.pageTemplate;
		if (config.postsFolder) existingData.postsFolder = config.postsFolder;
		if (config.postsCreationMode) existingData.creationMode = config.postsCreationMode;
		if (config.postsIndexFileName) existingData.indexFileName = config.postsIndexFileName;
		if (config.enablePages !== undefined) existingData.enablePages = config.enablePages;
		if (config.pagesFolder) existingData.pagesFolder = config.pagesFolder;
		if (config.pagesCreationMode) existingData.pagesCreationMode = config.pagesCreationMode;
		if (config.pagesIndexFileName) existingData.pagesIndexFileName = config.pagesIndexFileName;
		if (config.configFilePath) existingData.configFilePath = config.configFilePath;
		if (config.terminalProjectRootPath) existingData.terminalProjectRootPath = config.terminalProjectRootPath;
		
		// Update contentTypes array (new unified structure)
		if (!Array.isArray(existingData.contentTypes)) {
			existingData.contentTypes = [];
		}
		
		// Merge/update contentTypes array - match by name AND folder to find existing entries
		for (const newType of config.customContentTypes) {
			// Find existing entry by name AND folder (not just id, since ids might differ)
			const existingIndex = existingData.contentTypes.findIndex((ct: any) => 
				ct.name === newType.name && ct.folder === newType.folder
			);
			if (existingIndex >= 0) {
				// Update existing entry - preserve other properties and existing id
				existingData.contentTypes[existingIndex] = {
					...existingData.contentTypes[existingIndex],
					name: newType.name,
					folder: newType.folder,
					linkBasePath: newType.linkBasePath,
					template: newType.template,
					enabled: newType.enabled,
					creationMode: newType.creationMode,
					indexFileName: newType.indexFileName
				};
			} else {
				// Add new entry
				existingData.contentTypes.push({
					id: newType.id,
					name: newType.name,
					folder: newType.folder,
					linkBasePath: newType.linkBasePath,
					template: newType.template,
					enabled: newType.enabled,
					creationMode: newType.creationMode,
					indexFileName: newType.indexFileName,
					ignoreSubfolders: false,
					enableUnderscorePrefix: false
				});
			}
		}
		
		// Also update legacy customContentTypes for backwards compatibility
		existingData.customContentTypes = this.mergeCustomContentTypes(
			existingData.customContentTypes || [],
			config.customContentTypes || []
		);
		
		// Try to modify first, if file doesn't exist it will throw, then create
		if (dataFile && dataFile instanceof TFile) {
			await this.app.vault.modify(dataFile, JSON.stringify(existingData, null, 2));
		} else {
			// Ensure plugin directory exists
			const pluginDir = `.obsidian/plugins/${pluginId}`;
			const pluginDirFile = this.app.vault.getAbstractFileByPath(pluginDir);
			if (!pluginDirFile) {
				await this.app.vault.createFolder(pluginDir);
			}
			// Create the file
			await this.app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
		}
	}

	private mergeCustomContentTypes(existing: any[], newTypes: any[]): any[] {
		const merged = [...existing];
		
		for (const newType of newTypes) {
			const existingIndex = merged.findIndex(ct => ct.id === newType.id);
			if (existingIndex >= 0) {
				// Update existing
				merged[existingIndex] = { ...merged[existingIndex], ...newType };
			} else {
				// Add new
				merged.push(newType);
			}
		}
		
		return merged;
	}
}

