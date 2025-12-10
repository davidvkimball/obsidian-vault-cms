import { App, TFile } from 'obsidian';
import { BasesCMSView, ContentTypeConfig, FrontmatterProperties } from '../types';
import * as yaml from 'js-yaml';

export class BasesCMSConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async createOrUpdateBaseFile(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties }
	): Promise<void> {
		const baseFilePath = 'bases/Home.base';
		let baseFile = this.app.vault.getAbstractFileByPath(baseFilePath) as TFile;

		const baseContent = this.generateBaseContent(contentTypes, frontmatterProperties);

		if (baseFile) {
			await this.app.vault.modify(baseFile, baseContent);
		} else {
			// Create the bases directory if it doesn't exist
			const basesFolder = this.app.vault.getAbstractFileByPath('bases');
			if (!basesFolder) {
				await this.app.vault.createFolder('bases');
			}
			await this.app.vault.create(baseFilePath, baseContent);
		}
	}

	private generateBaseContent(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties }
	): string {
		// Convert BasesCMSView to plain object for YAML serialization
		const base: any = {
			filters: {
				and: [
					{ 'file.ext': 'md' }
				]
			},
			properties: {},
			views: []
		};

		// Add properties
		const allProperties = new Set<string>();
		for (const contentType of contentTypes) {
			const props = frontmatterProperties[contentType.id];
			if (props) {
				allProperties.add(`note.${props.titleProperty}`);
				allProperties.add(`note.${props.dateProperty}`);
				if (props.descriptionProperty) {
					allProperties.add(`note.${props.descriptionProperty}`);
				}
			}
		}

		// Add common properties
		allProperties.add('note.title');
		allProperties.add('note.date');
		allProperties.add('note.pubDate');
		allProperties.add('note.draft');

		for (const prop of allProperties) {
			const propName = prop.replace('note.', '');
			base.properties[prop] = {
				displayName: this.capitalizeFirst(propName)
			};
		}

		// Generate views for each content type
		for (const contentType of contentTypes) {
			if (!contentType.enabled) {
				continue;
			}

			const props = frontmatterProperties[contentType.id];
			if (!props) {
				continue;
			}

			const view: BasesCMSView = {
				name: contentType.name,
				filters: {
					and: [
						{ 'file.folder.startsWith': contentType.folder }
					]
				},
				titleProperty: `note.${props.titleProperty}`,
				dateProperty: `note.${props.dateProperty}`,
				descriptionProperty: props.descriptionProperty ? `note.${props.descriptionProperty}` : undefined,
				imageFormat: 'cover',
				showDate: true,
				showDraftStatus: true,
				showTags: true,
				tagsProperty: 'note.tags',
				customizeNewButton: true,
				newNoteLocation: contentType.folder,
				sort: [
					{ property: props.dateProperty, direction: 'DESC' }
				]
			};

			base.views.push(view);
		}

		// Convert to YAML
		return yaml.dump(base, { 
			indent: 2,
			lineWidth: -1,
			noRefs: true
		});
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

