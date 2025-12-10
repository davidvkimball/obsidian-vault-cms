import { App, Setting, Notice, TFolder } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';
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

		// Shared attachments folder option for file-based content types
		const fileBasedTypes = this.state.contentTypes.filter(ct => ct.enabled && ct.organizationMode === 'file');
		if (fileBasedTypes.length > 0) {
			const showSharedOption = !!this.state.sharedAttachmentsFolder;
			
			const sharedAttachmentsSetting = new Setting(stepContentWrapper)
				.setName('Use Shared Attachments Folder')
				.setDesc('Enable to use a single attachments folder for all file-based content types. Only affects file-based content types.');

			sharedAttachmentsSetting.addToggle(toggle => toggle
				.setValue(showSharedOption)
				.onChange((value) => {
					if (!value) {
						// Clear shared folder when toggled off
						this.state.sharedAttachmentsFolder = undefined;
						// Clear from content types
						for (const contentType of fileBasedTypes) {
							contentType.attachmentsFolder = undefined;
						}
					}
					this.display(); // Re-render to show/hide browse button
				}));

			if (showSharedOption) {
				const sharedDisplay = sharedAttachmentsSetting.descEl.createDiv({
					text: this.state.sharedAttachmentsFolder || 'No folder selected',
					cls: 'vault-cms-path-display'
				});
				sharedDisplay.style.color = this.state.sharedAttachmentsFolder ? 'var(--text-normal)' : 'var(--text-muted)';
				sharedDisplay.style.marginTop = '8px';

				sharedAttachmentsSetting.addButton(button => button
					.setButtonText('Browse...')
					.setCta()
					.onClick(async () => {
						const selectedPath = await this.selectAttachmentsFolder('');
						if (selectedPath) {
							this.state.sharedAttachmentsFolder = selectedPath;
							// Apply to all file-based content types
							for (const contentType of fileBasedTypes) {
								contentType.attachmentsFolder = selectedPath;
							}
							this.display(); // Re-render to update displays
						}
					}));
			}
		}

		for (const contentType of this.state.contentTypes) {
			const setting = new Setting(stepContentWrapper)
				.setName(contentType.name)
				.setDesc(`Folder: ${contentType.folder}`)
				.addToggle(toggle => toggle
					.setValue(contentType.enabled)
					.onChange(value => {
						contentType.enabled = value;
					}));

			new Setting(stepContentWrapper)
				.setName(`${contentType.name} - Organization Mode`)
				.setDesc('Choose how content is organized')
				.addDropdown(dropdown => dropdown
					.addOption('file', 'File-based')
					.addOption('folder', 'Folder-based')
					.setValue(contentType.organizationMode)
					.onChange(value => {
						contentType.organizationMode = value as 'file' | 'folder';
						// Re-render to show/hide attachments folder setting
						this.display();
					}));

			// Show attachments folder picker for file-based organization (only if shared is not enabled)
			if (contentType.organizationMode === 'file' && !this.state.sharedAttachmentsFolder) {
				const attachmentsSetting = new Setting(stepContentWrapper)
					.setName(`${contentType.name} - Attachments Folder`)
					.setDesc('Select the folder where images and attachments are stored for this content type');

				const attachmentsDisplay = attachmentsSetting.descEl.createDiv({
					text: contentType.attachmentsFolder || 'No folder selected',
					cls: 'vault-cms-path-display'
				});
				if (contentType.attachmentsFolder) {
					attachmentsDisplay.style.color = 'var(--text-normal)';
				} else {
					attachmentsDisplay.style.color = 'var(--text-muted)';
				}

				attachmentsSetting.addButton(button => button
					.setButtonText('Browse...')
					.setCta()
					.onClick(async () => {
						const selectedPath = await this.selectAttachmentsFolder(contentType.folder);
						if (selectedPath) {
							contentType.attachmentsFolder = selectedPath;
							attachmentsDisplay.textContent = selectedPath;
							attachmentsDisplay.style.color = 'var(--text-normal)';
						}
					}));
			} else if (contentType.organizationMode === 'file' && this.state.sharedAttachmentsFolder) {
				// Show that shared folder is being used
				new Setting(stepContentWrapper)
					.setName(`${contentType.name} - Attachments Folder`)
					.setDesc(`Using shared folder: ${this.state.sharedAttachmentsFolder}`);
			}

			if (contentType.organizationMode === 'folder') {
				new Setting(stepContentWrapper)
					.setName(`${contentType.name} - Index File Name`)
					.setDesc('Name of the index file in folder-based organization')
					.addText(text => text
						.setValue(contentType.indexFileName || 'index')
						.onChange(value => {
							contentType.indexFileName = value || 'index';
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
					organizationMode: 'file',
					enabled: false,
					indexFileName: 'index'
				};
				this.state.contentTypes.push(newType);
				this.display();
			}
		});
	}

	/**
	 * Select attachments folder for file-based content
	 */
	private async selectAttachmentsFolder(contentFolder: string): Promise<string | null> {
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

			// Default to content folder or vault root
			const vaultPath = this.getVaultPath();
			const defaultPath = path.join(vaultPath, contentFolder);

			const result = dialog.showOpenDialogSync({
				title: 'Select Attachments Folder',
				defaultPath: defaultPath,
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

