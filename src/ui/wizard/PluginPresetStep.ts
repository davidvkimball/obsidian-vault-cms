import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

export class PluginPresetStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Plugin Preset' });
		containerEl.createEl('p', { 
			text: 'Select a preset configuration for your plugins and theme:' 
		});

		new Setting(containerEl)
			.setName('Preset')
			.setDesc('Choose a preset configuration')
			.addDropdown(dropdown => dropdown
				.addOption('default', 'Default')
				.addOption('minimal', 'Minimal')
				.addOption('custom', 'Custom')
				.setValue(this.state.preset)
				.onChange(value => {
					this.state.preset = value as 'default' | 'minimal' | 'custom';
					
					if (value === 'default') {
						this.state.theme = '';
					} else if (value === 'minimal') {
						this.state.theme = 'obsidian-minimal';
					}
				}));

		if (this.state.preset === 'default') {
			containerEl.createEl('p', { 
				text: 'Default preset: Uses default Obsidian theme with all common plugins enabled.' 
			});
		} else if (this.state.preset === 'minimal') {
			containerEl.createEl('p', { 
				text: 'Minimal preset: Uses Minimal theme with minimal-specific plugins enabled.' 
			});
		} else {
			containerEl.createEl('p', { 
				text: 'Custom preset: You will be able to select individual plugins in the next step.' 
			});
		}
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Plugin Preset';
	}

	getDescription(): string {
		return 'Select plugin preset';
	}
}

