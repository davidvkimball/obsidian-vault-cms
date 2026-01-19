import { App, Modal, Notice } from 'obsidian';

/**
 * Helper function for setCssProps
 */
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
		element.style.setProperty(cssKey, value);
	}
}
import { WizardState } from '../types';
import { BaseWizardStep } from './wizard/BaseWizardStep';
import { WizardStateManager } from './wizard/WizardStateManager';
import VaultCMSPlugin from '../main';
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
import { IgnoreStep } from './wizard/IgnoreStep';
import { FinalizeStep } from './wizard/FinalizeStep';

export class SetupWizardModal extends Modal {
	private stateManager: WizardStateManager;
	private plugin: VaultCMSPlugin;
	private steps: (new (app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) => BaseWizardStep)[];
	private currentStepInstance: BaseWizardStep | null = null;
	private isCompleting: boolean = false;
	private initialSettingsSnapshot: Partial<WizardState> | null = null;
	private lastSavedStepIndex: number = -1; // Track the last step where "Next" was clicked

	constructor(app: App, initialState?: Partial<WizardState>, pluginInstance?: VaultCMSPlugin) {
		super(app);
		this.plugin = pluginInstance || (app as { plugins?: { plugins?: Record<string, VaultCMSPlugin> } }).plugins?.plugins?.['vault-cms'] as VaultCMSPlugin;
		
		if (!this.plugin) {
			throw new Error('VaultCMSPlugin instance is required');
		}
		
		this.stateManager = new WizardStateManager(this.plugin);
		
		// Apply any initial state overrides
		if (initialState) {
			this.stateManager.updateState(initialState);
		}

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
			IgnoreStep,
			FinalizeStep
		];
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('vault-cms-wizard');
		
		// Refresh the wizard state with current settings
		await this.stateManager.refreshState();
		
		// Store a snapshot of initial settings to detect changes later
		this.initialSettingsSnapshot = this.createSettingsSnapshot();
		
		// Render current step (may be async, but we don't await it)
		void this.renderCurrentStep();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		
		// When closing, only preserve changes from steps where "Next" was clicked
		// Discard unsaved changes from the current step (equivalent to "Skip")
		// The "Next" button already saved those steps, so we don't need to save again
		// Just close without saving - this discards current step changes but preserves previous "Next" saves
		
		// Reset the flag
		this.isCompleting = false;
	}

	private scrollToTop() {
		const { contentEl } = this;
		
		// Method 1: Find and scroll the actual scrollable parent
		let scrollableParent: HTMLElement | null = contentEl;
		while (scrollableParent && scrollableParent !== document.body) {
			const style = window.getComputedStyle(scrollableParent);
			if (scrollableParent.scrollHeight > scrollableParent.clientHeight && 
				(style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll')) {
				scrollableParent.scrollTop = 0;
				break;
			}
			scrollableParent = scrollableParent.parentElement;
		}
		
		// Method 2: Try common Obsidian modal containers
		const modalContent = contentEl.closest('.modal-content');
		if (modalContent) {
			(modalContent as HTMLElement).scrollTop = 0;
		}
		
		const modalContainer = contentEl.closest('.modal-container');
		if (modalContainer) {
			(modalContainer as HTMLElement).scrollTop = 0;
		}
		
		// Also try contentEl itself
		contentEl.scrollTop = 0;
	}

	private async renderCurrentStep() {
		const { contentEl } = this;
		
		// Scroll to top IMMEDIATELY before clearing content to prevent visual jump
		this.scrollToTop();
		
		// Clear content
		contentEl.empty();
		contentEl.addClass('vault-cms-wizard');

		// Scroll to top again after clearing (in case clearing changed scroll position)
		this.scrollToTop();

		// Render progress
		this.renderProgress(contentEl);

		// Render step content (may be async, but we don't await it)
		const stepContent = contentEl.createDiv('wizard-content');
		await this.renderStepContent(stepContent);

		// Render footer
		this.renderFooter(contentEl);
		
		// Final scroll to top after all rendering is complete
		requestAnimationFrame(() => {
			this.scrollToTop();
		});
	}

	private renderProgress(container: HTMLElement) {
		const state = this.stateManager.getState();
		const totalSteps = this.steps.length;
		const progress = container.createDiv('wizard-progress');
		
		const progressBar = progress.createDiv('progress-bar');
		const progressFill = progressBar.createDiv('progress-fill');
		// Set dynamic width using setCssProps
		setCssProps(progressFill, { width: `${this.stateManager.getProgress(totalSteps)}%` });
		
		// Add step text below the progress bar
		const progressText = progress.createDiv('progress-text');
		progressText.textContent = `Step ${state.currentStep + 1} of ${totalSteps}`;
	}

	private async renderStepContent(container: HTMLElement) {
		const state = this.stateManager.getState();
		const stepIndex = state.currentStep;
		
		if (stepIndex >= 0 && stepIndex < this.steps.length) {
			const StepClass = this.steps[stepIndex];
			const stepName = StepClass.name || 'Unknown';
			console.debug(`SetupWizardModal: Displaying step ${stepIndex + 1}/${this.steps.length}: ${stepName}`);
			
			this.currentStepInstance = new StepClass(
				this.app,
				container,
				state,
				() => {
					// Next handler - save and advance
					void (async () => {
						if (this.currentStepInstance && this.currentStepInstance.validate()) {
							await this.saveCurrentStepToWizardState();
							this.stateManager.nextStep();
							await this.renderCurrentStep();
						}
					})();
				},
				() => {
					// Back handler - discard and go back
					this.discardCurrentStepChanges();
					this.stateManager.previousStep();
					void this.renderCurrentStep();
				},
				() => this.close()
			);

			// Await display() since it may be async
			await this.currentStepInstance.display();
		}
	}

	private renderFooter(container: HTMLElement) {
		const footer = container.createDiv('wizard-footer');
		setCssProps(footer, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
		
		// Startup setting checkbox (only on the first step)
		if (this.stateManager.getState().currentStep === 0) {
			const startupSetting = footer.createDiv('wizard-startup-setting-footer');
			const label = startupSetting.createEl('label', { cls: 'wizard-checkbox-label' });
			// Ensure cursor is default when hovering over the label/checkbox
			setCssProps(label, { cursor: 'default' });
			const checkbox = label.createEl('input', { type: 'checkbox' });
			setCssProps(checkbox, { cursor: 'default' });
			checkbox.checked = !this.plugin.settings.runWizardOnStartup;
			label.createSpan({ text: " I've already set up my vault, don't show on startup" });
			
			checkbox.addEventListener('change', () => {
				this.plugin.settings.runWizardOnStartup = !checkbox.checked;
				void this.plugin.saveSettings();
			});
		} else {
			// Empty div to keep buttons pushed to the right
			footer.createDiv();
		}
		
		const buttons = footer.createDiv('wizard-buttons');
		setCssProps(buttons, { display: 'flex', gap: '10px' });
		
		// Previous button
		if (this.stateManager.canGoPrevious()) {
			const prevBtn = buttons.createEl('button', {
				text: 'Previous',
				cls: 'mod-button'
			});
			prevBtn.addEventListener('click', () => {
				// Discard any changes made on current step and go back
				this.discardCurrentStepChanges();
				this.stateManager.previousStep();
				void this.renderCurrentStep();
			});
		}

		// Next/Complete button
		if (this.stateManager.canGoNext(this.steps.length)) {
			// Don't show "Next" button on the first step (WelcomeStep)
			if (this.stateManager.getState().currentStep !== 0) {
				const nextBtn = buttons.createEl('button', {
					text: 'Next',
					cls: 'mod-button mod-cta'
				});
				nextBtn.addEventListener('click', () => {
					// Save current step changes to wizard state and data.json
					void (async () => {
						if (this.currentStepInstance && this.currentStepInstance.validate()) {
							await this.saveCurrentStepToWizardState();
							// Track that this step was saved
							this.lastSavedStepIndex = this.stateManager.getState().currentStep;
							this.stateManager.nextStep();
							await this.renderCurrentStep();
						}
					})();
				});
			}
		} else {
			// Final step - provide Apply and Apply and restart options
			if (this.currentStepInstance instanceof FinalizeStep) {
				const applyBtn = buttons.createEl('button', {
					text: 'Apply',
					cls: 'mod-button'
				});
				applyBtn.addEventListener('click', () => {
					void this.handleComplete(false);
				});

				const applyRestartBtn = buttons.createEl('button', {
					text: 'Apply and restart',
					cls: 'mod-button mod-cta'
				});
				applyRestartBtn.addEventListener('click', () => {
					void this.handleComplete(true);
				});
			} else {
				// Fallback for other steps that might be the last step
				const completeBtn = buttons.createEl('button', {
					text: 'Complete setup',
					cls: 'mod-button mod-cta'
				});
				completeBtn.addEventListener('click', () => {
					void this.handleComplete(false);
				});
			}
		}

		// Skip button (for all steps except the last)
		if (this.stateManager.canGoNext(this.steps.length)) {
			// Don't show "Skip" button on the first step (WelcomeStep)
			if (this.stateManager.getState().currentStep !== 0) {
				const skipBtn = buttons.createEl('button', {
					text: 'Skip',
					cls: 'mod-button'
				});
				skipBtn.addClass('wizard-skip-button');
				setCssProps(skipBtn, { opacity: '0.6' });
				skipBtn.addEventListener('click', () => {
					// Skip without saving current step changes to wizard state
					this.stateManager.nextStep();
					void this.renderCurrentStep();
				});
			}
		}
	}

	private async handleComplete(shouldRestart: boolean): Promise<void> {
		if (this.isCompleting) return;
		this.isCompleting = true;

		try {
			if (this.currentStepInstance && this.currentStepInstance.validate()) {
				// If we're on FinalizeStep, apply configuration first
				if (this.currentStepInstance instanceof FinalizeStep) {
					await this.currentStepInstance.applyConfiguration(shouldRestart);
				} else {
					// For other steps, just save the current step
					await this.saveCurrentStepToWizardState();
				}
				
				// Mark wizard as completed and disable startup trigger
				this.plugin.settings.wizardCompleted = true;
				this.plugin.settings.runWizardOnStartup = false;
				await this.plugin.saveSettings();
				
				// CRITICAL: Reload settings from disk to ensure everything is synchronized
				await this.plugin.loadSettings();
				
				this.close();

				// Trigger restart if requested
				if (shouldRestart) {
					// Small delay to ensure Notice is visible and settings are saved
					setTimeout(() => {
						interface AppWithCommands extends App {
							commands: {
								executeCommandById(id: string): void;
							};
						}
						(this.app as unknown as AppWithCommands).commands.executeCommandById('app:reload');
					}, 1000);
				}
			}
		} catch (error: unknown) {
			console.error('Error completing wizard:', error);
			new Notice('Failed to complete setup. Please check the console for details.');
		} finally {
			this.isCompleting = false;
		}
	}

	private async saveCurrentStepToWizardState(): Promise<void> {
		// Save current step changes to wizard state and data.json
		// This is called when NEXT is clicked to ensure data.json stays in sync
		try {
			// Build final settings from wizard state (updates plugin.settings)
			this.stateManager.buildFinalSettings();
			
			// Save to data.json
			await this.plugin.saveSettings();
			
			// Reload settings to ensure the plugin has the latest values
			await this.plugin.loadSettings();
		} catch (error: unknown) {
			console.error('Error saving current step to data.json:', error);
			// Don't show error to user - just log it, as this shouldn't block navigation
		}
	}

	private discardCurrentStepChanges(): void {
		// Discard changes made on current step - this is called when PREVIOUS is clicked
		// Refresh the wizard state to show original values from data.json
		void this.stateManager.refreshState();
	}

	private async saveWizardStateToDataJson(showNotification: boolean = true): Promise<void> {
		// Save wizard state changes to data.json when modal is closed
		// This ensures changes are preserved even if user closes modal without completing wizard
		try {
			// Build final settings from wizard state
			this.stateManager.buildFinalSettings();
			
			// Check if any changes were actually made
			const hasChanges = this.hasSettingsChanged();
			
			// Only save to data.json if there were actual changes
			if (!hasChanges) {
				return; // No changes, don't save anything
			}
			
			// Save to data.json
			await this.plugin.saveSettings();
			
			// Reload settings to ensure the plugin has the latest values
			await this.plugin.loadSettings();
			
			// Only show notification if requested
			if (showNotification) {
				new Notice('Configuration saved');
			}
		} catch (error: unknown) {
			console.error('Error saving wizard state to data.json:', error);
			if (showNotification) {
				new Notice(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
	
	private createSettingsSnapshot(): Partial<WizardState> {
		// Create a deep copy of current state for comparison
		const state = this.stateManager.getState();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return JSON.parse(JSON.stringify({
			projectDetection: state.projectDetection,
			contentTypes: state.contentTypes,
			frontmatterProperties: state.frontmatterProperties,
			defaultContentTypeId: state.defaultContentTypeId,
			preset: state.preset,
			enableWYSIWYG: state.enableWYSIWYG,
			enabledPlugins: state.enabledPlugins,
			disabledPlugins: state.disabledPlugins,
			theme: state.theme,
			basesCMSConfig: state.basesCMSConfig,
			astroComposerConfig: state.astroComposerConfig,
			seoConfig: state.seoConfig,
			commanderConfig: state.commanderConfig,
			propertyOverFileName: state.propertyOverFileName,
			imageInserter: state.imageInserter,
			imageManager: state.imageManager,
			homeBase: state.homeBase
		}));
	}
	
	private hasSettingsChanged(): boolean {
		if (!this.initialSettingsSnapshot) {
			return false;
		}
		
		const currentSnapshot = this.createSettingsSnapshot();
		
		// Compare key settings that can be changed in the wizard
		return (
			JSON.stringify(currentSnapshot.projectDetection) !== JSON.stringify(this.initialSettingsSnapshot.projectDetection) ||
			JSON.stringify(currentSnapshot.contentTypes) !== JSON.stringify(this.initialSettingsSnapshot.contentTypes) ||
			JSON.stringify(currentSnapshot.frontmatterProperties) !== JSON.stringify(this.initialSettingsSnapshot.frontmatterProperties) ||
			currentSnapshot.defaultContentTypeId !== this.initialSettingsSnapshot.defaultContentTypeId ||
			currentSnapshot.preset !== this.initialSettingsSnapshot.preset ||
			currentSnapshot.enableWYSIWYG !== this.initialSettingsSnapshot.enableWYSIWYG ||
			JSON.stringify(currentSnapshot.enabledPlugins) !== JSON.stringify(this.initialSettingsSnapshot.enabledPlugins) ||
			JSON.stringify(currentSnapshot.disabledPlugins) !== JSON.stringify(this.initialSettingsSnapshot.disabledPlugins) ||
			currentSnapshot.theme !== this.initialSettingsSnapshot.theme ||
			JSON.stringify(currentSnapshot.basesCMSConfig) !== JSON.stringify(this.initialSettingsSnapshot.basesCMSConfig) ||
			JSON.stringify(currentSnapshot.astroComposerConfig) !== JSON.stringify(this.initialSettingsSnapshot.astroComposerConfig) ||
			JSON.stringify(currentSnapshot.seoConfig) !== JSON.stringify(this.initialSettingsSnapshot.seoConfig) ||
			JSON.stringify(currentSnapshot.commanderConfig) !== JSON.stringify(this.initialSettingsSnapshot.commanderConfig) ||
			JSON.stringify(currentSnapshot.propertyOverFileName) !== JSON.stringify(this.initialSettingsSnapshot.propertyOverFileName) ||
			JSON.stringify(currentSnapshot.imageInserter) !== JSON.stringify(this.initialSettingsSnapshot.imageInserter) ||
			JSON.stringify(currentSnapshot.imageManager) !== JSON.stringify(this.initialSettingsSnapshot.imageManager) ||
			JSON.stringify(currentSnapshot.homeBase) !== JSON.stringify(this.initialSettingsSnapshot.homeBase)
		);
	}

	getState(): WizardState {
		return this.stateManager.getState();
	}

	// Callback to save state to plugin settings (kept for backward compatibility)
	setSaveCallback(callback: (state: WizardState) => Promise<void>) {
		// This is now handled by saveCurrentStepToWizardState and saveWizardStateToDataJson
		// But we keep the method for backward compatibility
		console.warn('setSaveCallback is deprecated - state is now managed automatically');
	}
}
