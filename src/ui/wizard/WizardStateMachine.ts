import { App } from 'obsidian';
import { WizardState } from '../../types';
import { BaseWizardStep } from './BaseWizardStep';
import { WelcomeStep } from './WelcomeStep';
import { ProjectDetectionStep } from './ProjectDetectionStep';
import { ContentTypeStep } from './ContentTypeStep';
import { DefaultContentTypeStep } from './DefaultContentTypeStep';
import { FrontmatterPropertiesStep } from './FrontmatterPropertiesStep';
import { EditingToolbarStep } from './EditingToolbarStep';
import { BasesCMSConfigStep } from './BasesCMSConfigStep';
import { AstroComposerStep } from './AstroComposerStep';
import { SEOConfigStep } from './SEOConfigStep';
import { OptionalPluginsStep } from './OptionalPluginsStep';
import { IgnoreStep } from './IgnoreStep';
import { GitSetupStep } from './GitSetupStep';
import { FinalizeStep } from './FinalizeStep';

/**
 * Wizard state machine states
 * Each state represents a logical phase in the setup process
 */
export type WizardMachineState =
	| 'welcome'
	| 'detect'
	| 'content-types'
	| 'frontmatter'
	| 'plugins'
	| 'complete';

/**
 * Step constructor type for creating wizard steps
 */
type StepConstructor = new (
	app: App,
	containerEl: HTMLElement,
	state: WizardState,
	onNext: () => void,
	onBack: () => void,
	onCancel: () => void
) => BaseWizardStep;

/**
 * State machine for managing wizard flow
 * Makes transitions explicit and easier to debug
 */
export class WizardStateMachine {
	private currentState: WizardMachineState;
	private stepIndex: number;
	private steps: StepConstructor[];

	// State to step index mapping
	private readonly stateStepMap: Map<WizardMachineState, number> = new Map([
		['welcome', 0],
		['detect', 1],
		['content-types', 2],
		['frontmatter', 4],
		['plugins', 9],
		['complete', 12]
	]);

	// Reverse mapping: step index to state
	private readonly stepStateMap: Map<number, WizardMachineState> = new Map([
		[0, 'welcome'],
		[1, 'detect'],
		[2, 'content-types'],
		[3, 'content-types'], // DefaultContentTypeStep is part of content-types
		[4, 'frontmatter'],
		[5, 'plugins'], // EditingToolbarStep starts plugin configuration
		[6, 'plugins'], // BasesCMSConfigStep
		[7, 'plugins'], // AstroComposerStep
		[8, 'plugins'], // SEOConfigStep
		[9, 'plugins'], // OptionalPluginsStep
		[10, 'plugins'], // IgnoreStep
		[11, 'plugins'], // GitSetupStep
		[12, 'complete'] // FinalizeStep
	]);

	// State transition rules
	private readonly transitions: Map<WizardMachineState, WizardMachineState[]> = new Map([
		['welcome', ['detect']],
		['detect', ['content-types']],
		['content-types', ['frontmatter']],
		['frontmatter', ['plugins']],
		['plugins', ['complete']],
		['complete', []] // Terminal state
	]);

	constructor(steps?: StepConstructor[]) {
		this.currentState = 'welcome';
		this.stepIndex = 0;
		this.steps = steps || [
			WelcomeStep,
			ProjectDetectionStep,
			ContentTypeStep,
			DefaultContentTypeStep,
			FrontmatterPropertiesStep,
			EditingToolbarStep,
			BasesCMSConfigStep,
			AstroComposerStep,
			SEOConfigStep,
			OptionalPluginsStep,
			IgnoreStep,
			GitSetupStep,
			FinalizeStep
		];
	}

	/**
	 * Get the current state
	 */
	getState(): WizardMachineState {
		return this.currentState;
	}

	/**
	 * Get the current step index
	 */
	getStepIndex(): number {
		return this.stepIndex;
	}

	/**
	 * Get the total number of steps
	 */
	getTotalSteps(): number {
		return this.steps.length;
	}

	/**
	 * Get the step constructor for a given index
	 */
	getStepConstructor(index: number): StepConstructor | undefined {
		return this.steps[index];
	}

	/**
	 * Check if we can transition to the next step/state
	 */
	canGoNext(): boolean {
		return this.stepIndex < this.steps.length - 1;
	}

	/**
	 * Check if we can go back to the previous step/state
	 */
	canGoBack(): boolean {
		return this.stepIndex > 0;
	}

	/**
	 * Move to the next step
	 * Updates both step index and state
	 */
	next(): void {
		if (!this.canGoNext()) {
			console.warn('WizardStateMachine: Cannot go to next step - already at final step');
			return;
		}

		const nextStepIndex = this.stepIndex + 1;
		const nextState = this.stepStateMap.get(nextStepIndex);

		if (!nextState) {
			console.error(`WizardStateMachine: No state mapping for step index ${nextStepIndex}`);
			return;
		}

		// Validate transition
		const allowedTransitions = this.transitions.get(this.currentState) || [];
		if (!allowedTransitions.includes(nextState) && nextState !== this.currentState) {
			console.warn(
				`WizardStateMachine: Invalid transition from ${this.currentState} to ${nextState}`
			);
		}

		this.stepIndex = nextStepIndex;
		this.currentState = nextState;

		console.debug(
			`WizardStateMachine: Transitioned to step ${this.stepIndex} (state: ${this.currentState})`
		);
	}

	/**
	 * Move to the previous step
	 * Updates both step index and state
	 */
	previous(): void {
		if (!this.canGoBack()) {
			console.warn('WizardStateMachine: Cannot go to previous step - already at first step');
			return;
		}

		const prevStepIndex = this.stepIndex - 1;
		const prevState = this.stepStateMap.get(prevStepIndex);

		if (!prevState) {
			console.error(`WizardStateMachine: No state mapping for step index ${prevStepIndex}`);
			return;
		}

		this.stepIndex = prevStepIndex;
		this.currentState = prevState;

		console.debug(
			`WizardStateMachine: Went back to step ${this.stepIndex} (state: ${this.currentState})`
		);
	}

	/**
	 * Jump to a specific step index
	 * Updates both step index and state
	 */
	jumpToStep(index: number): void {
		// Clamp index to valid range
		const clampedIndex = Math.max(0, Math.min(index, this.steps.length - 1));

		const state = this.stepStateMap.get(clampedIndex);
		if (!state) {
			console.error(`WizardStateMachine: No state mapping for step index ${clampedIndex}`);
			return;
		}

		this.stepIndex = clampedIndex;
		this.currentState = state;

		console.debug(
			`WizardStateMachine: Jumped to step ${this.stepIndex} (state: ${this.currentState})`
		);
	}

	/**
	 * Jump to a specific state
	 * This will move to the first step of that state
	 */
	jumpToState(state: WizardMachineState): void {
		const stepIndex = this.stateStepMap.get(state);

		if (stepIndex === undefined) {
			console.error(`WizardStateMachine: No step mapping for state ${state}`);
			return;
		}

		this.jumpToStep(stepIndex);
	}

	/**
	 * Get progress as a percentage
	 */
	getProgress(): number {
		if (this.steps.length === 0) return 0;
		return ((this.stepIndex + 1) / this.steps.length) * 100;
	}

	/**
	 * Get a human-readable description of the current state
	 */
	getStateDescription(): string {
		switch (this.currentState) {
			case 'welcome':
				return 'Welcome';
			case 'detect':
				return 'Project Detection';
			case 'content-types':
				return 'Content Type Setup';
			case 'frontmatter':
				return 'Frontmatter Configuration';
			case 'plugins':
				return 'Plugin Configuration';
			case 'complete':
				return 'Finalization';
			default:
				return 'Unknown State';
		}
	}

	/**
	 * Debug: Get a summary of the current state machine status
	 */
	getDebugInfo(): string {
		return `State: ${this.currentState} (${this.getStateDescription()}) | ` +
			`Step: ${this.stepIndex + 1}/${this.steps.length} | ` +
			`Progress: ${this.getProgress().toFixed(1)}%`;
	}
}
