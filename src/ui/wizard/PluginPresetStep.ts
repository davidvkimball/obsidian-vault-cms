import { Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';

export class PluginPresetStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Plugin preset' });
		containerEl.createEl('p', { 
			text: 'Select a preset configuration for your plugins and theme:' 
		});

		new Setting(containerEl)
			.setName('Preset')
			.setDesc('Choose a preset configuration')
			.addDropdown(dropdown => dropdown
				.addOption('vanilla', 'Vanilla')
				.addOption('opinionated', 'Opinionated')
				.addOption('custom', 'Custom')
				.setValue(this.state.preset)
				.onChange(value => {
					this.state.preset = value as 'vanilla' | 'opinionated' | 'custom';
					
					if (value === 'vanilla') {
						this.state.theme = '';
					} else if (value === 'opinionated') {
						this.state.theme = 'obsidian-oxygen';
					} else {
						// Custom - don't change theme
					}
				}));

		if (this.state.preset === 'vanilla') {
			containerEl.createEl('p', { 
				// False positive: "Obsidian" is a proper noun (product name) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Vanilla preset: Uses default Obsidian theme, look, and UI with all common plugins enabled.' 
			});
		} else if (this.state.preset === 'opinionated') {
			containerEl.createEl('p', { 
				// False positive: "Oxygen" is a proper noun (theme name) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Opinionated preset: Uses Oxygen theme with its settings enabled and optimized plugin configuration.' 
			});
		} else {
			containerEl.createEl('p', { 
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Custom preset: You will be able to select individual plugins in the next step. No theme changes will be made.' 
			});
		}
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Plugin preset';
	}

	getDescription(): string {
		return 'Select plugin preset';
	}
}

