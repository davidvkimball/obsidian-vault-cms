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

	getPresetPlugins(preset: 'vanilla' | 'opinionated' | 'custom'): { enabled: string[]; disabled: string[] } {
		// Core plugins that should always be enabled (not optional)
		const corePlugins = [
			'astro-composer',
			'bases-cms',
			'homepage',
			'new-tab-default-page',
			'seo',
			'property-over-file-name',
			'settings-search',
			'statusbar-organizer',
			'zenmode',
			'cmdr',
			'editing-toolbar',
			'simple-focus',
			'tag-wrangler'
		];

		// Optional plugins that can be enabled/disabled
		const optionalPlugins = [
			'insert-unsplash-image',
			'custom-save',
			'title-only-tab',
			'obsidian-paste-image-rename',
			'obsidian42-brat',
			'obsidian-hider',
			'disable-tabs',
			'obsidian-style-settings',
			'mdx-as-md-obsidian'
		];

		// Opinionated-specific plugins
		const opinionatedPlugins = [
			'obsidian-oxygen',
			'obsidian-style-settings'
		];

		if (preset === 'vanilla') {
			return {
				enabled: [...corePlugins, ...optionalPlugins.filter(p => !opinionatedPlugins.includes(p))],
				disabled: opinionatedPlugins
			};
		} else if (preset === 'opinionated') {
			return {
				enabled: [...corePlugins, ...optionalPlugins],
				disabled: []
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

