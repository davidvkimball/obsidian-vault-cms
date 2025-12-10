import { App } from 'obsidian';
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
			ct.name === 'Blog Posts' && ct.enabled
		);
		const pagesType = contentTypes.find(ct => 
			ct.name === 'Standard Pages' && ct.enabled
		);

		if (postsType) {
			const props = frontmatterProperties[postsType.id];
			config.postsFolder = postsType.folder;
			config.postsCreationMode = postsType.organizationMode;
			config.postsIndexFileName = postsType.indexFileName || 'index';
			config.defaultTemplate = this.generateTemplate(props, true);
		}

		if (pagesType) {
			const props = frontmatterProperties[pagesType.id];
			config.enablePages = true;
			config.pagesFolder = pagesType.folder;
			config.pagesCreationMode = pagesType.organizationMode;
			config.pagesIndexFileName = pagesType.indexFileName || 'index';
			config.pageTemplate = this.generateTemplate(props, false);
		}

		// Add custom content types
		for (const contentType of contentTypes) {
			if (contentType.name !== 'Blog Posts' && 
				contentType.name !== 'Standard Pages' && 
				contentType.enabled) {
				const props = frontmatterProperties[contentType.id];
				config.customContentTypes.push({
					id: contentType.id,
					name: contentType.name,
					folder: contentType.folder,
					template: this.generateTemplate(props, true),
					enabled: true,
					linkBasePath: `/${contentType.folder}/`,
					creationMode: contentType.organizationMode,
					indexFileName: contentType.indexFileName || 'index'
				});
			}
		}

		return config;
	}

	private generateTemplate(props: FrontmatterProperties | undefined, includeDate: boolean): string {
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
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile) {
				const existingData = JSON.parse(await this.app.vault.read(dataFile as any));
				const mergedData = { ...existingData, ...config };
				await this.app.vault.modify(dataFile as any, JSON.stringify(mergedData, null, 2));
			}
		} catch (error) {
			console.error('Failed to save Astro Composer config:', error);
		}
	}
}

