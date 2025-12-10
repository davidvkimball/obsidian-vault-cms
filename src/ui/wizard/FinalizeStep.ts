import { App, Notice } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { PluginManager } from '../../utils/PluginManager';
import { BasesCMSConfigurator } from '../../utils/BasesCMSConfig';
import { AstroComposerConfigurator } from '../../utils/AstroComposerConfig';
import { SEOConfigurator } from '../../utils/SEOConfig';
import { CommanderConfigurator } from '../../utils/CommanderConfig';
import { PropertyOverFileNameConfigurator } from '../../utils/PropertyOverFileNameConfig';

export class FinalizeStep extends BaseWizardStep {
	private pluginManager: PluginManager;
	private basesCMSConfigurator: BasesCMSConfigurator;
	private astroComposerConfigurator: AstroComposerConfigurator;
	private seoConfigurator: SEOConfigurator;
	private commanderConfigurator: CommanderConfigurator;
	private propertyOverFileNameConfigurator: PropertyOverFileNameConfigurator;
	private applied: boolean = false;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.pluginManager = new PluginManager(app);
		this.basesCMSConfigurator = new BasesCMSConfigurator(app);
		this.astroComposerConfigurator = new AstroComposerConfigurator(app);
		this.seoConfigurator = new SEOConfigurator(app);
		this.commanderConfigurator = new CommanderConfigurator(app);
		this.propertyOverFileNameConfigurator = new PropertyOverFileNameConfigurator(app);
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
			if (this.state.preset !== 'custom') {
				const presetPlugins = this.pluginManager.getPresetPlugins(this.state.preset);
				await this.pluginManager.setPluginStates(presetPlugins.enabled, presetPlugins.disabled);
				this.state.enabledPlugins = presetPlugins.enabled;
				this.state.disabledPlugins = presetPlugins.disabled;
			} else {
				await this.pluginManager.setPluginStates(this.state.enabledPlugins, this.state.disabledPlugins);
			}

			// Configure Bases CMS
			await this.basesCMSConfigurator.createOrUpdateBaseFile(
				this.state.contentTypes,
				this.state.frontmatterProperties
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

			// Configure Commander
			const commanderConfig = this.commanderConfigurator.generateCommanderConfig(this.state.enableWYSIWYG);
			this.state.commanderConfig = commanderConfig;
			await this.commanderConfigurator.saveConfig(commanderConfig);

			// Configure Property Over File Name
			const firstType = this.state.contentTypes.find(ct => ct.enabled);
			const firstProps = firstType ? this.state.frontmatterProperties[firstType.id] : undefined;
			if (firstProps) {
				this.state.propertyOverFileName.propertyKey = firstProps.titleProperty;
				await this.propertyOverFileNameConfigurator.saveConfig(this.state.propertyOverFileName);
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

