import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { FrontmatterAnalyzer } from '../../utils/FrontmatterAnalyzer';

export class FrontmatterPropertiesStep extends BaseWizardStep {
	private frontmatterAnalyzer: FrontmatterAnalyzer;
	private examples: { [contentTypeId: string]: any } = {};

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.frontmatterAnalyzer = new FrontmatterAnalyzer(app);
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Frontmatter Properties' });
		containerEl.createEl('p', { 
			text: 'Map frontmatter properties for each content type. We\'ll find example files to help you.' 
		});

		for (const contentType of this.state.contentTypes) {
			if (!contentType.enabled) {
				continue;
			}

			// Find example file
			if (!this.examples[contentType.id]) {
				const example = await this.frontmatterAnalyzer.findExampleFile(contentType.folder);
				if (example) {
					this.examples[contentType.id] = example;
				}
			}

			const example = this.examples[contentType.id];
			
			containerEl.createEl('h3', { text: contentType.name });

			if (example) {
				containerEl.createEl('p', { text: `Example file: ${example.file}` });
				containerEl.createEl('pre', { 
					text: example.rawYaml,
					cls: 'frontmatter-example'
				});

				// Auto-detect properties
				const dateProp = this.frontmatterAnalyzer.autoDetectDateProperty(example.frontmatter);
				const descProp = this.frontmatterAnalyzer.autoDetectDescriptionProperty(example.frontmatter);
			}

			// Initialize properties if not exists
			if (!this.state.frontmatterProperties[contentType.id]) {
				this.state.frontmatterProperties[contentType.id] = {
					titleProperty: 'title',
					dateProperty: example ? this.frontmatterAnalyzer.autoDetectDateProperty(example.frontmatter) : 'date',
					descriptionProperty: example ? this.frontmatterAnalyzer.autoDetectDescriptionProperty(example.frontmatter) || undefined : undefined
				};
			}

			const props = this.state.frontmatterProperties[contentType.id];

			new Setting(containerEl)
				.setName('Title Property')
				.setDesc('The frontmatter property that contains the title')
				.addText(text => text
					.setValue(props.titleProperty)
					.onChange(value => {
						props.titleProperty = value || 'title';
					}));

			new Setting(containerEl)
				.setName('Date Property')
				.setDesc('The frontmatter property that contains the date')
				.addText(text => text
					.setValue(props.dateProperty)
					.onChange(value => {
						props.dateProperty = value || 'date';
					}));

			new Setting(containerEl)
				.setName('Has Description/Summary?')
				.setDesc('Does this content type have a description or summary field?')
				.addToggle(toggle => toggle
					.setValue(!!props.descriptionProperty)
					.onChange(value => {
						if (value && !props.descriptionProperty) {
							props.descriptionProperty = example ? 
								this.frontmatterAnalyzer.autoDetectDescriptionProperty(example.frontmatter) || 'description' : 
								'description';
						} else if (!value) {
							props.descriptionProperty = undefined;
						}
					}));

			if (props.descriptionProperty) {
				new Setting(containerEl)
					.setName('Description Property')
					.setDesc('The frontmatter property that contains the description (e.g., description, summary, excerpt, intro, snippet, blurb)')
					.addText(text => text
						.setValue(props.descriptionProperty || '')
						.onChange(value => {
							props.descriptionProperty = value || undefined;
						}));
			}
		}
	}

	validate(): boolean {
		for (const contentType of this.state.contentTypes) {
			if (contentType.enabled) {
				const props = this.state.frontmatterProperties[contentType.id];
				if (!props || !props.titleProperty || !props.dateProperty) {
					return false;
				}
			}
		}
		return true;
	}

	getTitle(): string {
		return 'Frontmatter Properties';
	}

	getDescription(): string {
		return 'Map frontmatter properties';
	}
}

