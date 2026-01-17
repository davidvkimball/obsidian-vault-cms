import { App, TFile } from 'obsidian';

export interface UITweakerCommand {
	id: string;
	icon: string;
	name: string;
	displayName: string;
	mode: string;
	toggleIcon?: string;
	showOnFileTypes?: string;
}

export interface UITweakerConfig {
	tabBarCommands?: UITweakerCommand[];
}

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

	async saveConfig(enableMdxSupport: boolean): Promise<void> {
		const pluginId = 'ui-tweaker';
		
		try {
			// Try to use plugin's live settings if available
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const uiTweakerPlugin = plugins?.plugins?.[pluginId];
			
			if (uiTweakerPlugin && uiTweakerPlugin.settings) {
				console.debug('UITweakerConfig: Using plugin.settings API');
				const settings = uiTweakerPlugin.settings;
				
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
			await this.saveConfigFallback(enableMdxSupport);
		} catch (error: unknown) {
			console.error('Failed to save UI Tweaker config:', error);
			// Try fallback anyway
			await this.saveConfigFallback(enableMdxSupport);
		}
	}

	private forceMdxUpdate(settings: UITweakerConfig, enableMdxSupport: boolean): void {
		const mdxFileTypes = enableMdxSupport ? 'md,mdx' : 'md';
		
		if (!settings.tabBarCommands || !Array.isArray(settings.tabBarCommands)) {
			settings.tabBarCommands = [];
		}

		const tabBarCommands = settings.tabBarCommands as unknown as Array<Record<string, unknown>>;
		const toolbarCommandIndex = tabBarCommands.findIndex(cmd => cmd.id === 'editing-toolbar:hide-show-menu');

		if (toolbarCommandIndex !== -1) {
			// ONLY update showOnFileTypes, leave everything else alone!
			tabBarCommands[toolbarCommandIndex] = {
				...tabBarCommands[toolbarCommandIndex],
				"showOnFileTypes": mdxFileTypes
			};
			console.debug(`UITweakerConfig: Updated existing toolbar command showOnFileTypes to ${mdxFileTypes}`);
		} else {
			// Only add if missing, using the user's preferred defaults
			tabBarCommands.push({
				"id": "editing-toolbar:hide-show-menu",
				"icon": "lucide-panel-top-open",
				"name": "Toggle editing toolbar",
				"displayName": "Editing Toolbar: Hide/Show ",
				"mode": "desktop",
				"toggleIcon": "lucide-panel-top-close",
				"showOnFileTypes": mdxFileTypes
			});
			console.debug(`UITweakerConfig: Added missing toolbar command with showOnFileTypes=${mdxFileTypes}`);
		}
	}

	private async saveConfigFallback(enableMdxSupport: boolean): Promise<void> {
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

		// Force the MDX update on the merged data
		this.forceMdxUpdate(existingData as unknown as UITweakerConfig, enableMdxSupport);

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
		const content = JSON.stringify(existingData, null, 2);
		if (dataFile instanceof TFile) {
			await this.app.vault.modify(dataFile, content);
		} else {
			await this.app.vault.create(pluginDataPath, content);
		}
		console.debug('UITweakerConfig: Successfully saved ui-tweaker config via fallback');
	}
}
