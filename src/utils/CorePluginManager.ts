import { App } from 'obsidian';

export class CorePluginManager {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async setCorePluginState(pluginId: string, enabled: boolean): Promise<void> {
		const plugins = (this.app as any).internalPlugins;
		if (!plugins) {
			return;
		}

		const plugin = plugins.plugins[pluginId];
		if (plugin) {
			await plugins.enablePlugin(pluginId, enabled);
		}
	}

	async configureCorePlugins(preset: 'vanilla' | 'opinionated' | 'custom'): Promise<void> {
		// Core plugins are generally enabled by default for both presets
		// This can be extended if specific core plugin configurations are needed
	}
}

