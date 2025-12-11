import { App, Modal } from 'obsidian';
import { WizardState } from '../types';
import { BaseWizardStep } from './wizard/BaseWizardStep';
import { WelcomeStep } from './wizard/WelcomeStep';
import { ProjectDetectionStep } from './wizard/ProjectDetectionStep';
import { ContentTypeStep } from './wizard/ContentTypeStep';
import { DefaultContentTypeStep } from './wizard/DefaultContentTypeStep';
import { FrontmatterPropertiesStep } from './wizard/FrontmatterPropertiesStep';
import { WYSIWYGPreferenceStep } from './wizard/WYSIWYGPreferenceStep';
import { BasesCMSConfigStep } from './wizard/BasesCMSConfigStep';
import { AstroComposerStep } from './wizard/AstroComposerStep';
import { SEOConfigStep } from './wizard/SEOConfigStep';
import { OptionalPluginsStep } from './wizard/OptionalPluginsStep';
import { FinalizeStep } from './wizard/FinalizeStep';

export class SetupWizardModal extends Modal {
	private state: WizardState;
	private currentStepIndex: number = 0;
	private steps: (new (app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) => BaseWizardStep)[];
	private currentStepInstance: BaseWizardStep | null = null;
	private saveCallback?: (state: WizardState) => Promise<void>;
	private pluginInstance?: any; // Reference to plugin for saving

	constructor(app: App, initialState?: Partial<WizardState>, pluginInstance?: any) {
		super(app);
		this.pluginInstance = pluginInstance;
		
		// Initialize project detection from saved settings if available
		const savedProjectDetection = initialState?.projectDetection || 
			(pluginInstance?.settings?.projectRoot && pluginInstance?.settings?.configFilePath ? {
				projectRoot: pluginInstance.settings.projectRoot,
				configFilePath: pluginInstance.settings.configFilePath,
				vaultLocation: 'content' as const
			} : undefined);

		this.state = {
			currentStep: 0,
			contentTypes: initialState?.contentTypes || pluginInstance?.settings?.contentTypes || [],
			frontmatterProperties: initialState?.frontmatterProperties || pluginInstance?.settings?.frontmatterProperties || {},
			projectDetection: savedProjectDetection,
			defaultContentTypeId: initialState?.defaultContentTypeId || pluginInstance?.settings?.defaultContentTypeId,
			attachmentHandlingMode: initialState?.attachmentHandlingMode || 'subfolder',
			attachmentFolderName: initialState?.attachmentFolderName,
			preset: initialState?.preset || pluginInstance?.settings?.preset || 'vanilla',
			enableWYSIWYG: initialState?.enableWYSIWYG ?? pluginInstance?.settings?.enableWYSIWYG ?? false,
			enabledPlugins: initialState?.enabledPlugins || pluginInstance?.settings?.enabledPlugins || [],
			disabledPlugins: initialState?.disabledPlugins || pluginInstance?.settings?.disabledPlugins || [],
			theme: initialState?.theme || pluginInstance?.settings?.theme || '',
			basesCMSConfig: initialState?.basesCMSConfig || pluginInstance?.settings?.basesCMSConfig || { views: [] },
			astroComposerConfig: initialState?.astroComposerConfig || pluginInstance?.settings?.astroComposerConfig || {
				customContentTypes: [],
				defaultTemplate: '',
				configFilePath: '',
				terminalProjectRootPath: ''
			},
			seoConfig: initialState?.seoConfig || pluginInstance?.settings?.seoConfig || {
				titleProperty: 'title',
				scanDirectories: '',
				useFilenameAsTitle: false,
				useFilenameAsSlug: true
			},
			commanderConfig: initialState?.commanderConfig || pluginInstance?.settings?.commanderConfig || { pageHeaderCommands: [] },
			propertyOverFileName: initialState?.propertyOverFileName || pluginInstance?.settings?.propertyOverFileName || { propertyKey: 'title' },
			imageInserter: initialState?.imageInserter || pluginInstance?.settings?.imageInserter || { valueFormat: '[[attachments/{image-url}]]', insertFormat: '[[attachments/{image-url}]]' },
			...initialState
		} as WizardState;

		this.steps = [
			WelcomeStep,
			ProjectDetectionStep,
			ContentTypeStep,
			DefaultContentTypeStep,
			FrontmatterPropertiesStep,
			WYSIWYGPreferenceStep,
			BasesCMSConfigStep,
			AstroComposerStep,
			SEOConfigStep,
			OptionalPluginsStep,
			FinalizeStep
		];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.displayCurrentStep().catch(err => {
			console.error('Error displaying wizard step:', err);
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async displayCurrentStep() {
		const { contentEl } = this;
		contentEl.empty();

		if (this.currentStepIndex >= this.steps.length) {
			this.close();
			return;
		}

		const StepClass = this.steps[this.currentStepIndex];
		const stepName = StepClass.name || 'Unknown';
		console.log(`SetupWizardModal: Displaying step ${this.currentStepIndex + 1}/${this.steps.length}: ${stepName}`);
		
		this.currentStepInstance = new StepClass(
			this.app,
			contentEl,
			this.state,
			() => this.nextStep(),
			() => this.previousStep(),
			() => this.close()
		);

		// Await display() since it may be async
		await this.currentStepInstance.display();
		this.state.currentStep = this.currentStepIndex;

		// Add navigation buttons after content is displayed (with proper spacing like astro-modular-settings)
		const footer = contentEl.createDiv({ cls: 'wizard-footer' });
		const buttonContainer = footer.createDiv({ cls: 'wizard-buttons' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		
		if (this.currentStepIndex > 0) {
			const backButton = buttonContainer.createEl('button', { 
				text: 'Previous',
				cls: 'mod-button'
			});
			backButton.addEventListener('click', async () => {
				await this.previousStep();
			});
		}

		if (this.currentStepIndex < this.steps.length - 1) {
			const nextButton = buttonContainer.createEl('button', { 
				text: 'Next',
				cls: 'mod-button mod-cta'
			});
			nextButton.addEventListener('click', async () => {
				if (this.currentStepInstance && this.currentStepInstance.validate()) {
					// Save current step state to data.json before proceeding
					await this.saveCurrentStepState();
					await this.nextStep();
				}
			});

			// Skip button (for all steps except the last)
			const skipButton = buttonContainer.createEl('button', { 
				text: 'Skip',
				cls: 'mod-button'
			});
			skipButton.style.opacity = '0.6';
			skipButton.addEventListener('click', async () => {
				// Skip without saving current step changes to disk
				// State changes in memory are preserved, but nothing is written to data.json files
				await this.nextStep();
			});
		} else {
			// Last step - Finish button
			const finishButton = buttonContainer.createEl('button', { 
				text: 'Complete Setup',
				cls: 'mod-button mod-cta'
			});
			finishButton.addEventListener('click', async () => {
				if (this.currentStepInstance && this.currentStepInstance.validate()) {
					await this.saveStateIfNeeded();
					this.close();
				}
			});
		}
	}

	private async nextStep() {
		if (this.currentStepIndex < this.steps.length - 1) {
			this.currentStepIndex++;
			await this.displayCurrentStep();
		} else {
			await this.saveStateIfNeeded();
			this.close();
		}
	}

	/**
	 * Save current step state to data.json (called when Next is clicked)
	 */
	private async saveCurrentStepState(): Promise<void> {
		try {
			if (this.saveCallback && this.pluginInstance) {
				// Update plugin settings with current wizard state
				this.pluginInstance.settings.projectRoot = this.state.projectDetection?.projectRoot || '';
				this.pluginInstance.settings.configFilePath = this.state.projectDetection?.configFilePath || '';
				this.pluginInstance.settings.contentTypes = this.state.contentTypes;
				this.pluginInstance.settings.frontmatterProperties = this.state.frontmatterProperties;
				this.pluginInstance.settings.defaultContentTypeId = this.state.defaultContentTypeId;
				this.pluginInstance.settings.preset = this.state.preset;
				this.pluginInstance.settings.enableWYSIWYG = this.state.enableWYSIWYG;
				this.pluginInstance.settings.enabledPlugins = this.state.enabledPlugins;
				this.pluginInstance.settings.disabledPlugins = this.state.disabledPlugins;
				this.pluginInstance.settings.theme = this.state.theme;
				this.pluginInstance.settings.basesCMSConfig = this.state.basesCMSConfig;
				this.pluginInstance.settings.astroComposerConfig = this.state.astroComposerConfig;
				this.pluginInstance.settings.seoConfig = this.state.seoConfig;
				this.pluginInstance.settings.commanderConfig = this.state.commanderConfig;
				this.pluginInstance.settings.propertyOverFileName = this.state.propertyOverFileName;
				this.pluginInstance.settings.imageInserter = this.state.imageInserter;
				
				// Save to data.json
				await this.pluginInstance.saveSettings();
			}
		} catch (error) {
			console.error('Error saving current step state:', error);
			// Don't block navigation on save errors
		}
	}

	private async previousStep() {
		if (this.currentStepIndex > 0) {
			this.currentStepIndex--;
			await this.displayCurrentStep();
		}
	}

	getState(): WizardState {
		return this.state;
	}

	// Callback to save state to plugin settings
	setSaveCallback(callback: (state: WizardState) => Promise<void>) {
		this.saveCallback = callback;
	}

	private async saveStateIfNeeded(): Promise<void> {
		if (this.saveCallback && this.currentStepIndex === this.steps.length - 1) {
			await this.saveCallback(this.state);
		}
	}
}
