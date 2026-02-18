import { App } from 'obsidian';
import { WizardState } from '../../types';

export abstract class BaseWizardStep {
	protected app: App;
	protected containerEl: HTMLElement;
	protected state: WizardState;
	protected onNext: () => void;
	protected onBack: () => void;
	protected onCancel: () => void;
	public showNextButton: boolean = true;

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

	/**
	 * Check if this step should be automatically skipped
	 */
	async shouldSkip(): Promise<boolean> {
		return false;
	}

	/**
	 * Convert absolute path to relative path from vault root
	 */
	protected toRelativePath(absolutePath: string): string {
		const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;
		if (!vaultPath) {
			return absolutePath;
		}

		const vaultNormalized = vaultPath.replace(/\\/g, '/').replace(/\/$/, '');
		const absoluteNormalized = absolutePath.replace(/\\/g, '/').replace(/\/$/, '');

		// If the absolute path is within the vault, return relative path
		if (absoluteNormalized.startsWith(vaultNormalized)) {
			const relative = absoluteNormalized.slice(vaultNormalized.length);
			// Remove leading path separator
			const trimmedRelative = relative.startsWith('/') ? relative.slice(1) : relative;
			return trimmedRelative || '.';
		}

		// If path is outside vault, calculate relative path manually
		try {
			// Split paths into parts
			const vaultParts = vaultNormalized.split('/').filter(p => p);
			const absoluteParts = absoluteNormalized.split('/').filter(p => p);

			// Find common prefix
			let commonLength = 0;
			while (commonLength < vaultParts.length && commonLength < absoluteParts.length && vaultParts[commonLength] === absoluteParts[commonLength]) {
				commonLength++;
			}

			// Calculate relative path
			const upLevels = vaultParts.length - commonLength;
			const relativeParts = absoluteParts.slice(commonLength);
			const relative = (upLevels > 0 ? '../'.repeat(upLevels) : '') + relativeParts.join('/');
			return relative || absolutePath;
		} catch {
			// If relative path calculation fails, return absolute path
			return absolutePath;
		}
	}
}

