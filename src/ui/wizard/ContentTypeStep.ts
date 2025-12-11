import { App, Setting, Notice, TFolder, AbstractInputSuggest } from 'obsidian';
import * as path from 'path';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState, ContentTypeConfig } from '../../types';
import { ContentTypeDetector } from '../../utils/ContentTypeDetector';

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
	private detected: boolean = false;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.contentTypeDetector = new ContentTypeDetector(app);
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

		stepContentWrapper.createEl('h2', { text: 'Content Types' });
		stepContentWrapper.createEl('p', { 
			text: 'Detecting content types in your vault...' 
		});

		if (!this.detected) {
			const detectedTypes = await this.contentTypeDetector.detectContentTypes();
			this.state.contentTypes = detectedTypes;
			this.detected = true;
		}

		stepContentWrapper.empty();
		stepContentWrapper.createEl('h2', { text: 'Content Types' });
		stepContentWrapper.createEl('p', { 
			text: 'Select and configure your content types:' 
		});

		// Global attachment handling at the top
		stepContentWrapper.createEl('h3', { text: 'Attachment Handling', cls: 'vault-cms-section-header' });
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
					this.display();
				}));

		// Show folder name input for specified-folder or subfolder modes
		if (this.state.attachmentHandlingMode === 'specified-folder' || this.state.attachmentHandlingMode === 'subfolder') {
			const descText = this.state.attachmentHandlingMode === 'specified-folder' 
				? 'Enter the exact path to the folder for attachments (e.g., "attachments" or "images/attachments"). Leave blank to use "attachments" as default.'
				: 'Enter the name of the subfolder for attachments (e.g., "attachments"). Leave blank to use "attachments" as default.';
			
			const folderNameSetting = new Setting(stepContentWrapper)
				.setName('Attachment Folder')
				.setDesc(descText);

			folderNameSetting.addText(text => {
				text.setPlaceholder('attachments')
					.setValue(this.state.attachmentFolderName || '')
					.onChange(value => {
						this.state.attachmentFolderName = value || undefined;
					});
				
				// Add autocomplete suggester with mode (only if not same-folder)
				if (this.state.attachmentHandlingMode !== 'same-folder') {
					new FolderNameSuggest(this.app, text.inputEl, this.state.attachmentHandlingMode as 'specified-folder' | 'subfolder');
				}
			});
		}

		stepContentWrapper.createEl('hr', { cls: 'vault-cms-divider' });

		// Content types section
		stepContentWrapper.createEl('h3', { text: 'Content Types', cls: 'vault-cms-section-header' });

		for (const contentType of this.state.contentTypes) {
			const setting = new Setting(stepContentWrapper)
				.setName(contentType.name)
				.setDesc(`Folder: ${contentType.folder}`)
				.addToggle(toggle => toggle
					.setValue(contentType.enabled)
					.onChange(value => {
						contentType.enabled = value;
					}));

			// File organization dropdown
			new Setting(stepContentWrapper)
				.setName(`${contentType.name} - File Organization`)
				.setDesc('Choose how content is organized for this content type')
				.addDropdown(dropdown => dropdown
					.addOption('file', 'File-based')
					.addOption('folder', 'Folder-based')
					.setValue(contentType.fileOrganization || 'file')
					.onChange(value => {
						contentType.fileOrganization = value as 'file' | 'folder';
						// Re-render to show/hide index file name setting
						this.display();
					}));

			// Show index file name for folder-based organization
			if (contentType.fileOrganization === 'folder') {
				new Setting(stepContentWrapper)
					.setName(`${contentType.name} - Index File Name`)
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
				.setName(`${contentType.name} - Link Base Path`)
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
			text: 'Add Additional Content Type',
			cls: 'mod-cta'
		});
		addButton.style.marginTop = '20px';
		addButton.style.marginBottom = '30px';
		addButton.addEventListener('click', async () => {
			const selectedFolder = await this.selectContentTypeFolder();
			if (selectedFolder) {
				const folderName = path.basename(selectedFolder);
				const newType: ContentTypeConfig = {
					id: `content-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
					name: this.capitalizeFirst(folderName),
					folder: folderName,
					fileOrganization: 'file',
					enabled: false,
					indexFileName: 'index'
				};
				this.state.contentTypes.push(newType);
				this.display();
			}
		});
	}

	/**
	 * Select folder for additional content type
	 */
	private async selectContentTypeFolder(): Promise<string | null> {
		try {
			// Try multiple ways to access Electron dialog API
			let dialog: any = null;

			// Method 1: Try @electron/remote (newer Electron versions)
			try {
				const electronRemote = require('@electron/remote');
				dialog = electronRemote?.dialog;
			} catch (e) {
				// Not available, try next method
			}

			// Method 2: Try electron.remote.dialog (older Electron versions)
			if (!dialog) {
				try {
					const electron = (window as any).require?.('electron') || require('electron');
					dialog = electron?.remote?.dialog;
				} catch (e) {
					// Not available, try next method
				}
			}

			// Method 3: Try electron.dialog directly (main process, may not work)
			if (!dialog) {
				try {
					const electron = require('electron');
					dialog = electron?.dialog;
				} catch (e) {
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
				return path.normalize(result[0]);
			}
		} catch (error) {
			console.error('Error opening folder picker:', error);
			new Notice('Unable to open folder picker. Please ensure you are using Obsidian on desktop.');
		}

		return null;
	}

	/**
	 * Get the vault path
	 */
	private getVaultPath(): string {
		const adapter = this.app.vault.adapter as any;
		const vaultPath = adapter.basePath || adapter.path;
		return vaultPath ? path.resolve(vaultPath) : process.cwd();
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
		return 'Content Types';
	}

	getDescription(): string {
		return 'Configure content types';
	}
}
