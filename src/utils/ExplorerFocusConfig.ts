import { App, TFile } from 'obsidian';
import { ExplorerFocusConfig } from '../types';

type PluginWithSettings = {
	settings?: ExplorerFocusConfig;
	saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
	plugins?: Record<string, PluginWithSettings>;
};

export class ExplorerFocusConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async saveConfig(config: ExplorerFocusConfig): Promise<void> {
		const pluginId = 'explorer-focus';
		
		try {
			// Try to use plugin's live settings if available
			const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
			const explorerFocusPlugin = plugins?.plugins?.[pluginId];
			
			if (explorerFocusPlugin && explorerFocusPlugin.settings) {
				console.debug('ExplorerFocusConfig: Using plugin.settings API');
				const settings = explorerFocusPlugin.settings;
				
				// Apply config to live settings
				for (const [key, value] of Object.entries(config)) {
					(settings as Record<string, unknown>)[key] = value;
				}
				
				// Save settings via plugin API
				if (typeof explorerFocusPlugin.saveSettings === 'function') {
					await explorerFocusPlugin.saveSettings();
					console.debug('ExplorerFocusConfig: Successfully saved via plugin.saveSettings()');
					return;
				}
			}

			// Fallback to file method if plugin not available
			console.debug('ExplorerFocusConfig: Plugin API not available, using fallback file method');
			await this.saveConfigFallback(config);
		} catch (error: unknown) {
			console.error('Failed to save Explorer Focus config:', error);
			// Try fallback anyway
			await this.saveConfigFallback(config);
		}
	}

	async loadConfig(): Promise<ExplorerFocusConfig | null> {
		const pluginId = 'explorer-focus';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		try {
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile instanceof TFile) {
				const content = await this.app.vault.read(dataFile);
				return JSON.parse(content) as ExplorerFocusConfig;
			}
		} catch (error: unknown) {
			console.warn('Failed to load Explorer Focus config:', error);
		}
		return null;
	}

	private async saveConfigFallback(config: ExplorerFocusConfig): Promise<void> {
		const pluginId = 'explorer-focus';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		let existingData: Record<string, unknown> = {};
		const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
		
		if (dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
			} catch (error: unknown) {
				console.warn('Failed to parse existing explorer-focus data.json:', error);
			}
		}

		// Merge with our config
		const mergedData = {
			...existingData,
			...config
		};

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
		console.debug('ExplorerFocusConfig: Successfully saved explorer-focus config via fallback');
	}
}
