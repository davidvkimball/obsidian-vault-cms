import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { PluginManager } from '../../utils/PluginManager';

export class OptionalPluginsStep extends BaseWizardStep {
	private pluginManager: PluginManager;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.pluginManager = new PluginManager(app);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		if (this.state.preset !== 'custom') {
			containerEl.createEl('h2', { text: 'Plugin Configuration' });
			containerEl.createEl('p', { 
				text: `Using ${this.state.preset} preset. Plugins will be configured automatically.` 
			});
			return;
		}

		containerEl.createEl('h2', { text: 'Optional Plugins' });
		containerEl.createEl('p', { 
			text: 'Select which plugins to enable:' 
		});

		// Only optional plugins - core plugins are not listed here
		// Map of plugin IDs to their display names
		const optionalPlugins: { id: string; name: string }[] = [
			{ id: 'insert-unsplash-image', name: 'Image Inserter' },
			{ id: 'title-only-tab', name: 'Title Only Tab' },
			{ id: 'obsidian-paste-image-rename', name: 'Paste Image Rename' },
			{ id: 'obsidian42-brat', name: 'BRAT' },
			{ id: 'obsidian-style-settings', name: 'Style Settings' },
			{ id: 'simple-banner', name: 'Simple Banner' },
			{ id: 'alias-file-name-history', name: 'Alias File Name History' },
			{ id: 'folder-notes', name: 'Folder notes' },
			{ id: 'iconic', name: 'Iconic' }
		];

		for (const plugin of optionalPlugins) {
			const isEnabled = this.state.enabledPlugins.includes(plugin.id);
			
			new Setting(containerEl)
				.setName(plugin.name)
				.setDesc(`Plugin ID: ${plugin.id}`)
				.addToggle(toggle => toggle
					.setValue(isEnabled)
					.onChange(value => {
						if (value) {
							if (!this.state.enabledPlugins.includes(plugin.id)) {
								this.state.enabledPlugins.push(plugin.id);
							}
							this.state.disabledPlugins = this.state.disabledPlugins.filter(p => p !== plugin.id);
						} else {
							this.state.enabledPlugins = this.state.enabledPlugins.filter(p => p !== plugin.id);
							if (!this.state.disabledPlugins.includes(plugin.id)) {
								this.state.disabledPlugins.push(plugin.id);
							}
						}
					}));
		}
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Optional Plugins';
	}

	getDescription(): string {
		return 'Configure optional plugins';
	}
}

