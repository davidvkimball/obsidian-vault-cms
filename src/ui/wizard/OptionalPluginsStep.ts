import { App, Setting } from 'obsidian';
import { setIcon } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { PluginManager } from '../../utils/PluginManager';

interface PluginInfo {
	id: string;
	name: string;
	category: 'essential' | 'nice-to-have';
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

		containerEl.createEl('h2', { text: 'Plugin Configuration' });
		containerEl.createEl('p', { 
			text: 'Review and configure your installed plugins. Essential plugins are recommended for the core Vault CMS experience.' 
		});

		// Define all plugins with their categories
		const allPlugins: PluginInfo[] = [
			// Essential plugins
			{ id: 'astro-composer', name: 'Astro Composer', category: 'essential' },
			{ id: 'bases-cms', name: 'Bases CMS', category: 'essential' },
			{ id: 'cmdr', name: 'Commander', category: 'essential' },
			{ id: 'new-tab-default-page', name: 'Default New Tab Page', category: 'essential' },
			{ id: 'editing-toolbar', name: 'Editing Toolbar', category: 'essential' },
			{ id: 'homepage', name: 'Homepage', category: 'essential' },
			{ id: 'obsidian-paste-image-rename', name: 'Paste Image Rename', category: 'essential' },
			{ id: 'property-over-file-name', name: 'Property Over File Name', category: 'essential' },
			{ id: 'seo', name: 'SEO', category: 'essential' },
			{ id: 'simple-focus', name: 'Simple Focus', category: 'essential' },
			{ id: 'statusbar-organizer', name: 'Status Bar Organizer', category: 'essential' },
			{ id: 'zenmode', name: 'Zen Mode', category: 'essential' },
			// Nice to have plugins
			{ id: 'iconic', name: 'Iconic', category: 'nice-to-have' },
			{ id: 'settings-search', name: 'Settings Search', category: 'nice-to-have' },
			{ id: 'simple-banner', name: 'Simple Banner', category: 'nice-to-have' },
			{ id: 'tag-wrangler', name: 'Tag Wrangler', category: 'nice-to-have' },
			{ id: 'insert-unsplash-image', name: 'Image Inserter', category: 'nice-to-have' },
			{ id: 'paste-image-into-property', name: 'Paste Image Into Property', category: 'nice-to-have' }
		];

		// Get installed plugins
		const plugins = (this.app as any).plugins;
		const installedPluginIds = plugins?.plugins ? Object.keys(plugins.plugins) : [];

		// Filter to only show installed plugins (excluding ignored ones)
		const ignoredPlugins = [
			'obsidian42-brat',
			'astro-modular-settings',
			'alias-file-name-history',
			'folder-notes',
			'disable-tabs',
			'vault-cms' // Don't show Vault CMS plugin itself
		];

		const essentialPlugins = allPlugins.filter(p => 
			p.category === 'essential' && 
			installedPluginIds.includes(p.id) && 
			!ignoredPlugins.includes(p.id)
		);
		const niceToHavePlugins = allPlugins.filter(p => 
			p.category === 'nice-to-have' && 
			installedPluginIds.includes(p.id) && 
			!ignoredPlugins.includes(p.id)
		);

		// Essential plugins section
		if (essentialPlugins.length > 0) {
			containerEl.createEl('h3', { text: 'Essential Plugins', cls: 'vault-cms-section-header' });
			containerEl.createEl('p', { 
				text: 'These plugins are recommended for the core Vault CMS experience.',
				cls: 'vault-cms-section-desc'
			});

			for (const plugin of essentialPlugins) {
				const pluginInstance = plugins?.plugins?.[plugin.id];
				const isInstalled = !!pluginInstance;
				// Use enabledPlugins Set to check if plugin is enabled (more reliable than plugin.enabled)
				const isCurrentlyEnabled = plugins?.enabledPlugins?.has?.(plugin.id) ?? false;
				
				console.log(`Plugin ${plugin.id}: installed=${isInstalled}, enabled=${isCurrentlyEnabled}`);
				
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
				
				const setting = new Setting(containerEl)
					.setName(plugin.name)
					.setDesc(isInstalled ? 
						(isCurrentlyEnabled ? 'Installed and enabled' : 'Installed but disabled') : 
						'Not installed');
				
				// Add icon instead of toggle
				const iconContainer = setting.controlEl.createDiv({ cls: 'vault-cms-plugin-status' });
				if (isInstalled && isCurrentlyEnabled) {
					setIcon(iconContainer, 'lucide-check-circle-2');
					iconContainer.style.color = 'var(--text-success)';
				} else {
					setIcon(iconContainer, 'lucide-x-circle');
					iconContainer.style.color = 'var(--text-error)';
				}
			}
		}

		// Nice to have plugins section
		if (niceToHavePlugins.length > 0) {
			containerEl.createEl('h3', { text: 'Nice to Have Plugins', cls: 'vault-cms-section-header' });
			containerEl.createEl('p', { 
				text: 'These plugins can be helpful depending on your theme\'s capabilities and workflow needs.',
				cls: 'vault-cms-section-desc'
			});

			for (const plugin of niceToHavePlugins) {
				const pluginInstance = plugins?.plugins?.[plugin.id];
				const isInstalled = !!pluginInstance;
				// Use enabledPlugins Set to check if plugin is enabled (more reliable than plugin.enabled)
				const isCurrentlyEnabled = plugins?.enabledPlugins?.has?.(plugin.id) ?? false;
				
				console.log(`Plugin ${plugin.id}: installed=${isInstalled}, enabled=${isCurrentlyEnabled}`);
				
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
				
				const setting = new Setting(containerEl)
					.setName(plugin.name)
					.setDesc(isInstalled ? 
						(isCurrentlyEnabled ? 'Installed and enabled' : 'Installed but disabled') : 
						'Not installed');
				
				// Add icon instead of toggle
				const iconContainer = setting.controlEl.createDiv({ cls: 'vault-cms-plugin-status' });
				if (isInstalled && isCurrentlyEnabled) {
					setIcon(iconContainer, 'lucide-check-circle-2');
					iconContainer.style.color = 'var(--text-success)';
				} else {
					setIcon(iconContainer, 'lucide-x-circle');
					iconContainer.style.color = 'var(--text-error)';
				}
			}
		}

		// If no plugins found
		if (essentialPlugins.length === 0 && niceToHavePlugins.length === 0) {
			containerEl.createEl('p', { 
				text: 'No Vault CMS plugins detected. Make sure you have installed the recommended plugins.' 
			});
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

