import { App, TFile } from 'obsidian';
import { CommanderConfig } from '../types';

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

type CommandsAPI = {
	commands?: Record<string, () => void>;
	executeCommandById?: (id: string) => Promise<void>;
};

export class CommanderConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	generateCommanderConfig(enableWYSIWYG: boolean): CommanderConfig {
		// WYSIWYG is now handled by toggling the command directly, not via commander
		// This config is kept for compatibility but won't add commander buttons
		const config: CommanderConfig = {
			pageHeaderCommands: []
		};

		return config;
	}

	/**
	 * Enable/disable the editing toolbar plugin (not via commander button)
	 * When enabled, the toolbar will be available via its own "Show/hide toolbar" command
	 */
	async toggleEditingToolbarCommand(app: App, enable: boolean): Promise<void> {
		console.debug(`CommanderConfig: toggleEditingToolbarCommand called with enable=${enable}`);
		try {
			const plugins = (app as { plugins?: PluginsAPI }).plugins;
			if (!plugins) {
				console.warn('CommanderConfig: Plugins API not available');
				return;
			}

			const editingToolbarPlugin = plugins.plugins?.['editing-toolbar'];
			if (!editingToolbarPlugin) {
				console.warn('CommanderConfig: Editing Toolbar plugin not found');
				return;
			}

			console.debug(`CommanderConfig: Editing Toolbar plugin found, enabled=${editingToolbarPlugin.enabled}`);
			console.debug(`CommanderConfig: Plugin settings available:`, !!editingToolbarPlugin.settings);
			
			if (editingToolbarPlugin.settings) {
				console.debug(`CommanderConfig: Current cMenuVisibility:`, editingToolbarPlugin.settings.cMenuVisibility);
			}

			// Enable or disable the plugin itself
			if (enable && !editingToolbarPlugin.enabled) {
				console.debug('CommanderConfig: Enabling editing-toolbar plugin');
				await plugins.enablePlugin?.('editing-toolbar');
			} else if (!enable && editingToolbarPlugin.enabled) {
				console.debug('CommanderConfig: Disabling editing-toolbar plugin');
				await plugins.disablePlugin?.('editing-toolbar');
			}

			// Try to use plugin's saveSettings method first (like Astro Composer)
			if (editingToolbarPlugin.settings && typeof editingToolbarPlugin.saveSettings === 'function') {
				console.debug('CommanderConfig: Using plugin.saveSettings() method');
				// Update cMenuVisibility via plugin settings API
				const oldValue = editingToolbarPlugin.settings.cMenuVisibility;
				editingToolbarPlugin.settings.cMenuVisibility = enable;
				console.debug(`CommanderConfig: Set cMenuVisibility from ${oldValue} to ${enable}`);
				
				await editingToolbarPlugin.saveSettings();
				console.debug('CommanderConfig: Successfully saved editing-toolbar via plugin.saveSettings()');
				
				// Verify the value was saved
				if (editingToolbarPlugin.settings.cMenuVisibility === enable) {
					console.debug(`CommanderConfig: Verified cMenuVisibility is now ${editingToolbarPlugin.settings.cMenuVisibility}`);
				} else {
					console.error(`CommanderConfig: ERROR - cMenuVisibility is ${editingToolbarPlugin.settings.cMenuVisibility}, expected ${enable}`);
				}
				
				// If enabling, we need to reload the plugin or trigger a refresh
				// The command execution alone may not be enough - the plugin needs to read the new settings
				if (enable) {
					console.debug('CommanderConfig: Waiting for settings to persist...');
					await new Promise(resolve => setTimeout(resolve, 500));
					
					// Try to reload the plugin's settings
					if (typeof editingToolbarPlugin.loadSettings === 'function') {
						console.debug('CommanderConfig: Reloading editing toolbar plugin settings');
						await editingToolbarPlugin.loadSettings();
					}
					
					// Also try to trigger a refresh if the plugin has that method
					if (typeof editingToolbarPlugin.refresh === 'function') {
						console.debug('CommanderConfig: Refreshing editing toolbar plugin');
						editingToolbarPlugin.refresh();
					}
					
					console.debug('CommanderConfig: Executing editing-toolbar:hide-show-menu command');
					try {
						// Try executing the command multiple times to ensure it works
						for (let i = 0; i < 3; i++) {
							const commands = (app as { commands?: CommandsAPI }).commands;
							const command = commands?.commands?.['editing-toolbar:hide-show-menu'];
							console.debug(`CommanderConfig: Command found (attempt ${i + 1}):`, !!command);
							if (command) {
								// Use setTimeout to execute asynchronously
								setTimeout(() => {
									const commands = (app as { commands?: { executeCommandById?: (id: string) => void } }).commands;
									commands?.executeCommandById?.('editing-toolbar:hide-show-menu');
								}, i * 500);
								console.debug(`CommanderConfig: Scheduled hide-show-menu command (attempt ${i + 1})`);
							} else {
								console.warn(`CommanderConfig: Command editing-toolbar:hide-show-menu not found (attempt ${i + 1})`);
							}
						}
					} catch (cmdError) {
						console.error('CommanderConfig: Failed to execute editing toolbar show command:', cmdError);
					}
				}
				return;
			} else {
				console.debug('CommanderConfig: Plugin saveSettings not available, using fallback');
			}

			// Fallback to file method (like Astro Composer fallback)
			await this.toggleEditingToolbarCommandFallback(app, enable);
		} catch (error: unknown) {
			console.error('CommanderConfig: Failed to toggle editing toolbar plugin:', error);
			// Try fallback even if plugin method fails
			try {
				await this.toggleEditingToolbarCommandFallback(app, enable);
			} catch (fallbackError) {
				console.error('CommanderConfig: Failed to toggle editing toolbar via fallback:', fallbackError);
			}
		}
	}

	private async toggleEditingToolbarCommandFallback(app: App, enable: boolean): Promise<void> {
		const pluginId = 'editing-toolbar';
		const configDir = app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		// Always read existing data first (file likely exists)
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

		// Set cMenuVisibility based on enable state
		existingData.cMenuVisibility = enable;

		// Always try to modify first (file likely exists)
		if (dataFile instanceof TFile) {
			await app.vault.modify(dataFile, JSON.stringify(existingData, null, 2));
			console.debug('CommanderConfig: Successfully saved editing-toolbar via file modify');
		} else {
			// File doesn't exist, create it
			// Ensure plugin directory exists
			const pluginDir = `${configDir}/plugins/${pluginId}`;
			const pluginDirFile = app.vault.getAbstractFileByPath(pluginDir);
			if (!pluginDirFile) {
				try {
					await app.vault.createFolder(pluginDir);
				} catch (error: unknown) {
					// Ignore "already exists" or "Folder already exists" errors
					const errorMessage = error instanceof Error ? error.message : String(error);
					if (errorMessage && !errorMessage.includes('already exists') && !errorMessage.includes('File already exists') && !errorMessage.includes('Folder already exists')) {
						throw error;
					}
					// Folder exists, continue
				}
			}
			// Create the file
			try {
				await app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
				console.debug('CommanderConfig: Successfully created editing-toolbar data.json');
			} catch (error: unknown) {
				// If file was created between check and create, try to modify it
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage && (errorMessage.includes('already exists') || errorMessage.includes('File already exists'))) {
					const retryFile = app.vault.getAbstractFileByPath(pluginDataPath);
					if (retryFile instanceof TFile) {
						await app.vault.modify(retryFile, JSON.stringify(existingData, null, 2));
						console.debug('CommanderConfig: Successfully saved editing-toolbar via retry modify');
					} else {
						// File exists but can't be found - retry with delay
						await new Promise(resolve => setTimeout(resolve, 200));
						const retryFile2 = app.vault.getAbstractFileByPath(pluginDataPath);
						if (retryFile2 instanceof TFile) {
							await app.vault.modify(retryFile2, JSON.stringify(existingData, null, 2));
							console.debug('CommanderConfig: Successfully saved editing-toolbar via delayed retry modify');
						} else {
							throw error;
						}
					}
				} else {
					throw error;
				}
			}
		}

		// If enabling, execute the hide/show command to ensure toolbar is visible
		if (enable) {
			try {
				const commands = (app as { commands?: CommandsAPI }).commands;
				await commands?.executeCommandById?.('editing-toolbar:hide-show-menu');
			} catch (cmdError) {
				console.warn('Failed to execute editing toolbar show command:', cmdError);
			}
		}
	}

	async saveConfig(config: CommanderConfig): Promise<void> {
		const pluginId = 'cmdr';
		const configDir = this.app.vault.configDir;
		const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;
		
		try {
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile instanceof TFile) {
				const existingData = JSON.parse(await this.app.vault.read(dataFile)) as { pageHeader?: Array<{ id?: string; [key: string]: unknown }>; [key: string]: unknown };
				
				// Merge pageHeader commands
				const existingPageHeader = existingData.pageHeader || [];
				const toolbarCommand = {
					id: 'editing-toolbar:hide-show-menu',
					icon: 'lucide-chevrons-up-down',
					name: 'Toggle editing toolbar',
					mode: 'desktop'
				};

				// Remove existing toolbar command if present
				const filteredPageHeader = existingPageHeader.filter(
					(cmd: { id?: string }) => cmd.id !== 'editing-toolbar:hide-show-menu'
				);

				// Add toolbar command if enabled
				if (config.pageHeaderCommands.length > 0) {
					filteredPageHeader.push(toolbarCommand);
				}

				const mergedData = {
					...existingData,
					pageHeader: filteredPageHeader
				};

				await this.app.vault.modify(dataFile, JSON.stringify(mergedData, null, 2));
			}
		} catch (error: unknown) {
			console.error('Failed to save Commander config:', error);
		}
	}
}

