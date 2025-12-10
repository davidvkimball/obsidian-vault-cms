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
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties },
		defaultContentTypeId?: string
	): Promise<void> {
		const baseFilePath = 'bases/Home.base';
		
		// Ensure bases directory exists
		const basesFolder = this.app.vault.getAbstractFileByPath('bases');
		if (!basesFolder) {
			try {
				await this.app.vault.createFolder('bases');
			} catch (error: any) {
				// Folder might already exist, ignore error
				if (!error.message || !error.message.includes('already exists')) {
					console.warn('BasesCMSConfig: Could not create bases folder:', error);
				}
			}
		}

		// Check if file exists (re-check after folder creation)
		let baseFile = this.app.vault.getAbstractFileByPath(baseFilePath) as TFile;

		// Read existing base file if it exists
		let existingBase: any = null;
		if (baseFile && baseFile instanceof TFile) {
			try {
				const content = await this.app.vault.read(baseFile);
				existingBase = yaml.load(content) as any;
			} catch (error) {
				console.error('BasesCMSConfig: Failed to parse existing base file:', error);
			}
		}

		const enabledTypes = contentTypes.filter(ct => ct.enabled);
		console.log('BasesCMSConfig: Generating base content for', contentTypes.length, 'content types');
		console.log('BasesCMSConfig: Enabled content types:', enabledTypes.map(ct => ct.name));
		
		const baseContent = this.generateBaseContent(contentTypes, frontmatterProperties, defaultContentTypeId, existingBase);
		
		// Count views in generated content to verify they're being created
		const viewMatches = baseContent.match(/^\s*-\s+type:\s+bases-cms/gm);
		const viewCount = viewMatches ? viewMatches.length : 0;
		console.log('BasesCMSConfig: Generated', viewCount, 'views in base content');
		
		// Always modify if file exists, create if it doesn't
		if (baseFile && baseFile instanceof TFile) {
			console.log('BasesCMSConfig: Modifying existing Home.base file');
			await this.app.vault.modify(baseFile, baseContent);
			console.log('BasesCMSConfig: Successfully modified Home.base file');
		} else {
			console.log('BasesCMSConfig: Creating new Home.base file');
			try {
				await this.app.vault.create(baseFilePath, baseContent);
				console.log('BasesCMSConfig: Successfully created Home.base file');
				// Verify the file was created by reading it back
				const createdFile = this.app.vault.getAbstractFileByPath(baseFilePath) as TFile;
				if (createdFile && createdFile instanceof TFile) {
					console.log('BasesCMSConfig: Verified Home.base file exists');
				} else {
					console.warn('BasesCMSConfig: File created but cannot be verified - this may be a timing issue');
				}
			} catch (error: any) {
				// File might have been created between check and create, try to modify
				if (error.message && error.message.includes('already exists')) {
					// Re-check for the file
					const existingFile = this.app.vault.getAbstractFileByPath(baseFilePath) as TFile;
					if (existingFile && existingFile instanceof TFile) {
						console.log('BasesCMSConfig: File existed, modifying instead');
						await this.app.vault.modify(existingFile, baseContent);
						console.log('BasesCMSConfig: Successfully modified existing Home.base file');
					} else {
						console.error('BasesCMSConfig: File should exist but cannot be found');
						throw error;
					}
				} else {
					console.error('BasesCMSConfig: Failed to create base file:', error);
					throw error;
				}
			}
		}
	}

	private generateBaseContent(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties },
		defaultContentTypeId: string | undefined,
		existingBase: any
	): string {
		// Bases uses a specific syntax - we need to generate it manually to match the format
		const lines: string[] = [];
		
		// Preserve formulas if they exist
		if (existingBase?.formulas) {
			lines.push('formulas:');
			for (const [key, value] of Object.entries(existingBase.formulas)) {
				if (typeof value === 'string') {
					lines.push(`  ${key}: |-`);
					const formulaLines = value.split('\n');
					for (const formulaLine of formulaLines) {
						lines.push(`    ${formulaLine}`);
					}
				}
			}
			lines.push('');
		}
		
		// Filters section
		lines.push('filters:');
		lines.push('  and:');
		lines.push('    - file.ext == "md"');
		lines.push('');

		// Properties section - collect all properties from content types
		const allProperties = new Set<string>();
		for (const contentType of contentTypes) {
			const props = frontmatterProperties[contentType.id];
			if (props) {
				allProperties.add(`note.${props.titleProperty}`);
				allProperties.add(`note.${props.dateProperty}`);
				if (props.descriptionProperty) {
					allProperties.add(`note.${props.descriptionProperty}`);
				}
				if (props.tagsProperty) {
					allProperties.add(`note.${props.tagsProperty}`);
				}
				if (props.draftProperty) {
					allProperties.add(`note.${props.draftProperty}`);
				}
				if (props.imageProperty) {
					allProperties.add(`note.${props.imageProperty}`);
				}
			}
		}

		// Add common properties
		allProperties.add('note.title');
		allProperties.add('note.date');
		allProperties.add('note.pubDate');
		allProperties.add('note.draft');
		allProperties.add('file.name'); // Always include file name

		// Preserve formula properties if they exist
		if (existingBase?.properties) {
			for (const prop of Object.keys(existingBase.properties)) {
				if (prop.startsWith('formula.')) {
					allProperties.add(prop);
				}
			}
		}

		if (allProperties.size > 0) {
			lines.push('properties:');
			// Preserve existing property displayNames, especially for file.name
			const existingProps = existingBase?.properties || {};
			for (const prop of Array.from(allProperties).sort()) {
				lines.push(`  ${prop}:`);
				// Preserve existing displayName if it exists, especially for file.name
				if (existingProps[prop]?.displayName) {
					lines.push(`    displayName: ${existingProps[prop].displayName}`);
				} else {
					const propName = prop.replace('note.', '').replace('file.', '');
					lines.push(`    displayName: ${this.capitalizeFirst(propName)}`);
				}
			}
			lines.push('');
		}

		// Views section - preserve existing views and update/add new ones
		lines.push('views:');
		
		// Find default content type
		const defaultContentType = defaultContentTypeId ? 
			contentTypes.find(ct => ct.id === defaultContentTypeId && ct.enabled) : null;
		
		// Update or create "All Content" view
		const allContentView = existingBase?.views?.find((v: any) => v.name === 'All Content');
		const defaultProps = defaultContentType ? frontmatterProperties[defaultContentType.id] : 
			(frontmatterProperties[Object.keys(frontmatterProperties)[0]]);
		
		if (defaultProps) {
			// Always update/create "All Content" view
			lines.push('  - type: bases-cms');
			lines.push(`    name: All Content`);
			lines.push('    filters:');
			lines.push('      and:');
			lines.push(`        - file.ext == "md"`);
			
			// Preserve groupBy if it exists (for folder grouping)
			if (allContentView?.groupBy) {
				lines.push(`    groupBy:`);
				if (typeof allContentView.groupBy === 'object' && allContentView.groupBy.property) {
					lines.push(`      property: ${allContentView.groupBy.property}`);
					lines.push(`      direction: ${allContentView.groupBy.direction || 'ASC'}`);
				}
			}
			
			// Preserve order if it exists
			if (allContentView?.order) {
				lines.push(`    order:`);
				for (const orderItem of allContentView.order) {
					lines.push(`      - ${orderItem}`);
				}
			} else {
				lines.push(`    order:`);
				lines.push(`      - file.name`);
			}
			
			lines.push(`    sort:`);
			if (defaultProps.dateProperty) {
				lines.push(`      - property: note.${defaultProps.dateProperty}`);
			} else {
				lines.push(`      - property: file.ctime`);
			}
			lines.push(`        direction: DESC`);
			lines.push(`    fallbackToEmbeds: ${allContentView?.fallbackToEmbeds || 'if-empty'}`);
			lines.push(`    propertyDisplay1: file.name`);
			lines.push(`    showTextPreview: ${allContentView?.showTextPreview !== false ? 'true' : 'false'}`);
			lines.push(`    imageFormat: cover`);
			lines.push(`    showDate: true`);
			lines.push(`    showDraftStatus: ${defaultProps.draftProperty ? 'true' : (allContentView?.showDraftStatus ? 'true' : 'false')}`);
			lines.push(`    propertyLabels: above`);
			// Handle blank title/date properties
			if (defaultProps.titleProperty) {
				lines.push(`    titleProperty: note.${defaultProps.titleProperty}`);
			} else {
				lines.push(`    titleProperty: file.name`);
			}
			if (defaultProps.dateProperty) {
				lines.push(`    dateProperty: note.${defaultProps.dateProperty}`);
			} else {
				lines.push(`    dateProperty: file.ctime`);
			}
			if (defaultProps.descriptionProperty) {
				lines.push(`    descriptionProperty: note.${defaultProps.descriptionProperty}`);
			}
			if (defaultProps.imageProperty) {
				lines.push(`    imageProperty: note.${defaultProps.imageProperty}`);
			}
			lines.push(`    propertyLayout12SideBySide: ${allContentView?.propertyLayout12SideBySide ? 'true' : 'false'}`);
			lines.push(`    propertyLayout34SideBySide: ${allContentView?.propertyLayout34SideBySide ? 'true' : 'false'}`);
			lines.push(`    showTags: ${defaultProps.tagsProperty ? 'true' : 'false'}`);
			if (defaultProps.tagsProperty) {
				lines.push(`    tagsProperty: note.${defaultProps.tagsProperty}`);
			}
			if (defaultProps.draftProperty) {
				lines.push(`    draftStatusProperty: note.${defaultProps.draftProperty}`);
			}
			lines.push(`    customizeNewButton: true`);
			if (defaultContentType) {
				lines.push(`    newNoteLocation: "${defaultContentType.folder}"`);
			} else {
				lines.push(`    newNoteLocation: ""`);
			}
			lines.push(`    cardSize: ${allContentView?.cardSize || 250}`);
			lines.push(`    imageAspectRatio: ${allContentView?.imageAspectRatio || 0.55}`);
			lines.push(`    maxTagsToShow: ${allContentView?.maxTagsToShow || 2}`);
			lines.push(`    dateIncludeTime: ${allContentView?.dateIncludeTime ? 'true' : 'false'}`);
		}
		
		// Add views for each enabled content type
		for (const contentType of contentTypes) {
			if (!contentType.enabled) {
				continue;
			}

			// Skip "All Content" view - it's already handled above
			if (contentType.name === 'All Content') {
				continue;
			}

			// Check if this view already exists (preserve existing views)
			const existingView = existingBase?.views?.find((v: any) => v.name === contentType.name);
			if (existingView) {
				// Update existing view instead of skipping
				// We'll add it anyway to ensure it has the latest properties
			}

			const props = frontmatterProperties[contentType.id];
			if (!props) {
				continue;
			}

			lines.push('  - type: bases-cms');
			lines.push(`    name: ${contentType.name}`);
			lines.push('    filters:');
			lines.push('      and:');
			lines.push(`        - file.folder.startsWith("${contentType.folder}")`);
			lines.push(`    imageFormat: cover`);
			// Handle blank title/date properties
			if (props.titleProperty) {
				lines.push(`    titleProperty: note.${props.titleProperty}`);
			} else {
				lines.push(`    titleProperty: file.name`);
			}
			if (props.dateProperty) {
				lines.push(`    dateProperty: note.${props.dateProperty}`);
			} else {
				lines.push(`    dateProperty: file.ctime`);
			}
			if (props.descriptionProperty) {
				lines.push(`    descriptionProperty: note.${props.descriptionProperty}`);
			}
			if (props.imageProperty) {
				lines.push(`    imageProperty: note.${props.imageProperty}`);
			}
			lines.push(`    showTags: ${props.tagsProperty ? 'true' : 'false'}`);
			if (props.tagsProperty) {
				lines.push(`    tagsProperty: note.${props.tagsProperty}`);
			}
			lines.push(`    showDate: true`);
			lines.push(`    showDraftStatus: ${props.draftProperty ? 'true' : 'false'}`);
			if (props.draftProperty) {
				lines.push(`    draftStatusProperty: note.${props.draftProperty}`);
			}
			lines.push(`    customizeNewButton: true`);
			lines.push(`    newNoteLocation: "${contentType.folder}"`);
			lines.push(`    fallbackToEmbeds: if-empty`);
			lines.push(`    propertyDisplay1: file.name`);
			lines.push(`    showTextPreview: true`);
			lines.push(`    propertyLabels: above`);
			// Sort by date property (newest to oldest)
			lines.push(`    sort:`);
			if (props.dateProperty) {
				lines.push(`      - property: note.${props.dateProperty}`);
			} else {
				lines.push(`      - property: file.ctime`);
			}
			lines.push(`        direction: DESC`);
		}

		// Set default view (first view is default)
		// The "All Content" view should be first, so it's already the default
		
		return lines.join('\n');
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

