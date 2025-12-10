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
		
		// Clear only the step content, preserve navigation footer
		const existingWrapper = containerEl.querySelector('.frontmatter-step-content');
		if (existingWrapper) {
			existingWrapper.remove();
		}
		
		const stepContentWrapper = containerEl.createDiv({ cls: 'frontmatter-step-content' });

		stepContentWrapper.createEl('h2', { text: 'Frontmatter Properties' });
		stepContentWrapper.createEl('p', { 
			text: 'Map frontmatter properties for each content type. We\'ll find example files to help you.' 
		});

		for (const contentType of this.state.contentTypes) {
			if (!contentType.enabled) {
				continue;
			}

			// Create a wrapper for this content type's settings
			const contentTypeWrapper = stepContentWrapper.createDiv({ cls: 'content-type-settings' });

			// Find example file
			if (!this.examples[contentType.id]) {
				const example = await this.frontmatterAnalyzer.findExampleFile(contentType.folder);
				if (example) {
					this.examples[contentType.id] = example;
				}
			}

			const example = this.examples[contentType.id];
			
			contentTypeWrapper.createEl('h3', { text: contentType.name });

			if (example) {
				contentTypeWrapper.createEl('p', { text: `Example file: ${example.file}` });
				contentTypeWrapper.createEl('pre', { 
					text: example.rawYaml,
					cls: 'frontmatter-example'
				});

				// Auto-detect properties
				const dateProp = this.frontmatterAnalyzer.autoDetectDateProperty(example.frontmatter);
				const descProp = this.frontmatterAnalyzer.autoDetectDescriptionProperty(example.frontmatter);
			}

			// Initialize properties if not exists
			if (!this.state.frontmatterProperties[contentType.id]) {
				const detectedDraft = example ? this.frontmatterAnalyzer.autoDetectDraftProperty(example.frontmatter) : null;
				const detectedTags = example ? this.frontmatterAnalyzer.autoDetectTagsProperty(example.frontmatter) : null;
				const detectedImage = example ? this.frontmatterAnalyzer.autoDetectImageProperty(example.frontmatter) : null;
				const detectedDesc = example ? this.frontmatterAnalyzer.autoDetectDescriptionProperty(example.frontmatter) : null;
				this.state.frontmatterProperties[contentType.id] = {
					titleProperty: example ? 'title' : '',
					dateProperty: example ? this.frontmatterAnalyzer.autoDetectDateProperty(example.frontmatter) : '',
					descriptionProperty: detectedDesc || undefined,
					tagsProperty: detectedTags || undefined,
					draftProperty: detectedDraft?.property,
					draftLogic: detectedDraft?.property === 'published' ? 'false-draft' : (detectedDraft ? 'true-draft' : undefined),
					imageProperty: detectedImage || undefined
				};
			}

			const props = this.state.frontmatterProperties[contentType.id];

			new Setting(contentTypeWrapper)
				.setName('Title Property')
				.setDesc('The frontmatter property that contains the title (e.g., title, name, heading). Leave blank to use file name instead.')
				.addText(text => {
					const detected = 'title';
					text.setPlaceholder(detected)
						.setValue(props.titleProperty || '')
						.onChange(value => {
							props.titleProperty = value.trim() || undefined;
						});
				});

			new Setting(contentTypeWrapper)
				.setName('Date Property')
				.setDesc('The frontmatter property that contains the date (e.g., date, pubDate, publishedDate, publishDate). Leave blank to use file created date instead.')
				.addText(text => {
					const detected = example ? this.frontmatterAnalyzer.autoDetectDateProperty(example.frontmatter) : 'date';
					text.setPlaceholder(detected)
						.setValue(props.dateProperty || '')
						.onChange(value => {
							props.dateProperty = value.trim() || undefined;
						});
				});

			const descSetting = new Setting(contentTypeWrapper)
				.setName('Has Description/Summary?')
				.setDesc('Does this content type have a description or summary field?');
			
			let descTextSetting: Setting | null = null;
			
			descSetting.addToggle(toggle => toggle
				.setValue(!!props.descriptionProperty)
				.onChange(value => {
					if (value && !props.descriptionProperty) {
						props.descriptionProperty = example ? 
							this.frontmatterAnalyzer.autoDetectDescriptionProperty(example.frontmatter) || 'description' : 
							'description';
						// Show text field
						if (!descTextSetting) {
							descTextSetting = new Setting(contentTypeWrapper)
								.setName('Description Property')
								.setDesc('The frontmatter property that contains the description (e.g., description, summary, excerpt, intro, snippet, blurb)')
								.addText(text => text
									.setValue(props.descriptionProperty || '')
									.onChange(value => {
										props.descriptionProperty = value.trim() || undefined;
									}));
							// Remove from current position and insert right after the toggle setting
							descTextSetting.settingEl.remove();
							descSetting.settingEl.insertAdjacentElement('afterend', descTextSetting.settingEl);
						}
					} else if (!value) {
						props.descriptionProperty = undefined;
						// Hide text field
						if (descTextSetting) {
							descTextSetting.settingEl.remove();
							descTextSetting = null;
						}
					}
				}));

			if (props.descriptionProperty) {
				descTextSetting = new Setting(contentTypeWrapper)
					.setName('Description Property')
					.setDesc('The frontmatter property that contains the description (e.g., description, summary, excerpt, intro, snippet, blurb)')
					.addText(text => text
						.setValue(props.descriptionProperty || '')
						.onChange(value => {
							props.descriptionProperty = value.trim() || undefined;
						}));
				// Remove from current position and insert right after the toggle setting
				descTextSetting.settingEl.remove();
				descSetting.settingEl.insertAdjacentElement('afterend', descTextSetting.settingEl);
			}

			// Has Tags?
			const tagsSetting = new Setting(contentTypeWrapper)
				.setName('Has Tags?')
				.setDesc('Does this content type have tags?');
			
			let tagsTextSetting: Setting | null = null;
			
			tagsSetting.addToggle(toggle => toggle
				.setValue(!!props.tagsProperty)
				.onChange(value => {
					if (value && !props.tagsProperty) {
						const detected = example ? this.frontmatterAnalyzer.autoDetectTagsProperty(example.frontmatter) : null;
						props.tagsProperty = detected || 'tags';
						// Show text field
						if (!tagsTextSetting) {
							tagsTextSetting = new Setting(contentTypeWrapper)
								.setName('Tags Property')
								.setDesc('The frontmatter property that contains tags (e.g., tags, tag, categories, category). Leave blank if not applicable.')
								.addText(text => {
									const detected = example ? this.frontmatterAnalyzer.autoDetectTagsProperty(example.frontmatter) : null;
									text.setPlaceholder(detected || 'tags')
										.setValue(props.tagsProperty || '')
										.onChange(value => {
											props.tagsProperty = value.trim() || undefined;
										});
								});
							// Remove from current position and insert right after the toggle setting
							tagsTextSetting.settingEl.remove();
							tagsSetting.settingEl.insertAdjacentElement('afterend', tagsTextSetting.settingEl);
						}
					} else if (!value) {
						props.tagsProperty = undefined;
						// Hide text field
						if (tagsTextSetting) {
							tagsTextSetting.settingEl.remove();
							tagsTextSetting = null;
						}
					}
				}));

			if (props.tagsProperty) {
				tagsTextSetting = new Setting(contentTypeWrapper)
					.setName('Tags Property')
					.setDesc('The frontmatter property that contains tags (e.g., tags, tag, categories, category). Leave blank if not applicable.')
					.addText(text => {
						const detected = example ? this.frontmatterAnalyzer.autoDetectTagsProperty(example.frontmatter) : null;
						text.setPlaceholder(detected || 'tags')
							.setValue(props.tagsProperty || '')
							.onChange(value => {
								props.tagsProperty = value.trim() || undefined;
							});
					});
				// Remove from current position and insert right after the toggle setting
				tagsTextSetting.settingEl.remove();
				tagsSetting.settingEl.insertAdjacentElement('afterend', tagsTextSetting.settingEl);
			}

			// Has Draft Status?
			const draftSetting = new Setting(contentTypeWrapper)
				.setName('Has Draft Status?')
				.setDesc('Does this content type have draft status?');
			
			let draftPropertySetting: Setting | null = null;
			let draftLogicSetting: Setting | null = null;
			
			draftSetting.addToggle(toggle => toggle
				.setValue(!!props.draftProperty)
				.onChange(value => {
					if (value && !props.draftProperty) {
						const detectedDraft = example ? this.frontmatterAnalyzer.autoDetectDraftProperty(example.frontmatter) : null;
						props.draftProperty = detectedDraft?.property || 'draft';
						// Fix logic: if property is "draft", use "true-draft", if "published" use "false-draft"
						if (detectedDraft?.property === 'published') {
							props.draftLogic = 'false-draft';
						} else {
							props.draftLogic = 'true-draft';
						}
						// Show fields
						if (!draftPropertySetting) {
							draftPropertySetting = new Setting(contentTypeWrapper)
								.setName('Draft Property')
								.setDesc('The frontmatter property that contains draft status. Leave blank to use an underscore prefix instead.')
								.addText(text => {
									const detected = example ? this.frontmatterAnalyzer.autoDetectDraftProperty(example.frontmatter) : null;
									text.setPlaceholder(detected?.property || 'draft')
										.setValue(props.draftProperty || '')
										.onChange(value => {
											props.draftProperty = value.trim() || undefined;
											// Update logic based on property name
											if (value === 'published') {
												props.draftLogic = 'false-draft';
											} else if (value) {
												props.draftLogic = 'true-draft';
											}
											// Show/hide logic dropdown
											if (value && !draftLogicSetting) {
												draftLogicSetting = new Setting(contentTypeWrapper)
													.setName('Draft Logic')
													.setDesc('How draft status is represented')
													.addDropdown(dropdown => dropdown
														.addOption('true-draft', 'true = draft')
														.addOption('false-draft', 'false = draft')
														.setValue(props.draftLogic || 'true-draft')
														.onChange(dropdownValue => {
															props.draftLogic = dropdownValue as 'true-draft' | 'false-draft';
														}));
												draftLogicSetting.settingEl.remove();
												if (draftPropertySetting) {
													draftPropertySetting.settingEl.insertAdjacentElement('afterend', draftLogicSetting.settingEl);
												}
											} else if (!value && draftLogicSetting) {
												draftLogicSetting.settingEl.remove();
												draftLogicSetting = null;
											}
										});
								});
							// Remove from current position and insert right after the toggle setting
							draftPropertySetting.settingEl.remove();
							draftSetting.settingEl.insertAdjacentElement('afterend', draftPropertySetting.settingEl);
						}
						// Show logic dropdown if property is set
						if (props.draftProperty && !draftLogicSetting) {
							draftLogicSetting = new Setting(contentTypeWrapper)
								.setName('Draft Logic')
								.setDesc('How draft status is represented')
								.addDropdown(dropdown => dropdown
									.addOption('true-draft', 'true = draft')
									.addOption('false-draft', 'false = draft')
									.setValue(props.draftLogic || 'true-draft')
									.onChange(value => {
										props.draftLogic = value as 'true-draft' | 'false-draft';
									}));
							// Remove from current position and insert right after the draft property setting
							draftLogicSetting.settingEl.remove();
							if (draftPropertySetting) {
								draftPropertySetting.settingEl.insertAdjacentElement('afterend', draftLogicSetting.settingEl);
							}
						}
					} else if (!value) {
						props.draftProperty = undefined;
						props.draftLogic = undefined;
						// Hide fields
						if (draftPropertySetting) {
							draftPropertySetting.settingEl.remove();
							draftPropertySetting = null;
						}
						if (draftLogicSetting) {
							draftLogicSetting.settingEl.remove();
							draftLogicSetting = null;
						}
					}
				}));

			if (props.draftProperty) {
				draftPropertySetting = new Setting(contentTypeWrapper)
					.setName('Draft Property')
					.setDesc('The frontmatter property that contains draft status. Leave blank to use an underscore prefix instead.')
					.addText(text => {
						const detected = example ? this.frontmatterAnalyzer.autoDetectDraftProperty(example.frontmatter) : null;
						text.setPlaceholder(detected?.property || 'draft')
							.setValue(props.draftProperty || '')
							.onChange(value => {
								props.draftProperty = value.trim() || undefined;
								// Update logic based on property name
								if (value === 'published') {
									props.draftLogic = 'false-draft';
								} else if (value) {
									props.draftLogic = 'true-draft';
								}
								// Show/hide logic dropdown
								if (value && !draftLogicSetting) {
									draftLogicSetting = new Setting(contentTypeWrapper)
										.setName('Draft Logic')
										.setDesc('How draft status is represented')
										.addDropdown(dropdown => dropdown
											.addOption('true-draft', 'true = draft')
											.addOption('false-draft', 'false = draft')
											.setValue(props.draftLogic || 'true-draft')
											.onChange(dropdownValue => {
												props.draftLogic = dropdownValue as 'true-draft' | 'false-draft';
											}));
									draftLogicSetting.settingEl.remove();
									if (draftPropertySetting) {
										draftPropertySetting.settingEl.insertAdjacentElement('afterend', draftLogicSetting.settingEl);
									}
								} else if (!value && draftLogicSetting) {
									draftLogicSetting.settingEl.remove();
									draftLogicSetting = null;
								}
							});
					});
				// Remove from current position and insert right after the toggle setting
				draftPropertySetting.settingEl.remove();
				draftSetting.settingEl.insertAdjacentElement('afterend', draftPropertySetting.settingEl);

				if (props.draftProperty) {
					draftLogicSetting = new Setting(contentTypeWrapper)
						.setName('Draft Logic')
						.setDesc('How draft status is represented')
						.addDropdown(dropdown => dropdown
							.addOption('true-draft', 'true = draft')
							.addOption('false-draft', 'false = draft')
							.setValue(props.draftLogic || 'true-draft')
							.onChange(value => {
								props.draftLogic = value as 'true-draft' | 'false-draft';
							}));
					// Remove from current position and insert right after the draft property setting
					draftLogicSetting.settingEl.remove();
					if (draftPropertySetting) {
						draftPropertySetting.settingEl.insertAdjacentElement('afterend', draftLogicSetting.settingEl);
					}
				}
			}

			// Has Image Property?
			const imageSetting = new Setting(contentTypeWrapper)
				.setName('Has Image/Cover Property?')
				.setDesc('Does this content type have an image or cover property? Used for Bases CMS cover images, Simple Banner, and Image Inserter.');
			
			let imageTextSetting: Setting | null = null;
			
			imageSetting.addToggle(toggle => toggle
				.setValue(!!props.imageProperty)
				.onChange(value => {
					if (value && !props.imageProperty) {
						const detected = example ? this.frontmatterAnalyzer.autoDetectImageProperty(example.frontmatter) : null;
						props.imageProperty = detected || 'image';
						// Show text field
						if (!imageTextSetting) {
							imageTextSetting = new Setting(contentTypeWrapper)
								.setName('Image Property')
								.setDesc('The frontmatter property that contains the image/cover (e.g., image, cover, coverImage, thumbnail, featuredImage). Leave blank if not applicable.')
								.addText(text => {
									const detected = example ? this.frontmatterAnalyzer.autoDetectImageProperty(example.frontmatter) : null;
									text.setPlaceholder(detected || 'image')
										.setValue(props.imageProperty || '')
										.onChange(value => {
											props.imageProperty = value.trim() || undefined;
										});
								});
							// Remove from current position and insert right after the toggle setting
							imageTextSetting.settingEl.remove();
							imageSetting.settingEl.insertAdjacentElement('afterend', imageTextSetting.settingEl);
						}
					} else if (!value) {
						props.imageProperty = undefined;
						// Hide text field
						if (imageTextSetting) {
							imageTextSetting.settingEl.remove();
							imageTextSetting = null;
						}
					}
				}));

			if (props.imageProperty) {
				imageTextSetting = new Setting(contentTypeWrapper)
					.setName('Image Property')
					.setDesc('The frontmatter property that contains the image/cover (e.g., image, cover, coverImage, thumbnail, featuredImage). Leave blank if not applicable.')
					.addText(text => {
						const detected = example ? this.frontmatterAnalyzer.autoDetectImageProperty(example.frontmatter) : null;
						text.setPlaceholder(detected || 'image')
							.setValue(props.imageProperty || '')
							.onChange(value => {
								props.imageProperty = value.trim() || undefined;
							});
					});
				// Remove from current position and insert right after the toggle setting
				imageTextSetting.settingEl.remove();
				imageSetting.settingEl.insertAdjacentElement('afterend', imageTextSetting.settingEl);
			}

			// Template editor
			contentTypeWrapper.createEl('h4', { text: 'Template' });
			contentTypeWrapper.createEl('p', { 
				text: 'Edit the template that will be used when creating new files of this content type. Use {{title}} and {{date}} as placeholders.' 
			});

			// Initialize template if not exists
			if (!props.template) {
				// Generate default template based on properties
				const isPosts = contentType.name === 'Posts';
				props.template = this.generateDefaultTemplate(props, isPosts, example);
			}

			const templateTextArea = contentTypeWrapper.createEl('textarea', {
				cls: 'template-editor',
				attr: {
					rows: '10',
					style: 'width: 100%; font-family: monospace;'
				}
			});
			templateTextArea.value = props.template || '';
			templateTextArea.addEventListener('input', (e) => {
				const target = e.target as HTMLTextAreaElement;
				props.template = target.value;
			});
		}
	}

	private generateDefaultTemplate(props: any, includeDate: boolean, example: any): string {
		let template = '---\n';
		
		// Parse the original YAML to maintain order
		if (example && example.rawYaml) {
			// Parse the raw YAML line by line to maintain order
			const lines = example.rawYaml.split('\n');
			const processedProps = new Set<string>();
			
			// First, add title property (replace if exists in original)
			let titleAdded = false;
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;
				
				const colonIndex = trimmed.indexOf(':');
				if (colonIndex > 0) {
					const prop = trimmed.substring(0, colonIndex).trim();
					if (prop === props.titleProperty) {
						template += `${props.titleProperty}: "{{title}}"\n`;
						titleAdded = true;
						processedProps.add(prop);
						continue;
					}
				}
			}
			if (!titleAdded) {
				template += `${props.titleProperty}: "{{title}}"\n`;
			}
			
			// Then process other lines in order
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;
				
				const colonIndex = trimmed.indexOf(':');
				if (colonIndex > 0) {
					const prop = trimmed.substring(0, colonIndex).trim();
					
					// Skip if already processed
					if (processedProps.has(prop)) {
						continue;
					}
					
					// Skip title (already added)
					if (prop === props.titleProperty) {
						continue;
					}
					
					// Handle date property
					if (prop === props.dateProperty && includeDate) {
						template += `${props.dateProperty}: {{date}}\n`;
						processedProps.add(prop);
						continue;
					}
					
					// Handle description property
					if (prop === props.descriptionProperty) {
						template += `${props.descriptionProperty}: ""\n`;
						processedProps.add(prop);
						continue;
					}
					
					// Process other properties
					const value = example.frontmatter[prop];
					if (value === null || value === undefined) {
						template += `${prop}:\n`;
					} else if (Array.isArray(value)) {
						template += `${prop}: []\n`;
					} else if (typeof value === 'boolean') {
						template += `${prop}: ${value}\n`;
					} else if (typeof value === 'number') {
						template += `${prop}: ${value}\n`;
					} else if (typeof value === 'string') {
						// Check if it looks like a date (YYYY-MM-DD format)
						if (/^\d{4}-\d{2}-\d{2}/.test(value) && prop.toLowerCase().includes('date')) {
							template += `${prop}: {{date}}\n`;
						} else {
							template += `${prop}: ""\n`;
						}
					} else if (typeof value === 'object') {
						if (Array.isArray(value)) {
							template += `${prop}: []\n`;
						} else {
							template += `${prop}:\n`;
						}
					}
					
					processedProps.add(prop);
				}
			}
		} else {
			// Default template if no example
			template += `${props.titleProperty}: "{{title}}"\n`;
			if (includeDate && props.dateProperty) {
				template += `${props.dateProperty}: {{date}}\n`;
			}
			if (props.descriptionProperty) {
				template += `${props.descriptionProperty}: ""\n`;
			}
			template += 'tags: []\n';
			template += 'draft: true\n';
		}
		
		template += '---\n';
		return template;
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

