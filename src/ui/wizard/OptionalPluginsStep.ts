import { App, Setting, setIcon } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { PluginManager } from '../../utils/PluginManager';

// Helper function for setCssProps
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}

interface PluginInfo {
	id: string;
	name: string;
	category: 'essential' | 'nice-to-have';
	/** 'community' = in official directory, 'brat' = install via BRAT from GitHub */
	source?: 'community' | 'brat';
	/** GitHub repo for BRAT-only plugins (e.g. 'davidvkimball/obsidian-seo') */
	repo?: string;
}

export class OptionalPluginsStep extends BaseWizardStep {
	private pluginManager: PluginManager;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.pluginManager = new PluginManager(app);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Plugin detection' });
		containerEl.createEl('p', {
			text: 'Review and configure your installed plugins. Essential plugins are recommended for the core Vault CMS experience.'
		});

		const allPlugins: PluginInfo[] = [
			{ id: 'astro-composer', name: 'Astro Composer', category: 'essential', source: 'brat', repo: 'davidvkimball/obsidian-astro-composer' },
			{ id: 'bases-cms', name: 'Bases CMS', category: 'essential', source: 'brat', repo: 'davidvkimball/obsidian-bases-cms' },
			{ id: 'editing-toolbar', name: 'Editing Toolbar', category: 'essential', source: 'community' },
			{ id: 'home-base', name: 'Home Base', category: 'essential', source: 'brat', repo: 'davidvkimball/obsidian-home-base' },
			{ id: 'image-manager', name: 'Image Manager', category: 'essential', source: 'brat', repo: 'davidvkimball/obsidian-image-manager' },
			{ id: 'property-over-file-name', name: 'Property Over File Name', category: 'essential', source: 'brat', repo: 'davidvkimball/obsidian-property-over-file-name' },
			{ id: 'seo', name: 'SEO', category: 'essential', source: 'brat', repo: 'davidvkimball/obsidian-seo' },
			{ id: 'ui-tweaker', name: 'UI Tweaker', category: 'essential', source: 'brat', repo: 'davidvkimball/obsidian-ui-tweaker' },
			{ id: 'omnisearch', name: 'Omnisearch', category: 'nice-to-have', source: 'community' },
			{ id: 'file-name-history', name: 'File Name History', category: 'nice-to-have', source: 'brat', repo: 'davidvkimball/obsidian-file-name-history' },
			{ id: 'data-files-editor', name: 'Data Files Editor', category: 'nice-to-have', source: 'brat', repo: 'davidvkimball/obsidian-data-files-editor' },
			{ id: 'settings-search', name: 'Settings Search', category: 'nice-to-have', source: 'community' },
			{ id: 'tag-wrangler', name: 'Tag Wrangler', category: 'nice-to-have', source: 'community' },
			{ id: 'zenmode', name: 'Zen Mode', category: 'nice-to-have', source: 'brat', repo: 'davidvkimball/obsidian-zenmode' },
			{ id: 'explorer-focus', name: 'Explorer Focus', category: 'nice-to-have', source: 'brat', repo: 'davidvkimball/obsidian-explorer-focus' }
		];

		const plugins = (this.app as { plugins?: { plugins?: Record<string, unknown>; enabledPlugins?: Set<string> } }).plugins;
		const installedPluginIds = plugins?.plugins ? Object.keys(plugins.plugins) : [];
		const ignoredPlugins = ['obsidian42-brat', 'astro-modular-settings', 'folder-notes', 'disable-tabs', 'vault-cms'];

		const essentialPlugins = allPlugins.filter(p =>
			p.category === 'essential' && installedPluginIds.includes(p.id) && !ignoredPlugins.includes(p.id)
		);
		const niceToHavePlugins = allPlugins.filter(p =>
			p.category === 'nice-to-have' && installedPluginIds.includes(p.id) && !ignoredPlugins.includes(p.id)
		).sort((a, b) => a.name.localeCompare(b.name));

		// Essential Plugins Details
		if (essentialPlugins.length > 0) {
			const details = containerEl.createEl('details', { attr: { style: 'margin-bottom: 1rem;' } });
			details.createEl('summary', {
				text: `Essential plugins (${essentialPlugins.length} found)`,
				attr: { style: 'font-weight: bold; cursor: pointer; padding: 0.5rem 0;' }
			});

			const content = details.createDiv({ attr: { style: 'padding: 0.5rem 0.5rem 0.5rem 1.5rem; border-left: 2px solid var(--background-modifier-border);' } });
			for (const plugin of essentialPlugins) {
				this.renderPluginStatus(content, plugin, plugins);
			}
		}

		// Nice to Have Plugins Details
		if (niceToHavePlugins.length > 0) {
			const details = containerEl.createEl('details', { attr: { style: 'margin-bottom: 2rem;' } });
			details.createEl('summary', {
				text: `Nice to have plugins (${niceToHavePlugins.length} found)`,
				attr: { style: 'font-weight: bold; cursor: pointer; padding: 0.5rem 0;' }
			});

			const content = details.createDiv({ attr: { style: 'padding: 0.5rem 0.5rem 0.5rem 1.5rem; border-left: 2px solid var(--background-modifier-border);' } });
			for (const plugin of niceToHavePlugins) {
				this.renderPluginStatus(content, plugin, plugins);
			}
		}

		if (essentialPlugins.length === 0 && niceToHavePlugins.length === 0) {
			containerEl.createEl('p', { text: 'No Vault CMS plugins detected.' });
		}

		// Missing plugins section
		const missingPlugins = allPlugins.filter(p =>
			!installedPluginIds.includes(p.id) && !ignoredPlugins.includes(p.id)
		);

		if (missingPlugins.length > 0) {
			const missingEssential = missingPlugins.filter(p => p.category === 'essential');
			const missingNiceToHave = missingPlugins.filter(p => p.category === 'nice-to-have');

			if (missingEssential.length > 0 || missingNiceToHave.length > 0) {
				const details = containerEl.createEl('details', { attr: { style: 'margin-bottom: 1rem;' } });
				details.createEl('summary', {
					text: `Not installed (${missingPlugins.length})`,
					attr: { style: 'font-weight: bold; cursor: pointer; padding: 0.5rem 0; color: var(--text-muted);' }
				});

				const content = details.createDiv({ attr: { style: 'padding: 0.5rem 0.5rem 0.5rem 1.5rem; border-left: 2px solid var(--background-modifier-border);' } });

				for (const plugin of [...missingEssential, ...missingNiceToHave]) {
					const setting = new Setting(content)
						.setName(plugin.name)
						.setDesc(plugin.category === 'essential' ? 'Recommended' : 'Optional');

					setting.nameEl.style.fontSize = '0.9em';
					setting.descEl.style.fontSize = '0.8em';

					if (plugin.source === 'community') {
						setting.addButton(btn => btn
							.setButtonText('Install')
							.setCta()
							.onClick(() => {
								window.open(`obsidian://show-plugin?id=${plugin.id}`);
							}));
					} else if (plugin.source === 'brat' && plugin.repo) {
						setting.addButton(btn => btn
							.setButtonText('GitHub')
							.onClick(() => {
								window.open(`https://github.com/${plugin.repo}`);
							}));
					}
				}
			}
		}

		// --- Merged Editing Toolbar Section ---
		const toolbarDiv = containerEl.createDiv({
			attr: { style: 'margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--background-modifier-border);' }
		});

		new Setting(toolbarDiv)
			.setName('Enable Editing Toolbar')
			.setDesc('Show the visual editing toolbar for formatting text')
			.addToggle(toggle => toggle
				.setValue(this.state.enableEditingToolbar)
				.onChange(value => {
					this.state.enableEditingToolbar = value;
				}));
	}

	private renderPluginStatus(container: HTMLElement, plugin: PluginInfo, plugins: any) {
		const pluginInstance = plugins?.plugins?.[plugin.id];
		const isInstalled = !!pluginInstance;
		const pluginInstanceTyped = pluginInstance as { enabled?: boolean } | undefined;
		const isCurrentlyEnabled = plugins?.enabledPlugins?.has?.(plugin.id) ?? pluginInstanceTyped?.enabled ?? false;

		// Sync state with actual plugin state
		if (isInstalled && isCurrentlyEnabled) {
			if (!this.state.enabledPlugins.includes(plugin.id)) {
				this.state.enabledPlugins.push(plugin.id);
			}
			this.state.disabledPlugins = this.state.disabledPlugins.filter(p => p !== plugin.id);
		} else if (isInstalled && !isCurrentlyEnabled) {
			this.state.enabledPlugins = this.state.enabledPlugins.filter(p => p !== plugin.id);
			if (!this.state.disabledPlugins.includes(plugin.id)) {
				this.state.disabledPlugins.push(plugin.id);
			}
		}

		const setting = new Setting(container)
			.setName(plugin.name)
			.setDesc(isCurrentlyEnabled ? 'Installed and enabled' : 'Installed but disabled');

		setting.nameEl.style.fontSize = '0.9em';
		setting.descEl.style.fontSize = '0.8em';

		const iconContainer = setting.controlEl.createDiv({ cls: 'vault-cms-plugin-status' });
		if (isCurrentlyEnabled) {
			setIcon(iconContainer, 'lucide-check-circle-2');
			setCssProps(iconContainer, { color: 'var(--text-success)' });
		} else {
			setIcon(iconContainer, 'lucide-x-circle');
			setCssProps(iconContainer, { color: 'var(--text-error)' });
		}
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Optional Plugins';
	}

	getDescription(): string {
		return 'Configure optional plugins and detection';
	}
}
