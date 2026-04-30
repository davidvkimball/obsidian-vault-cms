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

	async resolveBaseFilePath(): Promise<string> {
		const candidateFolders = ['_bases', 'bases', '_home', 'home', '_base', 'base'];
		const candidateFiles = ['Home.base', 'home.base', 'index.base'];

		// 1. Check for existing files first (preferred combinations)
		for (const folder of candidateFolders) {
			for (const file of candidateFiles) {
				const fullPath = `${folder}/${file}`;
				if (await this.app.vault.adapter.exists(fullPath)) {
					return fullPath;
				}
			}
		}

		// 2. Check for folders even if file doesn't exist (to decide where to create)
		for (const folder of candidateFolders) {
			if (await this.app.vault.adapter.exists(folder)) {
				return `${folder}/Home.base`; // Default to Home.base in first existing folder found
			}
		}

		// 3. Default when nothing exists: _bases is most flexible (Astro themes often ignore underscore-prefixed paths)
		return '_bases/Home.base';
	}

	async createOrUpdateBaseFile(
		contentTypes: ContentTypeConfig[],
		frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties },
		defaultContentTypeId?: string,
		projectDetection?: ProjectDetectionResult,
		enableMdxSupport?: boolean
	): Promise<void> {
		const baseFilePath = await this.resolveBaseFilePath();
		const folderPath = baseFilePath.split('/')[0];

		// Ensure bases directory exists
		const basesFolder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!basesFolder) {
			try {
				await this.app.vault.createFolder(folderPath);
			} catch (error: unknown) {
				// Folder might already exist, ignore error
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (!errorMessage || !errorMessage.includes('already exists')) {
					console.warn(`BasesCMSConfig: Could not create ${folderPath} folder:`, error);
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

		const baseContent = this.generateBaseContent(contentTypes, frontmatterProperties, defaultContentTypeId, existingBase, projectDetection, enableMdxSupport);

		// Count views in generated content to verify they're being created
		const viewMatches = baseContent.match(/^\s*-\s+type:\s+(?:cms|bases-cms)/gm);
		const viewCount = viewMatches ? viewMatches.length : 0;
		console.debug('BasesCMSConfig: Generated', viewCount, 'views in base content');

		// Always try to modify first - if file doesn't exist, modify will throw, then we create
		// This avoids race conditions with getAbstractFileByPath
		const baseFileAbstract2 = this.app.vault.getAbstractFileByPath(baseFilePath);
		baseFile = baseFileAbstract2 instanceof TFile ? baseFileAbstract2 : null;

		if (baseFile) {
			console.debug(`BasesCMSConfig: Modifying existing ${baseFilePath} file`);
			try {
				await this.app.vault.modify(baseFile, baseContent);
				console.debug(`BasesCMSConfig: Successfully modified ${baseFilePath} file`);
				return; // Success, exit early
			} catch (error: unknown) {
				console.error('BasesCMSConfig: Failed to modify file:', error);
				throw error;
			}
		}

		// File doesn't exist (or can't be found), try to create it
		console.debug(`BasesCMSConfig: Creating new ${baseFilePath} file`);
		try {
			await this.app.vault.create(baseFilePath, baseContent);
			console.debug(`BasesCMSConfig: Successfully created ${baseFilePath} file`);
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
						throw new Error(`File exists but cannot be accessed. Please try again or manually edit ${baseFilePath}`);
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
		projectDetection?: ProjectDetectionResult,
		enableMdxSupport?: boolean
	): string {
		// Bases uses a specific syntax - we need to generate it manually to match the format
		const lines: string[] = [];

		// Find default content type
		const defaultContentType = defaultContentTypeId ?
			contentTypes.find(ct => ct.id === defaultContentTypeId && ct.enabled) : null;

		// Add defaultView property at the top level if a default content type is selected
		if (defaultContentType) {
			lines.push(`defaultView: "${defaultContentType.name}"`);
		}

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
		if (enableMdxSupport) {
			lines.push('  or:');
			lines.push('    - file.ext == "md"');
			lines.push('    - file.ext == "mdx"');
		} else {
			lines.push('  and:');
			lines.push('    - file.ext == "md"');
		}
		lines.push('');

		// Properties section - collect all properties from content types
		const allProperties = new Set<string>();
		for (const contentType of contentTypes) {
			const props = frontmatterProperties[contentType.id];
			if (props) {
				if (props.titleProperty) allProperties.add(`note.${props.titleProperty}`);
				if (props.dateProperty) allProperties.add(`note.${props.dateProperty}`);
				if (props.descriptionProperty) allProperties.add(`note.${props.descriptionProperty}`);
				if (props.tagsProperty) allProperties.add(`note.${props.tagsProperty}`);
				if (props.draftProperty) allProperties.add(`note.${props.draftProperty}`);
				if (props.imageProperty) allProperties.add(`note.${props.imageProperty}`);
			}
		}

		// Add common properties
		allProperties.add('note.title');
		allProperties.add('note.date');
		allProperties.add('note.pubDate');
		allProperties.add('note.draft');
		allProperties.add('file.fullname'); // Always include full file name
		allProperties.add('file.name'); // Also include file name for compatibility

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
			// Preserve existing property displayNames, especially for file.name/fullname
			const existingProps = (existingBase?.properties as Record<string, { displayName?: string } | undefined>) || {};
			for (const prop of Array.from(allProperties).sort()) {
				lines.push(`  "${prop}":`);
				// Preserve existing displayName if it exists, especially for file.name/fullname
				const existingProp = existingProps[prop];
				if (existingProp?.displayName) {
					lines.push(`    displayName: ${existingProp.displayName}`);
				} else if (prop === 'file.fullname') {
					lines.push(`    displayName: Full File Name`);
				} else {
					const propName = prop.replace('note.', '').replace('file.', '');
					lines.push(`    displayName: ${this.capitalizeFirst(propName)}`);
				}
			}
			lines.push('');
		}

		// Views section - preserve existing views and add/update content type views
		lines.push('views:');

		const existingViews = (existingBase?.views as Array<any>) || [];
		const viewsByName = new Map<string, any>();
		for (const view of existingViews) {
			if (view.name) viewsByName.set(view.name, view);
		}

		const finalViews: any[] = [];
		const processedViewNames = new Set<string>();

		// 1. Process Content Types (Default First)
		const enabledTypes = contentTypes.filter(ct => ct.enabled);
		const defaultType = defaultContentTypeId ? enabledTypes.find(ct => ct.id === defaultContentTypeId) : null;
		const otherTypes = enabledTypes.filter(ct => ct !== defaultType);

		const processType = (ct: ContentTypeConfig) => {
			const props = frontmatterProperties[ct.id];
			if (!props) return;

			const existingView = viewsByName.get(ct.name);

			if (existingView) {
				// View already exists - preserve it entirely, don't overwrite user customizations
				finalViews.push(existingView);
				processedViewNames.add(ct.name);
			} else {
				// New view - generate from scratch
				const generatedView = this.generateViewForContentType(ct, props, projectDetection);
				finalViews.push(generatedView);
				processedViewNames.add(ct.name);
			}
		};

		if (defaultType) processType(defaultType);
		for (const ct of otherTypes) processType(ct);

		// 2. Add other unique views (preserving original order as much as possible)
		for (const view of existingViews) {
			if (view.name === 'Vault CMS Guide' || view.name === 'Guide' || processedViewNames.has(view.name)) continue;
			finalViews.push(view);
		}

		// 3. Add Vault CMS Guide last
		let guideView = viewsByName.get('Vault CMS Guide') || viewsByName.get('Guide');
		if (guideView) {
			guideView = { ...guideView, name: 'Vault CMS Guide' };
			finalViews.push(guideView);
		}

		// Serialize all final views
		for (const view of finalViews) {
			lines.push(...this.serializeView(view));
		}

		return lines.join('\n');
	}

	private generateViewForContentType(
		contentType: ContentTypeConfig,
		props: FrontmatterProperties,
		projectDetection?: ProjectDetectionResult
	): any {
		const folderPath = this.pathResolver.getBasesCMSFolderPath(contentType.folder, projectDetection);

		const view: any = {
			type: 'cms',
			name: contentType.name,
			filters: {
				and: [
					folderPath === '' || folderPath === '.' ? 'file.folder == "/"' : `file.folder.startsWith("${folderPath}")`
				]
			},
			imageFormat: 'cover',
			showDate: true,
			customizeNewButton: true,
			newNoteLocation: folderPath,
			fallbackToEmbeds: 'if-empty',
			propertyDisplay1: 'file.fullname',
			showTextPreview: true,
			propertyLabels: 'above',
			sort: [
				{
					property: props.dateProperty ? `note.${props.dateProperty}` : 'file.ctime',
					direction: 'DESC'
				}
			]
		};

		// Handle blank title/date properties
		if (props.titleProperty) {
			if (props.titleProperty.includes('.')) {
				const parts = props.titleProperty.split('.');
				view.titleProperty = `note.${parts[0]}`;
				view.titlePropertyHasNested = true;
				view.titlePropertyNested = parts.slice(1).join('.');
			} else {
				view.titleProperty = `note.${props.titleProperty}`;
			}
		} else {
			view.titleProperty = `file.fullname`;
			view.titlePropertyNested = `file.fullname`;
		}

		if (props.dateProperty) {
			if (props.dateProperty.includes('.')) {
				const parts = props.dateProperty.split('.');
				view.dateProperty = `note.${parts[0]}`;
				view.datePropertyHasNested = true;
				view.datePropertyNested = parts.slice(1).join('.');
			} else {
				view.dateProperty = `note.${props.dateProperty}`;
			}
		} else {
			view.dateProperty = `file.ctime`;
		}

		if (props.descriptionProperty) {
			if (props.descriptionProperty.includes('.')) {
				const parts = props.descriptionProperty.split('.');
				view.descriptionProperty = `note.${parts[0]}`;
				view.descriptionPropertyHasNested = true;
				view.descriptionPropertyNested = parts.slice(1).join('.');
			} else {
				view.descriptionProperty = `note.${props.descriptionProperty}`;
			}
		}

		if (props.imageProperty) {
			if (props.imageProperty.includes('.')) {
				const parts = props.imageProperty.split('.');
				view.imageProperty = `note.${parts[0]}`;
				view.imagePropertyHasNested = true;
				view.imagePropertyNested = parts.slice(1).join('.');
			} else {
				view.imageProperty = `note.${props.imageProperty}`;
			}
		}

		view.showTags = !!props.tagsProperty;
		if (props.tagsProperty) {
			if (props.tagsProperty.includes('.')) {
				const parts = props.tagsProperty.split('.');
				view.tagsProperty = `note.${parts[0]}`;
				view.tagsPropertyHasNested = true;
				view.tagsPropertyNested = parts.slice(1).join('.');
			} else {
				view.tagsProperty = `note.${props.tagsProperty}`;
			}
		}

		view.showDraftStatus = !!props.hasDraftStatus;
		if (props.hasDraftStatus) {
			if (props.draftProperty) {
				if (props.draftProperty.includes('.')) {
					const parts = props.draftProperty.split('.');
					view.draftStatusProperty = `note.${parts[0]}`;
					view.draftStatusPropertyHasNested = true;
					view.draftStatusPropertyNested = parts.slice(1).join('.');
				} else {
					view.draftStatusProperty = `note.${props.draftProperty}`;
				}
				view.draftStatusReverse = props.draftLogic === 'false-draft';
			} else {
				view.draftStatusUseFilenamePrefix = true;
			}
		}


		return view;
	}


	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	/**
	 * Serialize a view object to YAML lines (with proper indentation)
	 */
	private serializeView(view: { name?: string; filters?: { and?: Array<string | Record<string, unknown>> }; groupBy?: { property?: string; direction?: string } | string; order?: string[]; sort?: Array<{ property?: string; direction?: string }>;[key: string]: unknown }): string[] {
		const viewLines: string[] = [];
		viewLines.push('  - type: cms');
		viewLines.push(`    name: "${view.name}"`);

		if (view.filters) {
			viewLines.push('    filters:');
			if (view.filters.and) {
				if (view.filters.and.length === 0) {
					viewLines.push('      and: []');
				} else {
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
		}

		if (view.groupBy) {
			viewLines.push('    groupBy:');
			if (typeof view.groupBy === 'object') {
				if (view.groupBy.property) viewLines.push(`      property: ${view.groupBy.property}`);
				if (view.groupBy.direction) viewLines.push(`      direction: ${view.groupBy.direction}`);
			} else if (typeof view.groupBy === 'string') {
				viewLines.push(`      ${view.groupBy}`);
			}
		}

		if (view.order) {
			if (view.order.length === 0) {
				viewLines.push('    order: []');
			} else {
				viewLines.push('    order:');
				for (const orderItem of view.order) {
					viewLines.push(`      - ${orderItem}`);
				}
			}
		}

		if (view.sort) {
			if (view.sort.length === 0) {
				viewLines.push('    sort: []');
			} else {
				viewLines.push('    sort:');
				for (const sortItem of view.sort) {
					if (typeof sortItem === 'object' && sortItem.property) {
						viewLines.push(`      - property: ${sortItem.property}`);
						viewLines.push(`        direction: ${sortItem.direction || 'ASC'}`);
					}
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
			if (value === null) {
				viewLines.push(`    ${prop}: null`);
			} else if (typeof value === 'boolean') {
				viewLines.push(`    ${prop}: ${value}`);
			} else if (typeof value === 'number') {
				viewLines.push(`    ${prop}: ${value}`);
			} else if (typeof value === 'string') {
				if (value === '') {
					viewLines.push(`    ${prop}: ""`);
					continue;
				}
				// For properties that are note/file references, don't quote them
				// Check for propertyDisplayN as well as anything ending in Property
				const isPropertyRef = (prop.includes('Property') || prop.startsWith('propertyDisplay')) &&
					(value.startsWith('note.') || value.startsWith('file.'));

				if (isPropertyRef) {
					viewLines.push(`    ${prop}: ${value}`);
				} else if (prop === 'newNoteLocation') {
					viewLines.push(`    ${prop}: "${value}"`);
				} else {
					// Quote other strings
					viewLines.push(`    ${prop}: "${value}"`);
				}
			}
		}

		return viewLines;
	}
}

