import { App, Modal } from 'obsidian';
import { WizardState } from '../types';
import { BaseWizardStep } from './wizard/BaseWizardStep';
import { WelcomeStep } from './wizard/WelcomeStep';
import { ProjectDetectionStep } from './wizard/ProjectDetectionStep';
import { ContentTypeStep } from './wizard/ContentTypeStep';
import { FrontmatterPropertiesStep } from './wizard/FrontmatterPropertiesStep';
import { PluginPresetStep } from './wizard/PluginPresetStep';
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

	constructor(app: App, initialState?: Partial<WizardState>) {
		super(app);
		
		this.state = {
			currentStep: 0,
			contentTypes: [],
			frontmatterProperties: {},
			preset: 'default',
			enableWYSIWYG: false,
			enabledPlugins: [],
			disabledPlugins: [],
			theme: '',
			basesCMSConfig: { views: [] },
			astroComposerConfig: {
				customContentTypes: [],
				defaultTemplate: '',
				configFilePath: '',
				terminalProjectRootPath: ''
			},
			seoConfig: {
				titleProperty: 'title',
				scanDirectories: '',
				useFilenameAsTitle: false,
				useFilenameAsSlug: true
			},
			commanderConfig: { pageHeaderCommands: [] },
			propertyOverFileName: { propertyKey: 'title' },
			imageInserter: { valueFormat: '[[attachments/{image-url}]]', insertFormat: '[[attachments/{image-url}]]' },
			...initialState
		} as WizardState;

		this.steps = [
			WelcomeStep,
			ProjectDetectionStep,
			ContentTypeStep,
			FrontmatterPropertiesStep,
			PluginPresetStep,
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
		this.displayCurrentStep();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private displayCurrentStep() {
		const { contentEl } = this;
		contentEl.empty();

		if (this.currentStepIndex >= this.steps.length) {
			this.close();
			return;
		}

		const StepClass = this.steps[this.currentStepIndex];
		this.currentStepInstance = new StepClass(
			this.app,
			contentEl,
			this.state,
			() => this.nextStep(),
			() => this.previousStep(),
			() => this.close()
		);

		this.currentStepInstance.display();
		this.state.currentStep = this.currentStepIndex;

		// Add navigation buttons
		const buttonContainer = contentEl.createDiv({ cls: 'wizard-buttons' });
		
		if (this.currentStepIndex > 0) {
			const backButton = buttonContainer.createEl('button', { text: 'Back' });
			backButton.addEventListener('click', () => this.previousStep());
		}

		const nextButton = buttonContainer.createEl('button', { 
			text: this.currentStepIndex === this.steps.length - 1 ? 'Finish' : 'Next',
			cls: 'mod-cta'
		});
		nextButton.addEventListener('click', async () => {
			if (this.currentStepInstance && this.currentStepInstance.validate()) {
				await this.nextStep();
			}
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
	}

	private async nextStep() {
		if (this.currentStepInstance && !this.currentStepInstance.validate()) {
			return;
		}

		if (this.currentStepIndex < this.steps.length - 1) {
			this.currentStepIndex++;
			this.displayCurrentStep();
		} else {
			await this.saveStateIfNeeded();
			this.close();
		}
	}

	private previousStep() {
		if (this.currentStepIndex > 0) {
			this.currentStepIndex--;
			this.displayCurrentStep();
		}
	}

	getState(): WizardState {
		return this.state;
	}

	private saveCallback?: (state: WizardState) => Promise<void>;

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
