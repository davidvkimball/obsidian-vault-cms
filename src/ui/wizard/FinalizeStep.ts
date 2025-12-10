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
import { GuideFileUpdater } from '../../utils/GuideFileUpdater';

export class FinalizeStep extends BaseWizardStep {
	private pluginManager: PluginManager;
	private basesCMSConfigurator: BasesCMSConfigurator;
	private astroComposerConfigurator: AstroComposerConfigurator;
	private seoConfigurator: SEOConfigurator;
	private commanderConfigurator: CommanderConfigurator;
	private propertyOverFileNameConfigurator: PropertyOverFileNameConfigurator;
	private imageInserterConfigurator: ImageInserterConfigurator;
	private simpleBannerConfigurator: SimpleBannerConfigurator;
	private guideFileUpdater: GuideFileUpdater;
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
		this.guideFileUpdater = new GuideFileUpdater(app);
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
		summary.createEl('p', { text: `Preset: ${this.state.preset}` });
		summary.createEl('p', { text: `Theme: ${this.state.theme || 'Default'}` });
		summary.createEl('p', { text: `Content Types: ${this.state.contentTypes.filter(ct => ct.enabled).length}` });
		summary.createEl('p', { text: `WYSIWYG Toolbar: ${this.state.enableWYSIWYG ? 'Enabled' : 'Disabled'}` });

		const applyButton = containerEl.createEl('button', { 
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
			// Configure plugins
			await this.pluginManager.setPluginStates(this.state.enabledPlugins, this.state.disabledPlugins);

			// Configure Bases CMS
			await this.basesCMSConfigurator.createOrUpdateBaseFile(
				this.state.contentTypes,
				this.state.frontmatterProperties,
				this.state.defaultContentTypeId
			);

			// Configure Astro Composer
			if (this.state.projectDetection) {
				const astroConfig = await this.astroComposerConfigurator.configureAstroComposer(
					this.state.contentTypes,
					this.state.frontmatterProperties,
					this.state.projectDetection.projectRoot,
					this.state.projectDetection.configFilePath
				);
				this.state.astroComposerConfig = astroConfig;
				await this.astroComposerConfigurator.saveConfig(astroConfig);
			}

			// Configure SEO
			const seoConfig = this.seoConfigurator.generateSEOConfig(
				this.state.contentTypes,
				this.state.frontmatterProperties
			);
			this.state.seoConfig = seoConfig;
			await this.seoConfigurator.saveConfig(seoConfig);

			// Configure WYSIWYG Toolbar (toggle command directly, not via commander)
			if (this.state.enableWYSIWYG) {
				await this.commanderConfigurator.toggleEditingToolbarCommand(this.app, true);
			}

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

			// Update guide file with detected properties
			if (firstProps) {
				await this.guideFileUpdater.updateGuideFile(firstProps);
			}

			// Configure Simple Banner (if enabled)
			const imageProperty = firstProps?.imageProperty;
			if (imageProperty && this.state.enabledPlugins.includes('simple-banner')) {
				await this.simpleBannerConfigurator.saveConfig(imageProperty);
			}

			// Configure Image Inserter (if enabled)
			if (imageProperty && this.state.enabledPlugins.includes('insert-unsplash-image')) {
				await this.imageInserterConfigurator.saveConfig(this.state.imageInserter, imageProperty);
			}

			// Configure default content type
			if (this.state.defaultContentTypeId) {
				const defaultType = this.state.contentTypes.find(ct => ct.id === this.state.defaultContentTypeId);
				if (defaultType) {
					// Set Obsidian's default location for new notes
					const vault = this.app.vault as any;
					const obsidianConfig = vault.config || {};
					
					obsidianConfig.newFileLocation = 'folder';
					obsidianConfig.newFileFolderPath = defaultType.folder;
					
					// Set attachments folder if configured
					const attachmentsFolder = defaultType.attachmentsFolder || this.state.sharedAttachmentsFolder;
					if (attachmentsFolder) {
						// Convert absolute path to relative if needed
						const vaultPath = (this.app.vault.adapter as any).basePath || (this.app.vault.adapter as any).path;
						if (vaultPath && attachmentsFolder.startsWith(vaultPath)) {
							const relativePath = attachmentsFolder.slice(vaultPath.length).replace(/^[\/\\]+/, '');
							obsidianConfig.attachmentFolderPath = `./${relativePath}`;
						} else {
							obsidianConfig.attachmentFolderPath = attachmentsFolder;
						}
					}
					
					// Update vault config
					vault.config = obsidianConfig;
					
					// Save Obsidian settings
					if (typeof vault.saveConfig === 'function') {
						await vault.saveConfig();
					} else {
						// Fallback: try to save via app settings
						const app = this.app as any;
						if (app.setting && typeof app.setting.set === 'function') {
							await app.setting.set('newFileLocation', 'folder');
							await app.setting.set('newFileFolderPath', defaultType.folder);
							if (attachmentsFolder) {
								const vaultPath = (this.app.vault.adapter as any).basePath || (this.app.vault.adapter as any).path;
								if (vaultPath && attachmentsFolder.startsWith(vaultPath)) {
									const relativePath = attachmentsFolder.slice(vaultPath.length).replace(/^[\/\\]+/, '');
									await app.setting.set('attachmentFolderPath', `./${relativePath}`);
								} else {
									await app.setting.set('attachmentFolderPath', attachmentsFolder);
								}
							}
							if (typeof app.setting.save === 'function') {
								await app.setting.save();
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
		return this.applied;
	}

	getTitle(): string {
		return 'Finalize';
	}

	getDescription(): string {
		return 'Review and apply configuration';
	}
}

