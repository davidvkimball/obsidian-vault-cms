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
		
		// Always try to modify first - if file doesn't exist, modify will throw, then we create
		// This avoids race conditions with getAbstractFileByPath
		baseFile = this.app.vault.getAbstractFileByPath(baseFilePath) as TFile;
		
		if (baseFile && baseFile instanceof TFile) {
			console.log('BasesCMSConfig: Modifying existing Home.base file');
			try {
				await this.app.vault.modify(baseFile, baseContent);
				console.log('BasesCMSConfig: Successfully modified Home.base file');
				return; // Success, exit early
			} catch (error) {
				console.error('BasesCMSConfig: Failed to modify file:', error);
				throw error;
			}
		}
		
		// File doesn't exist (or can't be found), try to create it
		console.log('BasesCMSConfig: Creating new Home.base file');
		try {
			await this.app.vault.create(baseFilePath, baseContent);
			console.log('BasesCMSConfig: Successfully created Home.base file');
		} catch (error: any) {
			// If create fails because file exists, the file was created between check and create
			// Try to modify it directly using the path string
			if (error.message && (error.message.includes('already exists') || error.message.includes('File already exists'))) {
				console.log('BasesCMSConfig: File existed, attempting direct modify via path');
				// Use adapter to write directly - this bypasses the indexing issue
				try {
					const adapter = this.app.vault.adapter;
					if (adapter && typeof adapter.write === 'function') {
						await adapter.write(baseFilePath, baseContent);
						console.log('BasesCMSConfig: Successfully wrote Home.base file via adapter');
					} else {
						// Fallback: retry getAbstractFileByPath with longer delays
						console.log('BasesCMSConfig: Adapter write not available, retrying getAbstractFileByPath');
						for (let i = 0; i < 10; i++) {
							await new Promise(resolve => setTimeout(resolve, 200));
							const retryFile = this.app.vault.getAbstractFileByPath(baseFilePath) as TFile;
							if (retryFile && retryFile instanceof TFile) {
								await this.app.vault.modify(retryFile, baseContent);
								console.log(`BasesCMSConfig: Successfully modified Home.base file on retry ${i + 1}`);
								return;
							}
						}
						console.error('BasesCMSConfig: File exists but cannot be found after all retries');
						throw new Error('File exists but cannot be accessed. Please try again or manually edit bases/Home.base');
					}
				} catch (writeError) {
					console.error('BasesCMSConfig: Failed to write file via adapter:', writeError);
					throw writeError;
				}
			} else {
				console.error('BasesCMSConfig: Failed to create base file:', error);
				throw error;
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
		
		// Get default props (for "All Content" view)
		const defaultProps = defaultContentType ? frontmatterProperties[defaultContentType.id] : 
			(frontmatterProperties[Object.keys(frontmatterProperties)[0]]);
		
		// FIRST: Add the default content type's view (if it exists and is enabled)
		if (defaultContentType) {
			const defaultViewProps = frontmatterProperties[defaultContentType.id];
			if (defaultViewProps) {
				const existingDefaultView = existingBase?.views?.find((v: any) => v.name === defaultContentType.name);
				
				lines.push('  - type: bases-cms');
				lines.push(`    name: ${defaultContentType.name}`);
				lines.push('    filters:');
				lines.push('      and:');
				lines.push(`        - file.folder.startsWith("${defaultContentType.folder}")`);
				lines.push(`    imageFormat: cover`);
				// Handle blank title/date properties
				if (defaultViewProps.titleProperty) {
					lines.push(`    titleProperty: note.${defaultViewProps.titleProperty}`);
				} else {
					lines.push(`    titleProperty: file.name`);
				}
				if (defaultViewProps.dateProperty) {
					lines.push(`    dateProperty: note.${defaultViewProps.dateProperty}`);
				} else {
					lines.push(`    dateProperty: file.ctime`);
				}
				if (defaultViewProps.descriptionProperty) {
					lines.push(`    descriptionProperty: note.${defaultViewProps.descriptionProperty}`);
				}
				if (defaultViewProps.imageProperty) {
					lines.push(`    imageProperty: note.${defaultViewProps.imageProperty}`);
				}
				lines.push(`    showTags: ${defaultViewProps.tagsProperty ? 'true' : 'false'}`);
				if (defaultViewProps.tagsProperty) {
					lines.push(`    tagsProperty: note.${defaultViewProps.tagsProperty}`);
				}
				lines.push(`    showDate: true`);
				lines.push(`    showDraftStatus: ${defaultViewProps.draftProperty ? 'true' : 'false'}`);
				if (defaultViewProps.draftProperty) {
					lines.push(`    draftStatusProperty: note.${defaultViewProps.draftProperty}`);
				}
				lines.push(`    customizeNewButton: true`);
				lines.push(`    newNoteLocation: "${defaultContentType.folder}"`);
				lines.push(`    fallbackToEmbeds: if-empty`);
				lines.push(`    propertyDisplay1: file.name`);
				lines.push(`    showTextPreview: true`);
				lines.push(`    propertyLabels: above`);
				// Sort by date property (newest to oldest)
				lines.push(`    sort:`);
				if (defaultViewProps.dateProperty) {
					lines.push(`      - property: note.${defaultViewProps.dateProperty}`);
				} else {
					lines.push(`      - property: file.ctime`);
				}
				lines.push(`        direction: DESC`);
			}
		}
		
		// SECOND: Update or create "All Content" view
		const allContentView = existingBase?.views?.find((v: any) => v.name === 'All Content');
		
		if (defaultProps) {
			// Always update/create "All Content" view (but it's not first anymore)
			lines.push('  - type: bases-cms');
			lines.push(`    name: All Content`);
			lines.push('    filters:');
			lines.push('      and:');
			lines.push(`        - file.ext == "md"`);
			
			// Always include groupBy for folder grouping
			lines.push(`    groupBy:`);
			if (allContentView?.groupBy && typeof allContentView.groupBy === 'object' && allContentView.groupBy.property) {
				// Preserve existing groupBy if it exists
				lines.push(`      property: ${allContentView.groupBy.property}`);
				lines.push(`      direction: ${allContentView.groupBy.direction || 'ASC'}`);
			} else {
				// Default: group by folder
				lines.push(`      property: file.folder`);
				lines.push(`      direction: ASC`);
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
		
		// THIRD: Add views for each enabled content type (excluding default, which is already first)
		for (const contentType of contentTypes) {
			if (!contentType.enabled) {
				continue;
			}

			// Skip "All Content" view - it's already handled above
			if (contentType.name === 'All Content') {
				continue;
			}

			// Skip default content type - it's already created first
			if (defaultContentType && contentType.id === defaultContentType.id) {
				continue;
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

