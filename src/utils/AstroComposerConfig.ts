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

		// Find posts and pages content types
		const postsType = contentTypes.find(ct => 
			ct.name === 'Posts' && ct.enabled
		);
		const pagesType = contentTypes.find(ct => 
			ct.name === 'Pages' && ct.enabled
		);

		if (postsType) {
			const props = frontmatterProperties[postsType.id];
			config.postsFolder = postsType.folder;
			config.postsCreationMode = this.getCreationModeFromAttachmentHandling(postsType.attachmentHandlingMode);
			config.postsIndexFileName = postsType.indexFileName || 'index';
			// Use template from props if available, otherwise generate
			config.defaultTemplate = props?.template || this.generateTemplate(props, true);
		}

		if (pagesType) {
			const props = frontmatterProperties[pagesType.id];
			config.enablePages = true;
			config.pagesFolder = pagesType.folder;
			config.pagesCreationMode = this.getCreationModeFromAttachmentHandling(pagesType.attachmentHandlingMode);
			config.pagesIndexFileName = pagesType.indexFileName || 'index';
			// Use template from props if available, otherwise generate
			config.pageTemplate = props?.template || this.generateTemplate(props, false);
		}

		// Add custom content types
		for (const contentType of contentTypes) {
			if (contentType.name !== 'Posts' && 
				contentType.name !== 'Pages' && 
				contentType.enabled) {
				const props = frontmatterProperties[contentType.id];
				config.customContentTypes.push({
					id: contentType.id,
					name: contentType.name,
					folder: contentType.folder,
					// Use template from props if available, otherwise generate
					template: props?.template || this.generateTemplate(props, true),
					enabled: true,
					linkBasePath: `/${contentType.folder}/`,
					creationMode: this.getCreationModeFromAttachmentHandling(contentType.attachmentHandlingMode),
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

	private relativePath(absolutePath: string): string {
		const adapter = this.app.vault.adapter as any;
		const vaultPath = adapter.basePath || adapter.path;
		if (!vaultPath) {
			return absolutePath;
		}
		
		const vaultNormalized = path.normalize(vaultPath);
		const absoluteNormalized = path.normalize(absolutePath);
		
		if (absoluteNormalized.startsWith(vaultNormalized)) {
			return absoluteNormalized.slice(vaultNormalized.length + 1);
		}
		
		return absolutePath;
	}

	async saveConfig(config: AstroComposerConfig): Promise<void> {
		const pluginId = 'astro-composer';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			let existingData: any = {};
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			
			// Always read existing data if file exists
			if (dataFile && dataFile instanceof TFile) {
				try {
					existingData = JSON.parse(await this.app.vault.read(dataFile));
				} catch (error) {
					console.warn('Failed to parse existing Astro Composer data.json, starting fresh:', error);
					existingData = {};
				}
			}
			
			// Update templates from config
			if (config.defaultTemplate) {
				existingData.defaultTemplate = config.defaultTemplate;
			}
			if (config.pageTemplate) {
				existingData.pageTemplate = config.pageTemplate;
			}
			
			// Update posts/pages folder settings
			if (config.postsFolder) {
				existingData.postsFolder = config.postsFolder;
			}
			if (config.postsCreationMode) {
				existingData.creationMode = config.postsCreationMode;
			}
			if (config.postsIndexFileName) {
				existingData.indexFileName = config.postsIndexFileName;
			}
			if (config.enablePages !== undefined) {
				existingData.enablePages = config.enablePages;
			}
			if (config.pagesFolder) {
				existingData.pagesFolder = config.pagesFolder;
			}
			if (config.pagesCreationMode) {
				existingData.pagesCreationMode = config.pagesCreationMode;
			}
			if (config.pagesIndexFileName) {
				existingData.pagesIndexFileName = config.pagesIndexFileName;
			}
			
			// Update config paths
			if (config.configFilePath) {
				existingData.configFilePath = config.configFilePath;
			}
			if (config.terminalProjectRootPath) {
				existingData.terminalProjectRootPath = config.terminalProjectRootPath;
			}
			
			// Merge customContentTypes properly - update existing ones, add new ones
			existingData.customContentTypes = this.mergeCustomContentTypes(
				existingData.customContentTypes || [],
				config.customContentTypes || []
			);
			
			// Always modify if file exists, create if it doesn't
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
						// Folder might already exist, ignore error
						if (!error.message || !error.message.includes('already exists')) {
							console.warn('AstroComposerConfig: Could not create plugin directory:', error);
						}
					}
				}
				// Create file if it doesn't exist
				try {
					await this.app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
				} catch (error: any) {
					// File might have been created between check and create, try to modify
					if (error.message && error.message.includes('already exists')) {
						const existingFile = this.app.vault.getAbstractFileByPath(pluginDataPath) as TFile;
						if (existingFile) {
							await this.app.vault.modify(existingFile, JSON.stringify(existingData, null, 2));
						} else {
							throw error;
						}
					} else {
						throw error;
					}
				}
			}
		} catch (error: any) {
			console.error('Failed to save Astro Composer config:', error);
			// If file already exists error, try to modify instead
			if (error.message && error.message.includes('already exists')) {
				const existingFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
				if (existingFile) {
					try {
						const existingData = JSON.parse(await this.app.vault.read(existingFile as TFile));
						// Merge config into existing data
						const mergedData = { ...existingData, ...config };
						mergedData.customContentTypes = this.mergeCustomContentTypes(
							existingData.customContentTypes || [],
							config.customContentTypes || []
						);
						await this.app.vault.modify(existingFile as TFile, JSON.stringify(mergedData, null, 2));
					} catch (modifyError) {
						console.error('Failed to modify Astro Composer config after create error:', modifyError);
					}
				}
			} else {
				throw error;
			}
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

