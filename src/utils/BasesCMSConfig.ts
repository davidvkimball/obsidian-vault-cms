import { App, TFile } from 'obsidian';
import { ContentTypeConfig, FrontmatterProperties, ProjectDetectionResult } from '../types';
import * as yaml from 'yaml';
import { PathResolver } from './PathResolver';

export class BasesCMSConfigurator {
	private app: App;
	private pathResolver: PathResolver;

	constructor(app: App) {
		this.app = app;
		this.pathResolver = new PathResolver(app);
	}

	async createOrUpdateBaseFile(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties },
		defaultContentTypeId?: string,
		projectDetection?: ProjectDetectionResult
	): Promise<void> {
		const baseFilePath = 'bases/Home.base';
		
		// Ensure bases directory exists
		const basesFolder = this.app.vault.getAbstractFileByPath('bases');
		if (!basesFolder) {
			try {
				await this.app.vault.createFolder('bases');
			} catch (error: unknown) {
				// Folder might already exist, ignore error
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (!errorMessage || !errorMessage.includes('already exists')) {
					console.warn('BasesCMSConfig: Could not create bases folder:', error);
				}
			}
		}

		// Check if file exists (re-check after folder creation)
		const baseFileAbstract = this.app.vault.getAbstractFileByPath(baseFilePath);
		let baseFile: TFile | null = baseFileAbstract instanceof TFile ? baseFileAbstract : null;

		// Read existing base file if it exists
		let existingBase: Record<string, unknown> | null = null;
		if (baseFile) {
			try {
				const content = await this.app.vault.read(baseFile);
				existingBase = yaml.parse(content) as Record<string, unknown>;
			} catch (error: unknown) {
				console.error('BasesCMSConfig: Failed to parse existing base file:', error);
			}
		}

		const enabledTypes = contentTypes.filter(ct => ct.enabled);
		console.debug('BasesCMSConfig: Generating base content for', contentTypes.length, 'content types');
		console.debug('BasesCMSConfig: Enabled content types:', enabledTypes.map(ct => ct.name));
		
		const baseContent = this.generateBaseContent(contentTypes, frontmatterProperties, defaultContentTypeId, existingBase, projectDetection);
		
		// Count views in generated content to verify they're being created
		const viewMatches = baseContent.match(/^\s*-\s+type:\s+bases-cms/gm);
		const viewCount = viewMatches ? viewMatches.length : 0;
		console.debug('BasesCMSConfig: Generated', viewCount, 'views in base content');
		
		// Always try to modify first - if file doesn't exist, modify will throw, then we create
		// This avoids race conditions with getAbstractFileByPath
		const baseFileAbstract2 = this.app.vault.getAbstractFileByPath(baseFilePath);
		baseFile = baseFileAbstract2 instanceof TFile ? baseFileAbstract2 : null;
		
		if (baseFile) {
			console.debug('BasesCMSConfig: Modifying existing Home.base file');
			try {
				await this.app.vault.modify(baseFile, baseContent);
				console.debug('BasesCMSConfig: Successfully modified Home.base file');
				return; // Success, exit early
			} catch (error: unknown) {
				console.error('BasesCMSConfig: Failed to modify file:', error);
				throw error;
			}
		}
		
		// File doesn't exist (or can't be found), try to create it
		console.debug('BasesCMSConfig: Creating new Home.base file');
		try {
			await this.app.vault.create(baseFilePath, baseContent);
			console.debug('BasesCMSConfig: Successfully created Home.base file');
		} catch (error) {
			// If create fails because file exists, the file was created between check and create
			// Try to modify it directly using the path string
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage && (errorMessage.includes('already exists') || errorMessage.includes('File already exists'))) {
				console.debug('BasesCMSConfig: File existed, attempting direct modify via path');
				// Use adapter to write directly - this bypasses the indexing issue
				try {
					const adapter = this.app.vault.adapter;
					if (adapter && typeof adapter.write === 'function') {
						await adapter.write(baseFilePath, baseContent);
						console.debug('BasesCMSConfig: Successfully wrote Home.base file via adapter');
					} else {
						// Fallback: retry getAbstractFileByPath with longer delays
						console.debug('BasesCMSConfig: Adapter write not available, retrying getAbstractFileByPath');
						for (let i = 0; i < 10; i++) {
							await new Promise(resolve => setTimeout(resolve, 200));
							const retryFileAbstract = this.app.vault.getAbstractFileByPath(baseFilePath);
							const retryFile = retryFileAbstract instanceof TFile ? retryFileAbstract : null;
							if (retryFile) {
								await this.app.vault.modify(retryFile, baseContent);
								console.debug(`BasesCMSConfig: Successfully modified Home.base file on retry ${i + 1}`);
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
		existingBase: Record<string, unknown> | null,
		projectDetection?: ProjectDetectionResult
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
			const existingProps = (existingBase?.properties as Record<string, { displayName?: string } | undefined>) || {};
			for (const prop of Array.from(allProperties).sort()) {
				lines.push(`  ${prop}:`);
				// Preserve existing displayName if it exists, especially for file.name
				const existingProp = existingProps[prop];
				if (existingProp?.displayName) {
					lines.push(`    displayName: ${existingProp.displayName}`);
				} else {
					const propName = prop.replace('note.', '').replace('file.', '');
					lines.push(`    displayName: ${this.capitalizeFirst(propName)}`);
				}
			}
			lines.push('');
		}

		// Views section - preserve existing views (except "All Content") and add new content type views
		lines.push('views:');
		
		// Find default content type
		const defaultContentType = defaultContentTypeId ? 
			contentTypes.find(ct => ct.id === defaultContentTypeId && ct.enabled) : null;
		
		// Separate existing views: content type views, "All Content", "Guide", and others
		const existingViews = (existingBase?.views as Array<{ name?: string }>) || [];
		const existingContentTypeNames = new Set(contentTypes.filter(ct => ct.enabled).map(ct => ct.name));
		const guideView = existingViews.find((v) => v.name === 'Guide');
		const otherViews = existingViews.filter((v) => 
			v.name !== 'All Content' && 
			v.name !== 'Guide' && 
			!existingContentTypeNames.has(v.name || '')
		);
		
		// FIRST: Add the default content type's view (if it exists and is enabled)
		if (defaultContentType) {
			const defaultViewProps = frontmatterProperties[defaultContentType.id];
			if (defaultViewProps) {
				const folderPath = this.pathResolver.getBasesCMSFolderPath(defaultContentType.folder, projectDetection);
				lines.push('  - type: bases-cms');
				lines.push(`    name: ${defaultContentType.name}`);
				lines.push('    filters:');
				lines.push('      and:');
				lines.push(`        - file.folder.startsWith("${folderPath}")`);
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
				lines.push(`    newNoteLocation: "${folderPath}"`);
				lines.push(`    fallbackToEmbeds: if-empty`);
				lines.push(`    propertyDisplay1: file.name`);
				lines.push(`    showTextPreview: true`);
				lines.push(`    propertyLabels: above`);
				// Sort by date property (newest to oldest)
				lines.push(`    sort:`);
				lines.push(`      - property: ${defaultViewProps.dateProperty ? `note.${defaultViewProps.dateProperty}` : 'file.ctime'}`);
				lines.push(`        direction: DESC`);
			}
		}
		
		// SECOND: Add views for each enabled content type (excluding default, which is already first)
		for (const contentType of contentTypes) {
			if (!contentType.enabled) {
				continue;
			}

			// Skip "All Content" view - don't process it
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

			const folderPath = this.pathResolver.getBasesCMSFolderPath(contentType.folder, projectDetection);
			lines.push('  - type: bases-cms');
			lines.push(`    name: ${contentType.name}`);
			lines.push('    filters:');
			lines.push('      and:');
			lines.push(`        - file.folder.startsWith("${folderPath}")`);
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
			lines.push(`    newNoteLocation: "${folderPath}"`);
			lines.push(`    fallbackToEmbeds: if-empty`);
			lines.push(`    propertyDisplay1: file.name`);
			lines.push(`    showTextPreview: true`);
			lines.push(`    propertyLabels: above`);
			// Sort by date property (newest to oldest)
			lines.push(`    sort:`);
			lines.push(`      - property: ${props.dateProperty ? `note.${props.dateProperty}` : 'file.ctime'}`);
			lines.push(`        direction: DESC`);
		}

		// THIRD: Preserve other existing views (excluding "All Content", "Guide", and content type views)
		for (const view of otherViews) {
			lines.push(...this.serializeView(view));
		}

		// FOURTH: Add "Guide" view last (if it exists)
		if (guideView) {
			lines.push(...this.serializeView(guideView));
		}
		
		return lines.join('\n');
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	/**
	 * Serialize a view object to YAML lines (with proper indentation)
	 */
	private serializeView(view: { name?: string; filters?: { and?: Array<string | Record<string, unknown>> }; groupBy?: { property?: string; direction?: string } | string; order?: string[]; sort?: Array<{ property?: string; direction?: string }>; [key: string]: unknown }): string[] {
		const viewLines: string[] = [];
		viewLines.push('  - type: bases-cms');
		viewLines.push(`    name: ${view.name}`);
		
		if (view.filters) {
			viewLines.push('    filters:');
			if (view.filters.and) {
				viewLines.push('      and:');
				for (const filter of view.filters.and) {
					if (typeof filter === 'string') {
						viewLines.push(`        - ${filter}`);
					} else if (typeof filter === 'object') {
						// Handle object filters like { "file.folder.startsWith": "posts" }
						for (const [key, value] of Object.entries(filter)) {
							const valueStr = typeof value === 'string' ? `"${value}"` : String(value);
						viewLines.push(`        - ${key}: ${valueStr}`);
						}
					}
				}
			}
		}
		
		if (view.groupBy) {
			viewLines.push('    groupBy:');
			if (typeof view.groupBy === 'object') {
				if (view.groupBy.property) viewLines.push(`      property: ${view.groupBy.property}`);
				if (view.groupBy.direction) viewLines.push(`      direction: ${view.groupBy.direction}`);
			}
		}
		
		if (view.order) {
			viewLines.push('    order:');
			for (const orderItem of view.order) {
				viewLines.push(`      - ${orderItem}`);
			}
		}
		
		if (view.sort) {
			viewLines.push('    sort:');
			for (const sortItem of view.sort) {
				if (typeof sortItem === 'object' && sortItem.property) {
					viewLines.push(`      - property: ${sortItem.property}`);
					viewLines.push(`        direction: ${sortItem.direction || 'ASC'}`);
				}
			}
		}
		
		// Add all other properties - preserve ALL properties from the original view
		// This ensures we don't lose any settings like hideQuickEditIcon
		// Skip properties that are already handled above (type, name, filters, groupBy, order, sort)
		const skipProps = ['type', 'name', 'filters', 'groupBy', 'order', 'sort'];
		
		// Serialize all remaining properties from the view
		for (const prop of Object.keys(view)) {
			if (skipProps.includes(prop) || view[prop] === undefined) {
				continue;
			}
			
			const value = view[prop];
			if (typeof value === 'boolean') {
				viewLines.push(`    ${prop}: ${value}`);
			} else if (typeof value === 'number') {
				viewLines.push(`    ${prop}: ${value}`);
			} else if (typeof value === 'string') {
				// For properties that are note/file references, don't quote them
				if (prop.includes('Property') && (value.startsWith('note.') || value.startsWith('file.'))) {
					viewLines.push(`    ${prop}: ${value}`);
				} else if (prop === 'newNoteLocation') {
					viewLines.push(`    ${prop}: ${value}`);
				} else {
					viewLines.push(`    ${prop}: "${value}"`);
				}
			}
		}
		
		return viewLines;
	}
}

