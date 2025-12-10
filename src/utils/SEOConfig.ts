import { App } from 'obsidian';
import { SEOConfig, ContentTypeConfig, FrontmatterProperties } from '../types';

export class SEOConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	generateSEOConfig(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties }
	): SEOConfig {
		// Use the first content type's properties as defaults
		const firstType = contentTypes.find(ct => ct.enabled);
		const firstProps = firstType ? frontmatterProperties[firstType.id] : undefined;

		const config: SEOConfig = {
			titleProperty: firstProps?.titleProperty || 'title',
			descriptionProperty: firstProps?.descriptionProperty,
			scanDirectories: contentTypes
				.filter(ct => ct.enabled)
				.map(ct => ct.folder)
				.join(','),
			keywordProperty: 'targetKeyword',
			useFilenameAsTitle: false,
			useFilenameAsSlug: true
		};

		return config;
	}

	async saveConfig(config: SEOConfig): Promise<void> {
		const pluginId = 'seo';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile) {
				const existingData = JSON.parse(await this.app.vault.read(dataFile as any));
				const mergedData = { ...existingData, ...config };
				await this.app.vault.modify(dataFile as any, JSON.stringify(mergedData, null, 2));
			}
		} catch (error) {
			console.error('Failed to save SEO config:', error);
		}
	}
}

