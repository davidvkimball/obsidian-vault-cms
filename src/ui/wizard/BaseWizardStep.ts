import { App } from 'obsidian';
import { WizardState } from '../../types';

export abstract class BaseWizardStep {
	protected app: App;
	protected containerEl: HTMLElement;
	protected state: WizardState;
	protected onNext: () => void;
	protected onBack: () => void;
	protected onCancel: () => void;

	constructor(
		app: App,
		containerEl: HTMLElement,
		state: WizardState,
		onNext: () => void,
		onBack: () => void,
		onCancel: () => void
	) {
		this.app = app;
		this.containerEl = containerEl;
		this.state = state;
		this.onNext = onNext;
		this.onBack = onBack;
		this.onCancel = onCancel;
	}

	abstract display(): void | Promise<void>;
	abstract validate(): boolean;
	abstract getTitle(): string;
	abstract getDescription(): string;
}

