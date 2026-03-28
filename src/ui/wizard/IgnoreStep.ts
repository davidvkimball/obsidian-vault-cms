import { App, Setting, Notice } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { ProjectOptimizer } from '../../utils/ProjectOptimizer';

export class IgnoreStep extends BaseWizardStep {
	private optimizer: ProjectOptimizer;
	private gitSetting: Setting;
	private viteSetting: Setting;
	private hooksSetting: Setting;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.optimizer = new ProjectOptimizer(app, state);
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		const status = await this.optimizer.getStatus();
		this.state.ignoreConfig.gitIgnoreConfigured = status.gitIgnoreStatus === 'configured';
		this.state.ignoreConfig.viteIgnoreConfigured = status.viteIgnoreStatus === 'configured';

		containerEl.createEl('h2', { text: 'Project optimization (optional)' });
		containerEl.createEl('p', {
			text: 'Optimize your project by ignoring Obsidian-specific files in Git and Vite.'
		});

		// Git Ignore Setting
		this.gitSetting = new Setting(containerEl);
		this.updateGitSetting(status.gitIgnoreStatus);

		// Vite Ignore Setting
		this.viteSetting = new Setting(containerEl);
		this.updateViteSetting(status.viteIgnoreStatus);

		// Git Hooks Setting (only show if hooks detected or neutralized)
		if (status.gitHooksStatus !== 'none') {
			this.hooksSetting = new Setting(containerEl);
			this.updateHooksSetting(status.gitHooksStatus);
		}

		return Promise.resolve();
	}

	private updateGitSetting(status: 'configured' | 'not-configured') {
		this.gitSetting.setName('Ignore workspace files in Git')
			.setDesc('Add Obsidian workspace files to .gitignore to prevent them from being tracked.')
			.clear(); // Clear existing buttons and status

		this.gitSetting.addButton(button => {
			button.setButtonText(status === 'configured' ? 'Re-configure' : 'Configure')
				.onClick(async () => {
					try {
						await this.optimizer.configureGitIgnore();
						this.state.ignoreConfig.gitIgnoreConfigured = true;
						new Notice('.gitignore updated');
						const newStatus = await this.optimizer.getStatus();
						this.updateGitSetting(newStatus.gitIgnoreStatus);
					} catch (error) {
						new Notice(`Failed to update .gitignore: ${error instanceof Error ? error.message : String(error)}`);
					}
				});
		});

		this.optimizer.renderStatus(this.gitSetting.controlEl, status);
	}

	private updateViteSetting(status: 'configured' | 'not-configured') {
		this.viteSetting.setName('Ignore workspace and Home Base folders in Vite')
			.setDesc('Configure Vite to ignore Obsidian and Home Base folders.')
			.clear(); // Clear existing buttons and status

		this.viteSetting.addButton(button => {
			button.setButtonText(status === 'configured' ? 'Re-configure' : 'Configure')
				.onClick(async () => {
					try {
						await this.optimizer.configureViteIgnore();
						this.state.ignoreConfig.viteIgnoreConfigured = true;
						new Notice('Vite optimization applied');
						const newStatus = await this.optimizer.getStatus();
						this.updateViteSetting(newStatus.viteIgnoreStatus);
					} catch (error) {
						new Notice(`Failed to update Vite config: ${error instanceof Error ? error.message : String(error)}`);
					}
				});
		});

		this.optimizer.renderStatus(this.viteSetting.controlEl, status);
	}

	private updateHooksSetting(status: 'detected' | 'neutralized' | 'none') {
		this.hooksSetting.setName('Neutralize developer git hooks')
			.setDesc('This project has git hooks (like husky or commitlint) that can block publishing from Obsidian. Disable so commits can happen easily from Obsidian.')
			.clear();

		if (status === 'detected') {
			this.hooksSetting.addButton(button => {
				button.setButtonText('Neutralize')
					.setCta()
					.onClick(async () => {
						try {
							this.optimizer.neutralizeGitHooks();
							new Notice('Git hooks neutralized');
							const newStatus = await this.optimizer.getStatus();
							this.updateHooksSetting(newStatus.gitHooksStatus);
						} catch (error) {
							new Notice(`Failed to neutralize git hooks: ${error instanceof Error ? error.message : String(error)}`);
						}
					});
			});
		}

		this.optimizer.renderStatus(this.hooksSetting.controlEl, status === 'neutralized' ? 'configured' : 'not-configured');
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Project optimization (optional)';
	}

	getDescription(): string {
		return 'Configure project-level ignores';
	}
}
