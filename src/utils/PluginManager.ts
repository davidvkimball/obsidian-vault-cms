import { App } from 'obsidian';

export class PluginManager {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async enablePlugin(pluginId: string): Promise<void> {
		const plugins = (this.app as any).plugins;
		if (!plugins) {
			return;
		}

		const plugin = plugins.plugins[pluginId];
		if (plugin && !plugin.enabled) {
			await plugins.enablePlugin(pluginId);
		}
	}

	async disablePlugin(pluginId: string): Promise<void> {
		const plugins = (this.app as any).plugins;
		if (!plugins) {
			return;
		}

		const plugin = plugins.plugins[pluginId];
		if (plugin && plugin.enabled) {
			await plugins.disablePlugin(pluginId);
		}
	}

	async setPluginStates(enabled: string[], disabled: string[]): Promise<void> {
		// Disable plugins first
		for (const pluginId of disabled) {
			await this.disablePlugin(pluginId);
		}

		// Then enable plugins
		for (const pluginId of enabled) {
			await this.enablePlugin(pluginId);
		}
	}

	getPresetPlugins(preset: 'default' | 'minimal' | 'custom'): { enabled: string[]; disabled: string[] } {
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

		const minimalPlugins = [
			'obsidian-minimal-settings',
			'obsidian-hider',
			'disable-tabs'
		];

		if (preset === 'default') {
			return {
				enabled: allPlugins.filter(p => !minimalPlugins.includes(p)),
				disabled: minimalPlugins
			};
		} else if (preset === 'minimal') {
			return {
				enabled: minimalPlugins,
				disabled: allPlugins.filter(p => !minimalPlugins.includes(p))
			};
		} else {
			// Custom - return all as available
			return {
				enabled: [],
				disabled: []
			};
		}
	}
}

