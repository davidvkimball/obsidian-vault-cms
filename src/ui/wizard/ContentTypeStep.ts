import { App, Setting } from 'obsidian';
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
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Content Types' });
		containerEl.createEl('p', { 
			text: 'Detecting content types in your vault...' 
		});

		if (!this.detected) {
			const detectedTypes = await this.contentTypeDetector.detectContentTypes();
			this.state.contentTypes = detectedTypes;
			this.detected = true;
		}

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Content Types' });
		containerEl.createEl('p', { 
			text: 'Select and configure your content types:' 
		});

		for (const contentType of this.state.contentTypes) {
			const setting = new Setting(containerEl)
				.setName(contentType.name)
				.setDesc(`Folder: ${contentType.folder}`)
				.addToggle(toggle => toggle
					.setValue(contentType.enabled)
					.onChange(value => {
						contentType.enabled = value;
					}));

			new Setting(containerEl)
				.setName(`${contentType.name} - Organization Mode`)
				.setDesc('Choose how content is organized')
				.addDropdown(dropdown => dropdown
					.addOption('file', 'File-based')
					.addOption('folder', 'Folder-based')
					.setValue(contentType.organizationMode)
					.onChange(value => {
						contentType.organizationMode = value as 'file' | 'folder';
					}));

			if (contentType.organizationMode === 'folder') {
				new Setting(containerEl)
					.setName(`${contentType.name} - Index File Name`)
					.setDesc('Name of the index file in folder-based organization')
					.addText(text => text
						.setValue(contentType.indexFileName || 'index')
						.onChange(value => {
							contentType.indexFileName = value || 'index';
						}));
			}
		}

		containerEl.createEl('button', { 
			text: 'Add Custom Content Type',
			cls: 'mod-cta'
		}).addEventListener('click', () => {
			const newType: ContentTypeConfig = {
				id: `content-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				name: 'Custom Type',
				folder: 'custom',
				organizationMode: 'file',
				enabled: true,
				indexFileName: 'index'
			};
			this.state.contentTypes.push(newType);
			this.display();
		});
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

