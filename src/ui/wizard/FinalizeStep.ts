import { App, Notice } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { PluginManager } from '../../utils/PluginManager';
import { BasesCMSConfigurator } from '../../utils/BasesCMSConfig';
import { AstroComposerConfigurator } from '../../utils/AstroComposerConfig';
import { SEOConfigurator } from '../../utils/SEOConfig';
import { CommanderConfigurator } from '../../utils/CommanderConfig';
import { PropertyOverFileNameConfigurator } from '../../utils/PropertyOverFileNameConfig';
import { ImageInserterConfigurator } from '../../utils/ImageInserterConfig';
import { SimpleBannerConfigurator } from '../../utils/SimpleBannerConfig';

export class FinalizeStep extends BaseWizardStep {
	private pluginManager: PluginManager;
	private basesCMSConfigurator: BasesCMSConfigurator;
	private astroComposerConfigurator: AstroComposerConfigurator;
	private seoConfigurator: SEOConfigurator;
	private commanderConfigurator: CommanderConfigurator;
	private propertyOverFileNameConfigurator: PropertyOverFileNameConfigurator;
	private imageInserterConfigurator: ImageInserterConfigurator;
	private simpleBannerConfigurator: SimpleBannerConfigurator;
	private applied: boolean = false;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.pluginManager = new PluginManager(app);
		this.basesCMSConfigurator = new BasesCMSConfigurator(app);
		this.astroComposerConfigurator = new AstroComposerConfigurator(app);
		this.seoConfigurator = new SEOConfigurator(app);
		this.commanderConfigurator = new CommanderConfigurator(app);
		this.propertyOverFileNameConfigurator = new PropertyOverFileNameConfigurator(app);
		this.imageInserterConfigurator = new ImageInserterConfigurator(app);
		this.simpleBannerConfigurator = new SimpleBannerConfigurator(app);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Finalize Configuration' });
		containerEl.createEl('p', { 
			text: 'Review your configuration and click "Apply" to save all settings:' 
		});

		const summary = containerEl.createEl('div', { cls: 'finalize-summary' });
		
		summary.createEl('h3', { text: 'Summary' });
		
		// Content Types
		const enabledContentTypes = this.state.contentTypes.filter(ct => ct.enabled);
		summary.createEl('p', { text: `Content Types: ${enabledContentTypes.length}` });
		
		// WYSIWYG Toolbar
		summary.createEl('p', { text: `WYSIWYG Toolbar: ${this.state.enableWYSIWYG ? 'Enabled' : 'Disabled'}` });
		
		// Bases CMS Views (count enabled content types as views to be created)
		const basesViewsCount = enabledContentTypes.length;
		summary.createEl('p', { text: `Bases CMS Views: ${basesViewsCount} new view${basesViewsCount !== 1 ? 's' : ''} to be created` });
		
		// SEO Scan Directories
		const seoDirectories = enabledContentTypes.map(ct => ct.folder);
		const seoDirectoriesCount = seoDirectories.length;
		summary.createEl('p', { text: `SEO Scan Directories: ${seoDirectoriesCount} director${seoDirectoriesCount !== 1 ? 'ies' : 'y'} (${seoDirectories.join(', ')})` });

		const applyButtonContainer = containerEl.createDiv();
		applyButtonContainer.style.marginBottom = '30px';
		
		const applyButton = applyButtonContainer.createEl('button', { 
			text: 'Apply Configuration',
			cls: 'mod-cta'
		});

		applyButton.addEventListener('click', async () => {
			await this.applyConfiguration();
		});
	}

	private async applyConfiguration(): Promise<void> {
		if (this.applied) {
			return;
		}

		try {
			console.log('FinalizeStep: Starting configuration application');
			console.log('FinalizeStep: Enabled content types:', this.state.contentTypes.filter(ct => ct.enabled).map(ct => ct.name));
			
			// Configure plugins
			console.log('FinalizeStep: Configuring plugin states');
			await this.pluginManager.setPluginStates(this.state.enabledPlugins, this.state.disabledPlugins);

			// Configure Bases CMS
			console.log('FinalizeStep: Configuring Bases CMS');
			await this.basesCMSConfigurator.createOrUpdateBaseFile(
				this.state.contentTypes,
				this.state.frontmatterProperties,
				this.state.defaultContentTypeId,
				this.state.projectDetection
			);
			console.log('FinalizeStep: Bases CMS configuration complete');

			// Configure Astro Composer
			if (this.state.projectDetection) {
				const astroConfig = await this.astroComposerConfigurator.configureAstroComposer(
					this.state.contentTypes,
					this.state.frontmatterProperties,
					this.state.projectDetection.projectRoot,
					this.state.projectDetection.configFilePath,
					this.state.defaultContentTypeId,
					this.state.projectDetection
				);
				this.state.astroComposerConfig = astroConfig;
				await this.astroComposerConfigurator.saveConfig(astroConfig);
			}

			// Configure SEO
			const seoConfig = this.seoConfigurator.generateSEOConfig(
				this.state.contentTypes,
				this.state.frontmatterProperties,
				this.state.projectDetection
			);
			this.state.seoConfig = seoConfig;
			await this.seoConfigurator.saveConfig(seoConfig);

			// Configure WYSIWYG Toolbar (toggle command directly, not via commander)
			// Always call this to ensure cMenuVisibility is set correctly, even if disabled
			console.log(`FinalizeStep: Configuring editing toolbar, enableWYSIWYG=${this.state.enableWYSIWYG}`);
			await this.commanderConfigurator.toggleEditingToolbarCommand(this.app, this.state.enableWYSIWYG);

			// Configure Commander (no toolbar button)
			const commanderConfig = this.commanderConfigurator.generateCommanderConfig(this.state.enableWYSIWYG);
			this.state.commanderConfig = commanderConfig;
			await this.commanderConfigurator.saveConfig(commanderConfig);

			// Configure Property Over File Name
			const firstType = this.state.contentTypes.find(ct => ct.enabled);
			const firstProps = firstType ? this.state.frontmatterProperties[firstType.id] : undefined;
			if (firstProps && firstProps.titleProperty) {
				this.state.propertyOverFileName.propertyKey = firstProps.titleProperty;
				await this.propertyOverFileNameConfigurator.saveConfig(this.state.propertyOverFileName);
			}

			// Configure Simple Banner (if enabled)
			const imageProperty = firstProps?.imageProperty;
			if (imageProperty && this.state.enabledPlugins.includes('simple-banner')) {
				await this.simpleBannerConfigurator.saveConfig(imageProperty);
			}

			// Configure Image Inserter (if enabled) - use global attachment handling mode
			if (imageProperty && this.state.enabledPlugins.includes('insert-unsplash-image')) {
				// Determine format based on global attachment handling mode
				let imageInserterConfig = { ...this.state.imageInserter };
				// If same-folder, use simple format; otherwise use attachments folder format
				if (this.state.attachmentHandlingMode === 'same-folder') {
					imageInserterConfig.valueFormat = '[[{image-url}]]';
					imageInserterConfig.insertFormat = '[[{image-url}]]';
				} else {
					// For subfolder or specified-folder, use attachments folder
					const folderName = this.state.attachmentFolderName || 'attachments';
					imageInserterConfig.valueFormat = `[[${folderName}/{image-url}]]`;
					imageInserterConfig.insertFormat = `[[${folderName}/{image-url}]]`;
				}
				await this.imageInserterConfigurator.saveConfig(imageInserterConfig, imageProperty);
			}

			// Configure default content type and Obsidian settings (following astro-modular-settings pattern)
			if (this.state.defaultContentTypeId) {
				const defaultType = this.state.contentTypes.find(ct => ct.id === this.state.defaultContentTypeId);
				if (defaultType) {
					console.log('FinalizeStep: Configuring Obsidian settings for default content type:', defaultType.name);
					const app = this.app as any;
					
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
						console.log('FinalizeStep: Using app.setting API');
						await app.setting.set('newFileLocation', 'folder');
						await app.setting.set('newFileFolderPath', defaultType.folder);
						await app.setting.set('attachmentFolderPath', targetPath);
						await app.setting.set('newLinkFormat', 'relative');
						
						// Save the settings
						if (typeof app.setting.save === 'function') {
							await app.setting.save();
							console.log('FinalizeStep: Obsidian settings saved via app.setting.save()');
						}
					} else {
						// Method 2: Fallback to vault config (following astro-modular-settings pattern)
						console.log('FinalizeStep: Using vault.config API');
						const obsidianSettings = (this.app.vault as any).config;
						
						if (!obsidianSettings) {
							console.error('FinalizeStep: vault.config is not available');
						} else {
							obsidianSettings.newFileLocation = 'folder';
							obsidianSettings.newFileFolderPath = defaultType.folder;
							obsidianSettings.attachmentFolderPath = targetPath;
							obsidianSettings.newLinkFormat = 'relative';
							
							if (typeof (this.app.vault as any).saveConfig === 'function') {
								await (this.app.vault as any).saveConfig();
								console.log('FinalizeStep: Obsidian settings saved via vault.saveConfig()');
							} else {
								console.error('FinalizeStep: vault.saveConfig() is not available');
							}
						}
					}
				}
			}

			this.applied = true;
			new Notice('Configuration applied successfully!');
		} catch (error) {
			console.error('Failed to apply configuration:', error);
			new Notice('Failed to apply configuration. Please check the console for details.');
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

