import { App, Setting, Notice } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { ProjectOptimizer } from '../../utils/ProjectOptimizer';

export class IgnoreStep extends BaseWizardStep {
	private optimizer: ProjectOptimizer;
	private gitSetting: Setting;
	private viteSetting: Setting;
	private hooksSetting: Setting;
	private workflowsSetting: Setting;

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

		// GitHub automation setting (only show if workflows or dependabot.yml
		// are present). Workflows force the PAT `workflow` scope to push;
		// dependabot.yml auto-creates dependency-bump PRs the moment the
		// repo lands on GitHub. Most Vault CMS users want neither.
		if (status.githubAutomationStatus !== 'none') {
			this.workflowsSetting = new Setting(containerEl);
			this.updateWorkflowsSetting(status.githubAutomationStatus, status.githubAutomationFiles);
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

	private updateWorkflowsSetting(status: 'detected' | 'removed' | 'none', files: string[]) {
		// Show just the basenames so the description doesn't get unwieldy
		// when several files would be removed.
		const basenames = files.map((p) => p.replace(/\\/g, '/').split('/').pop()).filter(Boolean) as string[];
		const fileList = basenames.length > 0
			? basenames.slice(0, 4).join(', ') + (basenames.length > 4 ? `, +${basenames.length - 4} more` : '')
			: '';

		this.workflowsSetting
			.setName('Remove GitHub automation files')
			.setDesc(
				`This project ships GitHub automation files (${fileList || 'workflows, dependabot.yml'}). ` +
				`GitHub Actions workflow files require a special "workflow" PAT scope to push. ` +
				`Dependabot auto-creates dependency-bump pull requests as soon as the repo is on GitHub. ` +
				`Removing them gives you a clean initial push and an empty PR list. ` +
				`Issue templates, PR template, CODEOWNERS, and FUNDING.yml are kept.`
			)
			.clear();

		if (status === 'detected') {
			this.workflowsSetting.addButton(button => {
				button.setButtonText('Remove')
					.setWarning()
					.onClick(async () => {
						try {
							const removed = this.optimizer.removeGithubAutomation();
							new Notice(`Removed ${removed} GitHub automation file${removed === 1 ? '' : 's'}`);
							const newStatus = await this.optimizer.getStatus();
							this.updateWorkflowsSetting(newStatus.githubAutomationStatus, newStatus.githubAutomationFiles);
						} catch (error) {
							new Notice(`Failed to remove GitHub automation files: ${error instanceof Error ? error.message : String(error)}`);
						}
					});
			});
		}

		this.optimizer.renderStatus(this.workflowsSetting.controlEl, status === 'detected' ? 'not-configured' : 'configured');
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
