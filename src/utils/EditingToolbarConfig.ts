import { App, TFile } from 'obsidian';

type EditingToolbarPlugin = {
	enabled?: boolean;
	settings?: {
		cMenuVisibility?: boolean;
		[key: string]: unknown;
	};
	saveSettings?: () => Promise<void>;
	loadSettings?: () => Promise<void>;
	refresh?: () => void;
};

type PluginsAPI = {
	plugins?: Record<string, EditingToolbarPlugin>;
	enablePlugin?: (id: string) => Promise<void>;
	disablePlugin?: (id: string) => Promise<void>;
};

export class EditingToolbarConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Enable/disable the editing toolbar visibility
	 */
	async toggleVisibility(app: App, enable: boolean): Promise<void> {
		console.debug(`EditingToolbarConfig: toggleVisibility called with enable=${enable}`);
		try {
			const plugins = (app as { plugins?: PluginsAPI }).plugins;
			if (!plugins) {
				console.warn('EditingToolbarConfig: Plugins API not available');
				return;
			}

			const editingToolbarPlugin = plugins.plugins?.['editing-toolbar'];
			if (!editingToolbarPlugin) {
				console.warn('EditingToolbarConfig: Editing Toolbar plugin not found');
				return;
			}

			console.debug(`EditingToolbarConfig: Editing Toolbar plugin found, enabled=${editingToolbarPlugin.enabled}`);
			console.debug(`EditingToolbarConfig: Plugin settings available:`, !!editingToolbarPlugin.settings);

			if (editingToolbarPlugin.settings) {
				console.debug(`EditingToolbarConfig: Current cMenuVisibility:`, editingToolbarPlugin.settings.cMenuVisibility);
			}

			// Try to use plugin's saveSettings method first
			if (editingToolbarPlugin.settings && typeof editingToolbarPlugin.saveSettings === 'function') {
				console.debug('EditingToolbarConfig: Using plugin.saveSettings() method');
				const oldValue = editingToolbarPlugin.settings.cMenuVisibility;
				editingToolbarPlugin.settings.cMenuVisibility = enable;
				console.debug(`EditingToolbarConfig: Set cMenuVisibility from ${oldValue} to ${enable}`);

				await editingToolbarPlugin.saveSettings();
				console.debug('EditingToolbarConfig: Successfully saved editing-toolbar via plugin.saveSettings()');

				// Dispatch the event that editing-toolbar listens for to trigger a rebuild
				console.debug('EditingToolbarConfig: Dispatching editingToolbar-NewCommand event');
				window.dispatchEvent(new Event("editingToolbar-NewCommand"));

				if (enable) {
					console.debug('EditingToolbarConfig: Waiting for settings to persist...');
					await new Promise(resolve => setTimeout(resolve, 500));

					if (typeof editingToolbarPlugin.loadSettings === 'function') {
						console.debug('EditingToolbarConfig: Reloading editing toolbar plugin settings');
						await editingToolbarPlugin.loadSettings();
					}

					if (typeof editingToolbarPlugin.refresh === 'function') {
						console.debug('EditingToolbarConfig: Refreshing editing toolbar plugin');
						editingToolbarPlugin.refresh();
					}
				}
				return;
			} else {
				console.debug('EditingToolbarConfig: Plugin saveSettings not available, using fallback');
			}

			// Fallback to file method
			await this.toggleVisibilityFallback(app, enable);
		} catch (error: unknown) {
			console.error('EditingToolbarConfig: Failed to toggle editing toolbar plugin:', error);
			try {
				await this.toggleVisibilityFallback(app, enable);
			} catch (fallbackError) {
				console.error('EditingToolbarConfig: Failed to toggle editing toolbar via fallback:', fallbackError);
			}
		}
	}

	private async toggleVisibilityFallback(app: App, enable: boolean): Promise<void> {
		const pluginId = 'editing-toolbar';
		const configDir = app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;

		let existingData: Record<string, unknown> = {};
		const dataFile = app.vault.getAbstractFileByPath(pluginDataPath);

		if (dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await app.vault.read(dataFile)) as Record<string, unknown>;
			} catch (error: unknown) {
				console.warn('Failed to parse existing editing-toolbar data.json, starting fresh:', error);
				existingData = {};
			}
		}

		existingData.cMenuVisibility = enable;

		if (dataFile instanceof TFile) {
			await app.vault.modify(dataFile, JSON.stringify(existingData, null, 2));
			console.debug('EditingToolbarConfig: Successfully saved editing-toolbar via file modify');
		} else {
			const pluginDir = `${configDir}/plugins/${pluginId}`;
			const pluginDirFile = app.vault.getAbstractFileByPath(pluginDir);
			if (!pluginDirFile) {
				try {
					await app.vault.createFolder(pluginDir);
				} catch (error: unknown) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					if (errorMessage && !errorMessage.includes('already exists') && !errorMessage.includes('File already exists') && !errorMessage.includes('Folder already exists')) {
						throw error;
					}
				}
			}
			try {
				await app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
				console.debug('EditingToolbarConfig: Successfully created editing-toolbar data.json');
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage && (errorMessage.includes('already exists') || errorMessage.includes('File already exists'))) {
					const retryFile = app.vault.getAbstractFileByPath(pluginDataPath);
					if (retryFile instanceof TFile) {
						await app.vault.modify(retryFile, JSON.stringify(existingData, null, 2));
						console.debug('EditingToolbarConfig: Successfully saved editing-toolbar via retry modify');
					} else {
						await new Promise(resolve => setTimeout(resolve, 200));
						const retryFile2 = app.vault.getAbstractFileByPath(pluginDataPath);
						if (retryFile2 instanceof TFile) {
							await app.vault.modify(retryFile2, JSON.stringify(existingData, null, 2));
							console.debug('EditingToolbarConfig: Successfully saved editing-toolbar via delayed retry modify');
						} else {
							throw error;
						}
					}
				} else {
					throw error;
				}
			}
		}
	}

	/**
	 * Get the current visibility of the editing toolbar
	 */
	async getVisibility(app: App): Promise<boolean | undefined> {
		try {
			const plugins = (app as { plugins?: PluginsAPI }).plugins;
			const editingToolbarPlugin = plugins?.plugins?.['editing-toolbar'];

			if (editingToolbarPlugin?.settings) {
				return editingToolbarPlugin.settings.cMenuVisibility;
			}

			// Fallback to file method
			const configDir = app.vault.configDir;
			const pluginDataPath = `${configDir}/plugins/editing-toolbar/data.json`;
			const dataFile = app.vault.getAbstractFileByPath(pluginDataPath);

			if (dataFile instanceof TFile) {
				const existingData = JSON.parse(await app.vault.read(dataFile)) as { cMenuVisibility?: boolean };
				return existingData.cMenuVisibility;
			}
		} catch (error) {
			console.warn('EditingToolbarConfig: Failed to get editing toolbar visibility:', error);
		}
		return undefined;
	}
}
