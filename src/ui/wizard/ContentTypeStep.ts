import { App, Setting, Notice, TFolder, TFile, AbstractInputSuggest } from 'obsidian';

// Helper function for setCssProps (may not be in types yet)
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState, ContentTypeConfig } from '../../types';
import { ContentTypeDetector } from '../../utils/ContentTypeDetector';
import { AstroComposerConfigurator } from '../../utils/AstroComposerConfig';

// Folder name suggester for attachment folder
class FolderNameSuggest extends AbstractInputSuggest<string> {
	private inputEl: HTMLInputElement;
	private mode: 'specified-folder' | 'subfolder';

	constructor(app: App, inputEl: HTMLInputElement, mode: 'specified-folder' | 'subfolder') {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.mode = mode;
	}

	getSuggestions(inputStr: string): string[] {
		const suggestions: string[] = [];
		const lowerInput = inputStr.toLowerCase();
		
		if (this.mode === 'subfolder') {
			// For subfolder mode, suggest folder names only
			// Always suggest "attachments" if it matches
			if ('attachments'.toLowerCase().includes(lowerInput)) {
				suggestions.push('attachments');
			}
			
			// Get folder names from vault
			const allFiles = this.app.vault.getAllLoadedFiles();
			const folderNames = new Set<string>();
			
			for (const file of allFiles) {
				if (file instanceof TFolder) {
					const folderName = file.name;
					if (folderName.toLowerCase().includes(lowerInput) && folderName !== 'attachments') {
						folderNames.add(folderName);
					}
				}
			}
			
			suggestions.push(...Array.from(folderNames).slice(0, 10));
		} else {
			// For specified-folder mode, suggest full paths
			const allFiles = this.app.vault.getAllLoadedFiles();
			const paths = new Set<string>();
			
			for (const file of allFiles) {
				if (file instanceof TFolder) {
					const path = file.path;
					if (path.toLowerCase().includes(lowerInput)) {
						paths.add(path);
					}
				}
			}
			
			suggestions.push(...Array.from(paths).slice(0, 10));
		}
		
		return suggestions;
	}

	renderSuggestion(suggestion: string, el: HTMLElement): void {
		el.setText(suggestion);
	}

	selectSuggestion(suggestion: string): void {
		this.inputEl.value = suggestion;
		this.inputEl.trigger('input');
		this.close();
	}
}

export class ContentTypeStep extends BaseWizardStep {
	private contentTypeDetector: ContentTypeDetector;
	private astroComposerConfigurator: AstroComposerConfigurator;
	private detected: boolean = false;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.contentTypeDetector = new ContentTypeDetector(app);
		this.astroComposerConfigurator = new AstroComposerConfigurator(app);
	}

	/**
	 * Import content types from Astro Composer data.json if it exists
	 * First tries plugin API, then falls back to file reading
	 */
	private async importFromAstroComposer(): Promise<ContentTypeConfig[]> {
		try {
			// First try to use plugin API (like how we save)
			const plugins = (this.app as { plugins?: { plugins?: Record<string, { settings?: { contentTypes?: unknown[] } }> } }).plugins;
			console.debug('ContentTypeStep: Checking plugins API:', !!plugins);
			
			if (plugins) {
				const astroComposerPlugin = plugins.plugins?.['astro-composer'];
				console.debug('ContentTypeStep: Astro Composer plugin found:', !!astroComposerPlugin);
				
				if (astroComposerPlugin) {
					console.debug('ContentTypeStep: Plugin settings available:', !!astroComposerPlugin.settings);
					console.debug('ContentTypeStep: Plugin settings keys:', astroComposerPlugin.settings ? Object.keys(astroComposerPlugin.settings) : 'none');
					
					if (astroComposerPlugin.settings) {
						const contentTypes = astroComposerPlugin.settings.contentTypes;
						console.debug('ContentTypeStep: contentTypes from plugin:', contentTypes ? `Array with ${contentTypes.length} items` : 'not found');
						
						if (Array.isArray(contentTypes) && contentTypes.length > 0) {
							console.debug('ContentTypeStep: Importing', contentTypes.length, 'content types from Astro Composer (via plugin API)');
							
							// Convert Astro Composer content types to our format
							const importedTypes: ContentTypeConfig[] = contentTypes.map((ct: { id?: string; name?: string; folder: string; creationMode?: string; indexFileName?: string; linkBasePath?: string; enabled?: boolean }) => ({
								id: ct.id || `content-type-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
								name: ct.name || this.capitalizeFirst(ct.folder),
								folder: ct.folder,
								fileOrganization: ct.creationMode === 'folder' ? 'folder' : 'file',
								indexFileName: ct.indexFileName || 'index',
								linkBasePath: ct.linkBasePath,
								enabled: ct.enabled !== false // Default to enabled if not specified
							}));

							return importedTypes;
						}
					}
				}
			}
			
			// Fallback to file reading
			const configDir = this.app.vault.configDir;
			const pluginDataPath = `${configDir}/plugins/astro-composer/data.json`;
			console.debug('ContentTypeStep: Trying to read file:', pluginDataPath);
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			console.debug('ContentTypeStep: File found:', !!dataFile, dataFile ? `Type: ${dataFile.constructor.name}` : 'not found');
			
			if (!dataFile || !(dataFile instanceof TFile)) {
				// Try alternative paths
				const altPaths = [
					`${configDir}/plugins/astro-composer/data.json`,
					`obsidian/plugins/astro-composer/data.json`
				];
				
				for (const altPath of altPaths) {
					const altFile = this.app.vault.getAbstractFileByPath(altPath);
					if (altFile && altFile instanceof TFile) {
						console.debug('ContentTypeStep: Found file at alternative path:', altPath);
						const content = await this.app.vault.read(altFile);
						const data = JSON.parse(content) as { contentTypes?: unknown[] };
						
						if (data.contentTypes && Array.isArray(data.contentTypes)) {
							console.debug('ContentTypeStep: Importing', data.contentTypes.length, 'content types from Astro Composer (via file at', altPath, ')');
							
							const importedTypes: ContentTypeConfig[] = data.contentTypes.map((ct: { id?: string; name?: string; folder: string; creationMode?: string; indexFileName?: string; linkBasePath?: string; enabled?: boolean }) => ({
								id: ct.id || `content-type-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
								name: ct.name || this.capitalizeFirst(ct.folder),
								folder: ct.folder,
								fileOrganization: ct.creationMode === 'folder' ? 'folder' : 'file',
								indexFileName: ct.indexFileName || 'index',
								linkBasePath: ct.linkBasePath,
								enabled: ct.enabled !== false
							}));
							
							return importedTypes;
						}
					}
				}
				
				console.debug('ContentTypeStep: No Astro Composer data.json found, will scan folders');
				return [];
			}

			const content = await this.app.vault.read(dataFile);
			const data = JSON.parse(content) as { contentTypes?: unknown[] };
			
			if (!data.contentTypes || !Array.isArray(data.contentTypes)) {
				console.debug('ContentTypeStep: Astro Composer data.json has no contentTypes array. Data keys:', Object.keys(data));
				return [];
			}

			console.debug('ContentTypeStep: Importing', data.contentTypes.length, 'content types from Astro Composer (via file)');
			
			// Convert Astro Composer content types to our format
			const importedTypes: ContentTypeConfig[] = data.contentTypes.map((ct: { id?: string; name?: string; folder: string; creationMode?: string; indexFileName?: string; linkBasePath?: string; enabled?: boolean }) => ({
				id: ct.id || `content-type-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
				name: ct.name || this.capitalizeFirst(ct.folder),
				folder: ct.folder,
				fileOrganization: ct.creationMode === 'folder' ? 'folder' : 'file',
				indexFileName: ct.indexFileName || 'index',
				linkBasePath: ct.linkBasePath,
				enabled: ct.enabled !== false // Default to enabled if not specified
			}));

			return importedTypes;
		} catch (error: unknown) {
			console.error('ContentTypeStep: Failed to import from Astro Composer:', error);
			return [];
		}
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		
		// Find or create content wrapper (preserve footer if it exists)
		let stepContentWrapper = containerEl.querySelector('.content-type-step-content') as HTMLElement;
		
		if (!stepContentWrapper) {
			// First time - clear everything and create wrapper
			containerEl.empty();
			stepContentWrapper = containerEl.createDiv({ cls: 'content-type-step-content' });
		} else {
			// Re-rendering - just clear the wrapper content, preserve footer
			stepContentWrapper.empty();
		}

		stepContentWrapper.createEl('h2', { text: 'Content types' });
		stepContentWrapper.createEl('p', { 
			text: 'Detecting content types in your vault...' 
		});

		if (!this.detected) {
			// Get saved content types from state (preserves enabled state from previous wizard runs)
			const savedContentTypes = this.state.contentTypes || [];
			const savedContentTypesMap = new Map(savedContentTypes.map(ct => [ct.folder, ct]));
			
			// First, try to import from Astro Composer if it exists
			const importedTypes = await this.importFromAstroComposer();
			
			// Then scan for new folders that aren't already mapped
			// Pass project detection info so it can find src/content directory correctly
			const scannedTypes = await this.contentTypeDetector.detectContentTypes(this.state.projectDetection);
			
			// Merge: use imported types, then add any scanned types that don't exist yet
			const existingFolders = new Set(importedTypes.map(ct => ct.folder));
			const newTypes = scannedTypes.filter(ct => !existingFolders.has(ct.folder));
			
			// Combine imported and scanned types
			const allDetectedTypes = [...importedTypes, ...newTypes];
			const detectedTypesMap = new Map(allDetectedTypes.map(ct => [ct.folder, ct]));
			
			// Merge with saved content types, preserving enabled state from saved settings
			const mergedTypes: ContentTypeConfig[] = [];
			const processedFolders = new Set<string>();
			
			// Process all folders (both saved and detected)
			const allFolders = new Set([
				...savedContentTypes.map(ct => ct.folder),
				...allDetectedTypes.map(ct => ct.folder)
			]);
			
			for (const folder of allFolders) {
				if (processedFolders.has(folder)) continue;
				
				const savedType = savedContentTypesMap.get(folder);
				const detectedType = detectedTypesMap.get(folder);
				
				if (savedType) {
					// Use saved type to preserve enabled state and all other settings
					// If there's also a detected type, merge in any new info while preserving saved settings
					if (detectedType) {
						mergedTypes.push({
							...savedType, // Preserve all saved settings (enabled, linkBasePath, etc.)
							// Only update folder/name if they're different (shouldn't happen, but be safe)
							folder: savedType.folder,
							name: savedType.name || detectedType.name
						});
					} else {
						// Saved type not detected - keep it as is (user might have deleted the folder)
						mergedTypes.push(savedType);
					}
				} else if (detectedType) {
					// New type not in saved settings - add it (default to enabled for new types)
					mergedTypes.push(detectedType);
				}
				
				processedFolders.add(folder);
			}
			
			// Sort alphabetically by name
			mergedTypes.sort((a, b) => a.name.localeCompare(b.name));
			
			this.state.contentTypes = mergedTypes;
			this.detected = true;
		}

		stepContentWrapper.empty();
		stepContentWrapper.createEl('h2', { text: 'Content types' });
		stepContentWrapper.createEl('p', { 
			text: 'Select and configure your content types:' 
		});

		// Global attachment handling at the top
		stepContentWrapper.createEl('h3', { text: 'Attachment handling', cls: 'vault-cms-section-header' });
		stepContentWrapper.createEl('p', { 
			text: 'How should attachments be stored globally?',
			cls: 'vault-cms-section-desc'
		});

		new Setting(stepContentWrapper)
			.setName('How are attachments handled?')
			.setDesc('Choose how attachments are stored for all content types')
			.addDropdown(dropdown => dropdown
				.addOption('same-folder', 'Same folder as current file')
				.addOption('specified-folder', 'In the specified folder')
				.addOption('subfolder', 'In subfolder under current folder')
				.setValue(this.state.attachmentHandlingMode || 'subfolder')
				.onChange(value => {
					this.state.attachmentHandlingMode = value as 'specified-folder' | 'same-folder' | 'subfolder';
					// Clear folder name if switching to same-folder
					if (value === 'same-folder') {
						this.state.attachmentFolderName = undefined;
					}
					// Re-render to show/hide folder name input
					void this.display();
				}));

		// Show folder name input for specified-folder or subfolder modes
		if (this.state.attachmentHandlingMode === 'specified-folder' || this.state.attachmentHandlingMode === 'subfolder') {
			const descText = this.state.attachmentHandlingMode === 'specified-folder' 
				? 'Enter the exact path to the folder for attachments (e.g., "attachments" or "images/attachments"). Leave blank to use "attachments" as default.'
				: 'Enter the name of the subfolder for attachments (e.g., "attachments"). Leave blank to use "attachments" as default.';
			
			const folderNameSetting = new Setting(stepContentWrapper)
				.setName('Attachment folder')
				.setDesc(descText);

			folderNameSetting.addText(text => {
				// False positive: "attachments" is a placeholder value, not UI text
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text.setPlaceholder('attachments')
					.setValue(this.state.attachmentFolderName || '')
					.onChange(value => {
						this.state.attachmentFolderName = value || undefined;
					});
				
				// Add autocomplete suggester with mode (only if not same-folder)
				if (this.state.attachmentHandlingMode !== 'same-folder') {
					new FolderNameSuggest(this.app, text.inputEl, this.state.attachmentHandlingMode);
				}
			});
		}

		stepContentWrapper.createEl('hr', { cls: 'vault-cms-divider' });

		// Content types section
		stepContentWrapper.createEl('h3', { text: 'Content types', cls: 'vault-cms-section-header' });

		for (const contentType of this.state.contentTypes) {
			new Setting(stepContentWrapper)
				.setName(contentType.name)
				.setDesc(`Folder: ${contentType.folder}`)
				.addToggle(toggle => toggle
					.setValue(contentType.enabled)
					.onChange(value => {
						contentType.enabled = value;
					}));

			// File organization dropdown
			new Setting(stepContentWrapper)
				.setName(`${contentType.name} - File organization`)
				.setDesc('Choose how content is organized for this content type')
				.addDropdown(dropdown => dropdown
					.addOption('file', 'File-based')
					.addOption('folder', 'Folder-based')
					.setValue(contentType.fileOrganization || 'file')
					.onChange(value => {
						contentType.fileOrganization = value as 'file' | 'folder';
						// Re-render to show/hide index file name setting
						void this.display();
					}));

			// Show index file name for folder-based organization
			if (contentType.fileOrganization === 'folder') {
				new Setting(stepContentWrapper)
					.setName(`${contentType.name} - Index file name`)
					.setDesc('Name of the index file in folder-based organization')
					.addText(text => text
						.setValue(contentType.indexFileName || 'index')
						.onChange(value => {
							contentType.indexFileName = value || 'index';
						}));
			}

			// Link base path for Astro Composer
			const defaultLinkBasePath = `/${contentType.folder}/`;
			new Setting(stepContentWrapper)
				.setName(`${contentType.name} - Link base path`)
				.setDesc(`URL path for this content type (e.g., "/posts/" or "/" for root). Leave blank to use default: ${defaultLinkBasePath}`)
				.addText(text => text
					.setPlaceholder(defaultLinkBasePath)
					.setValue(contentType.linkBasePath || '')
					.onChange(value => {
						contentType.linkBasePath = value || undefined;
					}));
		}

		// Add Additional Content Type button
		const addButton = stepContentWrapper.createEl('button', { 
			text: 'Add additional content type',
			cls: 'mod-cta'
		});
		setCssProps(addButton, { marginTop: '20px', marginBottom: '30px' });
		addButton.addEventListener('click', () => {
			void (async () => {
				const selectedFolder = await this.selectContentTypeFolder();
				if (selectedFolder) {
					// Extract folder name from path (last segment)
					const pathParts = selectedFolder.split(/[/\\]/);
					const folderName = pathParts[pathParts.length - 1] || selectedFolder;
					const newType: ContentTypeConfig = {
						id: `content-type-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
						name: this.capitalizeFirst(folderName),
						folder: folderName,
						fileOrganization: 'file',
						enabled: false,
						indexFileName: 'index'
					};
					this.state.contentTypes.push(newType);
					await this.display();
				}
			})();
		});
	}

	/**
	 * Select folder for additional content type
	 */
	private async selectContentTypeFolder(): Promise<string | null> {
		try {
			// Try multiple ways to access Electron dialog API
			let dialog: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } | null = null;

			// Method 1: Try @electron/remote (newer Electron versions)
			try {
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const electronRemote = require('@electron/remote') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } };
				dialog = electronRemote?.dialog || null;
			} catch {
				// Not available, try next method
			}

			// Method 2: Try electron.remote.dialog (older Electron versions)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports
					const electron = ((window as { require?: (module: string) => unknown }).require?.('electron') || require('electron')) as { remote?: { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } } };
					dialog = electron?.remote?.dialog || null;
				} catch {
					// Not available, try next method
				}
			}

			// Method 3: Try electron.dialog directly (main process, may not work)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports
					const electron = require('electron') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } };
					dialog = electron?.dialog || null;
				} catch {
					// Not available
				}
			}

			if (!dialog || typeof dialog.showOpenDialogSync !== 'function') {
				throw new Error('Electron dialog API not available');
			}

			const vaultPath = this.getVaultPath();

			const result = dialog.showOpenDialogSync({
				title: 'Select Content Type Folder',
				defaultPath: vaultPath,
				properties: ['openDirectory']
			});

			if (result && result.length > 0) {
				// Normalize path (replace backslashes with forward slashes, remove trailing slashes)
				return result[0].replace(/\\/g, '/').replace(/\/$/, '');
			}
		} catch (error: unknown) {
			console.error('Error opening folder picker:', error);
			new Notice('Unable to open folder picker. Please ensure you are using Obsidian on desktop.');
		}

		return null;
	}

	/**
	 * Get the vault path
	 */
	private getVaultPath(): string {
		const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;
		// Resolve path (convert relative to absolute, normalize separators)
		if (vaultPath) {
			// If already absolute, return as-is (normalized)
			if (vaultPath.startsWith('/') || /^[A-Z]:/.test(vaultPath)) {
				return vaultPath.replace(/\\/g, '/');
			}
			// For relative paths, we'd need to resolve, but in Obsidian context, basePath should be absolute
			return vaultPath.replace(/\\/g, '/');
		}
		// Fallback - in Obsidian context this shouldn't happen
		return '/';
	}

	/**
	 * Capitalize first letter
	 */
	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	validate(): boolean {
		return this.state.contentTypes.some(ct => ct.enabled);
	}

	getTitle(): string {
		return 'Content types';
	}

	getDescription(): string {
		return 'Configure content types';
	}
}
