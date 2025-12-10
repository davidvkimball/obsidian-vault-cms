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

		const allPlugins = [
			'astro-composer',
			'bases-cms',
			'insert-unsplash-image',
			'homepage',
			'new-tab-default-page',
			'custom-save',
			'title-only-tab',
			'seo',
			'property-over-file-name',
			'settings-search',
			'statusbar-organizer',
			'zenmode',
			'cmdr',
			'obsidian-paste-image-rename',
			'obsidian42-brat',
			'editing-toolbar',
			'simple-focus',
			'tag-wrangler',
			'obsidian-minimal-settings',
			'obsidian-hider',
			'disable-tabs',
			'obsidian-style-settings',
			'mdx-as-md-obsidian'
		];

		for (const pluginId of allPlugins) {
			const isEnabled = this.state.enabledPlugins.includes(pluginId);
			
			new Setting(containerEl)
				.setName(pluginId)
				.addToggle(toggle => toggle
					.setValue(isEnabled)
					.onChange(value => {
						if (value) {
							if (!this.state.enabledPlugins.includes(pluginId)) {
								this.state.enabledPlugins.push(pluginId);
							}
							this.state.disabledPlugins = this.state.disabledPlugins.filter(p => p !== pluginId);
						} else {
							this.state.enabledPlugins = this.state.enabledPlugins.filter(p => p !== pluginId);
							if (!this.state.disabledPlugins.includes(pluginId)) {
								this.state.disabledPlugins.push(pluginId);
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

