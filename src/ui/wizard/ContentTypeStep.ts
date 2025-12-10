import { App, Setting, Notice, TFolder } from 'obsidian';
import * as path from 'path';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState, ContentTypeConfig } from '../../types';
import { ContentTypeDetector } from '../../utils/ContentTypeDetector';

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

		for (const contentType of this.state.contentTypes) {
			const setting = new Setting(stepContentWrapper)
				.setName(contentType.name)
				.setDesc(`Folder: ${contentType.folder}`)
				.addToggle(toggle => toggle
					.setValue(contentType.enabled)
					.onChange(value => {
						contentType.enabled = value;
					}));

			// Attachment handling dropdown
			new Setting(stepContentWrapper)
				.setName(`${contentType.name} - How are attachments handled?`)
				.setDesc('Choose how attachments are stored for this content type')
				.addDropdown(dropdown => dropdown
					.addOption('same-folder', 'Same folder as current file')
					.addOption('specified-folder', 'In the specified folder')
					.addOption('subfolder', 'In subfolder under current folder')
					.setValue(contentType.attachmentHandlingMode || 'same-folder')
					.onChange(value => {
						contentType.attachmentHandlingMode = value as 'specified-folder' | 'same-folder' | 'subfolder';
						// Clear folder name if switching to same-folder
						if (value === 'same-folder') {
							contentType.attachmentFolderName = undefined;
						} else if (!contentType.attachmentFolderName) {
							// Set default folder name if not set
							contentType.attachmentFolderName = 'images';
						}
						// Re-render to show/hide folder name input
						this.display();
					}));

			// Show folder name input for specified-folder or subfolder modes
			if (contentType.attachmentHandlingMode === 'specified-folder' || contentType.attachmentHandlingMode === 'subfolder') {
				new Setting(stepContentWrapper)
					.setName(`${contentType.name} - Attachment Folder Name`)
					.setDesc('Enter the name of the folder for attachments (e.g., "images")')
					.addText(text => text
						.setPlaceholder('images')
						.setValue(contentType.attachmentFolderName || 'images')
						.onChange(value => {
							contentType.attachmentFolderName = value || 'images';
						}));
			}
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
					attachmentHandlingMode: 'same-folder',
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
