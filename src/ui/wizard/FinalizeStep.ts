import { App, Notice, WorkspaceLeaf } from 'obsidian';

import { ConfigFlushService } from '../../utils/ConfigFlushService';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { PluginManager } from '../../utils/PluginManager';
import { BasesCMSConfigurator } from '../../utils/BasesCMSConfig';

export class FinalizeStep extends BaseWizardStep {
	private pluginManager: PluginManager;
	private basesCMSConfigurator: BasesCMSConfigurator;
	private configFlushService: ConfigFlushService;
	private applied: boolean = false;

	isApplied(): boolean {
		return this.applied;
	}

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.pluginManager = new PluginManager(app);
		this.basesCMSConfigurator = new BasesCMSConfigurator(app);
		this.configFlushService = new ConfigFlushService(app);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Finalize configuration' });
		containerEl.createEl('p', {
			text: 'Review your configuration and click "Apply and restart" below to save and apply all settings.'
		});

		const summary = containerEl.createEl('div', { cls: 'finalize-summary' });

		summary.createEl('h3', { text: 'Summary' });

		// Content Types
		const enabledContentTypes = this.state.contentTypes.filter(ct => ct.enabled);
		summary.createEl('p', { text: `Content Types: ${enabledContentTypes.length}` });

		// Editing Toolbar
		summary.createEl('p', { text: `Editing Toolbar: ${this.state.enableEditingToolbar ? 'Enabled' : 'Disabled'}` });

		// Bases CMS Views (count enabled content types as views to be created)
		const basesViewsCount = enabledContentTypes.length;
		summary.createEl('p', { text: `Bases CMS Views: ${basesViewsCount} new view${basesViewsCount !== 1 ? 's' : ''} to be created` });

		// SEO Scan Directories
		const seoDirectories = enabledContentTypes.map(ct => ct.folder);
		const seoDirectoriesCount = seoDirectories.length;
		summary.createEl('p', { text: `SEO Scan Directories: ${seoDirectoriesCount} director${seoDirectoriesCount !== 1 ? 'ies' : 'y'} (${seoDirectories.join(', ')})` });
	}

	async applyConfiguration(shouldRestart: boolean = false): Promise<void> {
		return this.applyConfigurationInternal(shouldRestart);
	}

	private async applyConfigurationInternal(shouldRestart: boolean = false): Promise<void> {
		if (this.applied) {
			return;
		}

		try {
			console.debug('FinalizeStep: Starting configuration application');
			console.debug('FinalizeStep: Enabled content types:', this.state.contentTypes.filter(ct => ct.enabled).map(ct => ct.name));

			// Configure plugins
			console.debug('FinalizeStep: Configuring plugin states');

			// If Extended File Types is enabled, ensure Data Files Editor is in enabledPlugins
			if (this.state.enableExtendedFileTypes) {
				const pluginId = 'data-files-editor';
				if (!this.state.enabledPlugins.includes(pluginId)) {
					console.debug(`FinalizeStep: Enabling ${pluginId} because Extended File Types is toggle on`);
					this.state.enabledPlugins.push(pluginId);
				}
				this.state.disabledPlugins = this.state.disabledPlugins.filter(p => p !== pluginId);
			}

			await this.pluginManager.setPluginStates(this.state.enabledPlugins, this.state.disabledPlugins);

			// Flush all configurations using the centralized service
			await this.configFlushService.flush(this.state);

			// Configure default content type and Obsidian settings (following astro-modular-settings pattern)
			const defaultTypeId =
				this.state.defaultContentTypeId ||
				this.state.contentTypes.find(ct => ct.enabled)?.id;
			if (defaultTypeId && !this.state.defaultContentTypeId) {
				this.state.defaultContentTypeId = defaultTypeId;
			}
			if (defaultTypeId) {
				const defaultType = this.state.contentTypes.find(ct => ct.id === defaultTypeId);
				if (defaultType) {
					console.debug('FinalizeStep: Configuring Obsidian settings for default content type:', defaultType.name);
					const app = this.app as { setting?: { set?: (key: string, value: unknown) => Promise<void>; save?: () => Promise<void> } };

					// Set attachments folder based on global attachment handling mode
					let targetPath = './';
					if (this.state.attachmentHandlingMode === 'same-folder') {
						targetPath = './';
					} else if (this.state.attachmentHandlingMode === 'subfolder') {
						const folderName = this.state.attachmentFolderName || 'attachments';
						targetPath = `./${folderName}`;
					} else if (this.state.attachmentHandlingMode === 'specified-folder') {
						const folderName = this.state.attachmentFolderName || 'attachments';
						targetPath = folderName;
					}

					// Method 1: Try to use the app's settings manager if available (following astro-modular-settings pattern)
					if (app.setting && typeof app.setting.set === 'function') {
						console.debug('FinalizeStep: Using app.setting API');
						await app.setting.set('newFileLocation', 'folder');
						await app.setting.set('newFileFolderPath', defaultType.folder);
						await app.setting.set('attachmentFolderPath', targetPath);
						await app.setting.set('newLinkFormat', 'relative');

						// Save the settings
						if (typeof app.setting.save === 'function') {
							await app.setting.save();
							console.debug('FinalizeStep: Obsidian settings saved via app.setting.save()');
						}
					} else {
						// Method 2: Fallback to vault config (following astro-modular-settings pattern)
						console.debug('FinalizeStep: Using vault.config API');
						const vault = this.app.vault as { config?: { newFileLocation?: string; newFileFolderPath?: string; attachmentFolderPath?: string; newLinkFormat?: string }; saveConfig?: () => Promise<void> };
						const obsidianSettings = vault.config;

						if (!obsidianSettings) {
							console.error('FinalizeStep: vault.config is not available');
						} else {
							obsidianSettings.newFileLocation = 'folder';
							obsidianSettings.newFileFolderPath = defaultType.folder;
							obsidianSettings.attachmentFolderPath = targetPath;
							obsidianSettings.newLinkFormat = 'relative';

							if (typeof vault.saveConfig === 'function') {
								await vault.saveConfig();
								console.debug('FinalizeStep: Obsidian settings saved via vault.saveConfig()');
							} else {
								console.error('FinalizeStep: vault.saveConfig() is not available');
							}
						}
					}
				}
			}

			this.applied = true;
			// Create a notice based on whether we're restarting
			if (shouldRestart) {
				new Notice('Configuration applied. Obsidian will now restart...', 3000);
			} else {
				new Notice('Configuration applied successfully! You may need to restart Obsidian to see all changes.', 8000);
			}
		} catch (error: unknown) {
			console.error('Failed to apply configuration:', error);
			new Notice('Failed to apply configuration. Please check the console for details.', 6000);
		}
	}

	/**
	 * Find any active Bases views and switch them to the new default view.
	 * Closes old tabs and reopens them to force a clean reload if not restarting.
	 */
	private async updateActiveBasesViews(defaultViewName: string, shouldRestart: boolean): Promise<void> {
		const baseFilePath = await this.basesCMSConfigurator.resolveBaseFilePath();
		let updated = false;

		// Find any active Bases views and update them instead of detaching
		interface BasesLeafState {
			leaf: WorkspaceLeaf;
			state: {
				type: string;
				active: boolean;
				state: {
					file: string;
					view?: string;
					viewName?: string;
					[key: string]: unknown;
				};
				[key: string]: unknown;
			};
		}
		const leavesToUpdate: BasesLeafState[] = [];
		this.app.workspace.iterateAllLeaves((leaf) => {
			const viewType = leaf.view.getViewType();
			if (viewType === 'bases' || viewType === 'bases-cms' || viewType === 'cms') {
				const state = leaf.getViewState();
				if (state.state?.file === baseFilePath) {
					console.debug(`FinalizeStep: Found Bases leaf to update (type: ${viewType})`);
					leavesToUpdate.push({ leaf, state: state as BasesLeafState['state'] });
				}
			}
		});

		// Update existing leaves
		for (const { leaf, state } of leavesToUpdate) {
			console.debug('FinalizeStep: Updating existing Bases leaf state');
			// Update existing leaf state to switch to the new default view
			// Set both 'view' and 'viewName' for compatibility across Bases versions
			await leaf.setViewState({
				...state,
				state: {
					...state.state,
					view: defaultViewName,
					viewName: defaultViewName
				}
			});
			updated = true;
		}

		// If no Bases views were found/updated, open a new one
		if (!updated) {
			console.debug('FinalizeStep: Opening new Bases leaf with fresh state');

			// Use 'cms' as the preferred type for new leaves
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({
				type: 'cms',
				active: true,
				state: {
					file: baseFilePath,
					view: defaultViewName,
					viewName: defaultViewName
				}
			});
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
			updated = true;
		}

		// SPECIAL CASE: If restarting, also try to modify workspace.json directly
		// This is a "belt and suspenders" approach because Obsidian might overwrite
		// the in-memory changes when it closes if the view hasn't fully synced yet.
		if (shouldRestart) {
			try {
				const adapter = this.app.vault.adapter;
				const configDir = this.app.vault.configDir;
				const workspacePath = `${configDir}/workspace.json`;

				if (await adapter.exists(workspacePath)) {
					console.debug('FinalizeStep: Attempting direct workspace.json modification');
					const content = await adapter.read(workspacePath);

					interface WorkspaceNode {
						type?: string;
						state?: {
							type?: string;
							state?: {
								file?: string;
								view?: string;
								viewName?: string;
								[key: string]: unknown;
							};
						};
						children?: WorkspaceNode[] | WorkspaceNode;
					}

					interface WorkspaceData {
						main?: WorkspaceNode;
						left?: WorkspaceNode;
						right?: WorkspaceNode;
						[key: string]: unknown;
					}

					const workspace = JSON.parse(content) as WorkspaceData;

					let modified = false;

					// Recursive function to find and update Bases leaves in workspace.json
					const updateNode = (node: WorkspaceNode | undefined) => {
						if (!node) return;

						if (node.type === 'leaf' && node.state) {
							if ((node.state.type === 'bases' || node.state.type === 'bases-cms' || node.state.type === 'cms') &&
								node.state.state?.file === baseFilePath) {
								console.debug(`FinalizeStep: Found Bases leaf in workspace.json, updating to ${defaultViewName}`);
								if (node.state.state) {
									node.state.state.view = defaultViewName;
									node.state.state.viewName = defaultViewName;
									modified = true;
								}
							}
						}

						if (node.children) {
							if (Array.isArray(node.children)) {
								node.children.forEach((child) => updateNode(child));
							} else {
								updateNode(node.children);
							}
						}
					};

					updateNode(workspace.main);
					updateNode(workspace.left);
					updateNode(workspace.right);

					if (modified) {
						await adapter.write(workspacePath, JSON.stringify(workspace, null, 2));
						console.debug('FinalizeStep: Successfully modified workspace.json');
					}
				}
			} catch (error) {
				console.warn('FinalizeStep: Failed to modify workspace.json directly:', error);
				// Don't throw, we still have the in-memory update
			}
		}
	}

	validate(): boolean {
		// Always return true for finalize step - validation happens when Apply is clicked
		return true;
	}

	getTitle(): string {
		return 'Finalize';
	}

	getDescription(): string {
		return 'Review and apply configuration';
	}
}

