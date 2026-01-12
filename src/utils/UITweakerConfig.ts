import { App, TFile } from 'obsidian';
import { UITweakerConfig } from '../types';

type PluginWithSettings = {
	settings?: UITweakerConfig;
	saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
	plugins?: Record<string, PluginWithSettings>;
};

export class UITweakerConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(config: UITweakerConfig, enableMdxSupport: boolean): Promise<void> {
		const pluginId = 'ui-tweaker';
		
		try {
			// Try to use plugin's live settings if available
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const uiTweakerPlugin = plugins?.plugins?.[pluginId];
			
			if (uiTweakerPlugin && uiTweakerPlugin.settings) {
				console.debug('UITweakerConfig: Using plugin.settings API');
				const settings = uiTweakerPlugin.settings;
				
				// Apply our opinionated config to live settings
				for (const [key, value] of Object.entries(config)) {
					if (key !== 'tabBarCommands') {
						(settings as any)[key] = value;
					}
				}
				
				// Special handling for tabBarCommands
				settings.tabBarCommands = this.mergeTabBarCommands(
					(settings.tabBarCommands as Array<Record<string, unknown>>) || [],
					(config.tabBarCommands as Array<Record<string, unknown>>) || []
				) as UITweakerConfig['tabBarCommands'];
				
				// Force the MDX update
				this.forceMdxUpdate(settings, enableMdxSupport);
				
				// Save settings via plugin API
				if (typeof uiTweakerPlugin.saveSettings === 'function') {
					await uiTweakerPlugin.saveSettings();
					console.debug('UITweakerConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}

			// Fallback to file method if plugin not available
			console.debug('UITweakerConfig: Plugin API not available, using fallback file method');
			await this.saveConfigFallback(config, enableMdxSupport);
		} catch (error: unknown) {
			console.error('Failed to save UI Tweaker config:', error);
			// Try fallback anyway
			await this.saveConfigFallback(config, enableMdxSupport);
		}
	}

	private forceMdxUpdate(settings: UITweakerConfig, enableMdxSupport: boolean): void {
		const mdxFileTypes = enableMdxSupport ? 'md,mdx' : 'md';
		
		if (!settings.tabBarCommands || !Array.isArray(settings.tabBarCommands)) {
			settings.tabBarCommands = [];
		}

		const tabBarCommands = settings.tabBarCommands as Array<Record<string, unknown>>;
		const toolbarCommandIndex = tabBarCommands.findIndex(cmd => cmd.id === 'editing-toolbar:hide-show-menu');

		if (toolbarCommandIndex !== -1) {
			tabBarCommands[toolbarCommandIndex] = {
				...tabBarCommands[toolbarCommandIndex],
				"id": "editing-toolbar:hide-show-menu",
				"icon": "lucide-chevron-down",
				"name": "Toggle editing toolbar",
				"displayName": "Editing Toolbar: Hide/Show ",
				"mode": "any",
				"toggleIcon": "lucide-chevron-up",
				"showOnFileTypes": mdxFileTypes
			};
			console.debug(`UITweakerConfig: Forced update on existing toolbar command showOnFileTypes to ${mdxFileTypes}`);
		} else {
			tabBarCommands.push({
				"id": "editing-toolbar:hide-show-menu",
				"icon": "lucide-chevron-down",
				"name": "Toggle editing toolbar",
				"displayName": "Editing Toolbar: Hide/Show ",
				"mode": "any",
				"toggleIcon": "lucide-chevron-up",
				"showOnFileTypes": mdxFileTypes
			});
			console.debug(`UITweakerConfig: Added missing toolbar command with showOnFileTypes=${mdxFileTypes}`);
		}
	}

	private async saveConfigFallback(config: UITweakerConfig, enableMdxSupport: boolean): Promise<void> {
		const pluginId = 'ui-tweaker';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		let existingData: Record<string, unknown> = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		if (dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
			} catch (error: unknown) {
				console.warn('Failed to parse existing ui-tweaker data.json:', error);
			}
		}

		// Merge with our opinionated config
		const mergedData = {
			...existingData,
			...config,
			tabBarCommands: this.mergeTabBarCommands(
				(existingData.tabBarCommands as Array<Record<string, unknown>>) || [],
				(config.tabBarCommands as Array<Record<string, unknown>>) || []
			)
		};

		// Force the MDX update on the merged data
		this.forceMdxUpdate(mergedData as unknown as UITweakerConfig, enableMdxSupport);

		// Ensure plugin directory exists
		const pluginDir = `${configDir}/plugins/${pluginId}`;
		const pluginDirFile = this.app.vault.getAbstractFileByPath(pluginDir);
		if (!pluginDirFile) {
			try {
				await this.app.vault.createFolder(pluginDir);
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage && !errorMessage.includes('already exists') && !errorMessage.includes('File already exists') && !errorMessage.includes('Folder already exists')) {
					throw error;
				}
			}
		}

		// Save to file
		const content = JSON.stringify(mergedData, null, 2);
		if (dataFile instanceof TFile) {
			await this.app.vault.modify(dataFile, content);
		} else {
			await this.app.vault.create(pluginDataPath, content);
		}
		console.debug('UITweakerConfig: Successfully saved ui-tweaker config via fallback');
	}

	private mergeTabBarCommands(existing: Array<Record<string, unknown>>, opinionated: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
		const merged = [...existing];
		
		for (const opCmd of opinionated) {
			const existingIndex = merged.findIndex(cmd => cmd.id === opCmd.id);
			if (existingIndex >= 0) {
				merged[existingIndex] = { ...merged[existingIndex], ...opCmd };
			} else {
				merged.push(opCmd);
			}
		}
		
		return merged;
	}
}
