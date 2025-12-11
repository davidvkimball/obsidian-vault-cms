import { App, TFile } from 'obsidian';
import { CommanderConfig } from '../types';

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
		console.log(`CommanderConfig: toggleEditingToolbarCommand called with enable=${enable}`);
		try {
			const plugins = (app as any).plugins;
			if (!plugins) {
				console.warn('CommanderConfig: Plugins API not available');
				return;
			}

			const editingToolbarPlugin = plugins.plugins?.['editing-toolbar'];
			if (!editingToolbarPlugin) {
				console.warn('CommanderConfig: Editing Toolbar plugin not found');
				return;
			}

			console.log(`CommanderConfig: Editing Toolbar plugin found, enabled=${editingToolbarPlugin.enabled}`);
			console.log(`CommanderConfig: Plugin settings available:`, !!editingToolbarPlugin.settings);
			
			if (editingToolbarPlugin.settings) {
				console.log(`CommanderConfig: Current cMenuVisibility:`, editingToolbarPlugin.settings.cMenuVisibility);
			}

			// Enable or disable the plugin itself
			if (enable && !editingToolbarPlugin.enabled) {
				console.log('CommanderConfig: Enabling editing-toolbar plugin');
				await plugins.enablePlugin('editing-toolbar');
			} else if (!enable && editingToolbarPlugin.enabled) {
				console.log('CommanderConfig: Disabling editing-toolbar plugin');
				await plugins.disablePlugin('editing-toolbar');
			}

			// Try to use plugin's saveSettings method first (like Astro Composer)
			if (editingToolbarPlugin.settings && typeof editingToolbarPlugin.saveSettings === 'function') {
				console.log('CommanderConfig: Using plugin.saveSettings() method');
				// Update cMenuVisibility via plugin settings API
				const oldValue = editingToolbarPlugin.settings.cMenuVisibility;
				editingToolbarPlugin.settings.cMenuVisibility = enable;
				console.log(`CommanderConfig: Set cMenuVisibility from ${oldValue} to ${enable}`);
				
				await editingToolbarPlugin.saveSettings();
				console.log('CommanderConfig: Successfully saved editing-toolbar via plugin.saveSettings()');
				
				// Verify the value was saved
				if (editingToolbarPlugin.settings.cMenuVisibility === enable) {
					console.log(`CommanderConfig: Verified cMenuVisibility is now ${editingToolbarPlugin.settings.cMenuVisibility}`);
				} else {
					console.error(`CommanderConfig: ERROR - cMenuVisibility is ${editingToolbarPlugin.settings.cMenuVisibility}, expected ${enable}`);
				}
				
				// If enabling, we need to reload the plugin or trigger a refresh
				// The command execution alone may not be enough - the plugin needs to read the new settings
				if (enable) {
					console.log('CommanderConfig: Waiting for settings to persist...');
					await new Promise(resolve => setTimeout(resolve, 500));
					
					// Try to reload the plugin's settings
					if (typeof editingToolbarPlugin.loadSettings === 'function') {
						console.log('CommanderConfig: Reloading editing toolbar plugin settings');
						await editingToolbarPlugin.loadSettings();
					}
					
					// Also try to trigger a refresh if the plugin has that method
					if (typeof (editingToolbarPlugin as any).refresh === 'function') {
						console.log('CommanderConfig: Refreshing editing toolbar plugin');
						(editingToolbarPlugin as any).refresh();
					}
					
					console.log('CommanderConfig: Executing editing-toolbar:hide-show-menu command');
					try {
						// Try executing the command multiple times to ensure it works
						for (let i = 0; i < 3; i++) {
							const command = (app as any).commands?.commands?.['editing-toolbar:hide-show-menu'];
							console.log(`CommanderConfig: Command found (attempt ${i + 1}):`, !!command);
							if (command) {
								// Use setTimeout to execute asynchronously
								setTimeout(() => {
									(app as any).commands.executeCommandById('editing-toolbar:hide-show-menu');
								}, i * 500);
								console.log(`CommanderConfig: Scheduled hide-show-menu command (attempt ${i + 1})`);
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
				console.log('CommanderConfig: Plugin saveSettings not available, using fallback');
			}

			// Fallback to file method (like Astro Composer fallback)
			await this.toggleEditingToolbarCommandFallback(app, enable);
		} catch (error) {
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
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		// Always read existing data first (file likely exists)
		let existingData: any = {};
		const dataFile = app.vault.getAbstractFileByPath(pluginDataPath);
		
		if (dataFile && dataFile instanceof TFile) {
			try {
				existingData = JSON.parse(await app.vault.read(dataFile));
			} catch (error) {
				console.warn('Failed to parse existing editing-toolbar data.json, starting fresh:', error);
				existingData = {};
			}
		}

		// Set cMenuVisibility based on enable state
		existingData.cMenuVisibility = enable;

		// Always try to modify first (file likely exists)
		if (dataFile && dataFile instanceof TFile) {
			await app.vault.modify(dataFile, JSON.stringify(existingData, null, 2));
			console.log('CommanderConfig: Successfully saved editing-toolbar via file modify');
		} else {
			// File doesn't exist, create it
			// Ensure plugin directory exists
			const pluginDir = `.obsidian/plugins/${pluginId}`;
			const pluginDirFile = app.vault.getAbstractFileByPath(pluginDir);
			if (!pluginDirFile) {
				try {
					await app.vault.createFolder(pluginDir);
				} catch (error: any) {
					// Ignore "already exists" errors
					if (!error.message || (!error.message.includes('already exists') && !error.message.includes('File already exists'))) {
						throw error;
					}
				}
			}
			// Create the file
			try {
				await app.vault.create(pluginDataPath, JSON.stringify(existingData, null, 2));
				console.log('CommanderConfig: Successfully created editing-toolbar data.json');
			} catch (error: any) {
				// If file was created between check and create, try to modify it
				if (error.message && (error.message.includes('already exists') || error.message.includes('File already exists'))) {
					const retryFile = app.vault.getAbstractFileByPath(pluginDataPath);
					if (retryFile && retryFile instanceof TFile) {
						await app.vault.modify(retryFile, JSON.stringify(existingData, null, 2));
						console.log('CommanderConfig: Successfully saved editing-toolbar via retry modify');
					} else {
						// File exists but can't be found - retry with delay
						await new Promise(resolve => setTimeout(resolve, 200));
						const retryFile2 = app.vault.getAbstractFileByPath(pluginDataPath);
						if (retryFile2 && retryFile2 instanceof TFile) {
							await app.vault.modify(retryFile2, JSON.stringify(existingData, null, 2));
							console.log('CommanderConfig: Successfully saved editing-toolbar via delayed retry modify');
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
				await (app as any).commands?.executeCommandById('editing-toolbar:hide-show-menu');
			} catch (cmdError) {
				console.warn('Failed to execute editing toolbar show command:', cmdError);
			}
		}
	}

	async saveConfig(config: CommanderConfig): Promise<void> {
		const pluginId = 'cmdr';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile) {
				const existingData = JSON.parse(await this.app.vault.read(dataFile as any));
				
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
					(cmd: any) => cmd.id !== 'editing-toolbar:hide-show-menu'
				);

				// Add toolbar command if enabled
				if (config.pageHeaderCommands.length > 0) {
					filteredPageHeader.push(toolbarCommand);
				}

				const mergedData = {
					...existingData,
					pageHeader: filteredPageHeader
				};

				await this.app.vault.modify(dataFile as any, JSON.stringify(mergedData, null, 2));
			}
		} catch (error) {
			console.error('Failed to save Commander config:', error);
		}
	}
}

