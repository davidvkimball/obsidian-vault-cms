import { App, Setting, Notice, ButtonComponent } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { GitManager } from '../../utils/GitManager';
import { SafeConfigWriter } from '../../utils/SafeConfigWriter';
import * as path from 'path';

export class GitSetupStep extends BaseWizardStep {
    private gitManager: typeof GitManager;
    private safeConfigWriter: SafeConfigWriter;

    constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
        super(app, containerEl, state, onNext, onBack, onCancel);
        this.gitManager = GitManager;
        this.safeConfigWriter = new SafeConfigWriter(app);
    }

    private getAbsoluteProjectRoot(): string {
        const relativeRoot = this.state.projectDetection?.projectRoot || '.';
        if (path.isAbsolute(relativeRoot)) {
            return relativeRoot;
        }

        const adapter = this.app.vault.adapter as any;
        const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : '';
        return path.resolve(vaultRoot, relativeRoot);
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Git Integration (Optional)' });

        const instructions = containerEl.createDiv({ cls: 'git-instructions' });
        instructions.createEl('p', {
            text: 'Connect your project to GitHub to publish your site. You can skip this and set it up later or if you already set it up.'
        });

        const tokenLink = instructions.createEl('p');
        tokenLink.createSpan({ text: '1. ' });
        tokenLink.createEl('a', {
            text: 'Generate a new GitHub Personal Access Token',
            href: 'https://github.com/settings/tokens/new'
        });

        const tokenHelp = instructions.createEl('ul');
        tokenHelp.createEl('li', { text: 'Set a Note (e.g., "My blog")' });
        tokenHelp.createEl('li', { text: 'Set Expiration to "No expiration"' });
        tokenHelp.createEl('li', { text: 'Check the "repo" box (so all top options are selected)' });
        tokenHelp.createEl('li', { text: 'Click "Generate token" at the bottom, copy it, and paste it below.' });

        const projectRoot = this.getAbsoluteProjectRoot();
        if (projectRoot) {
            const isRepo = await this.gitManager.isRepo(projectRoot);

            const rootInfo = containerEl.createDiv({ cls: 'git-root-info', attr: { style: 'margin-bottom: 1rem;' } });
            rootInfo.createEl('b', { text: 'Project Root: ' });
            rootInfo.createSpan({ text: projectRoot });

            if (isRepo) {
                const statusEl = containerEl.createDiv({
                    cls: 'git-status-message',
                    attr: { style: 'margin-bottom: 2rem;' }
                });
                statusEl.createSpan({ text: ' ✅ Git is already initialized.' });
            }
        }

        // GitHub PAT Setting
        const patSetting = new Setting(containerEl)
            .setName('GitHub Personal Access Token')
            .setDesc('Stored securely in Obsidian Secrets.')
            .addText(text => {
                // Try to get from secret storage first
                const savedSecret = (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');

                text.setPlaceholder('ghp_xxxxxxxxxxxx')
                    .setValue(this.state.gitConfig.pat || savedSecret || '')
                    .onChange(value => {
                        const trimmedValue = value.trim();
                        this.state.gitConfig.pat = trimmedValue;
                        // Don't save to secretStorage on every keystroke, wait for Verify or Initialize
                    });
                text.inputEl.type = 'password';
            });

        patSetting.addButton(button => {
            button.setButtonText('Verify Token')
                .onClick(async () => {
                    const token = this.state.gitConfig.pat || (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');
                    if (!token) {
                        new Notice('Please enter a token first.');
                        return;
                    }
                    button.setDisabled(true);
                    button.setButtonText('Verifying...');

                    try {
                        const username = await this.gitManager.verifyToken(token);
                        if (username) {
                            new Notice(`Token verified successfully as ${username}!`);
                            // Save to secret storage on successful verification
                            if ((this.app as any).secretStorage) {
                                (this.app as any).secretStorage.setSecret('vault-cms-github-pat', token);
                            }
                            // Also save username for obsidian-git
                            this.app.saveLocalStorage('obsidian-git:username', username);

                            this.state.gitConfig.enabled = true;
                            button.setButtonText('✅ Verified');
                            button.buttonEl.style.backgroundColor = 'var(--background-modifier-success)';
                            button.buttonEl.style.color = 'white';
                        } else {
                            new Notice('Invalid token or GitHub API error.');
                            button.setButtonText('Verify Token');
                            button.setDisabled(false);
                        }
                    } catch (e) {
                        new Notice('Verification failed. Check your connection.');
                        button.setButtonText('Verify Token');
                        button.setDisabled(false);
                    }
                });
        });

        // Repo Name & Description
        new Setting(containerEl)
            .setName('Repository Name')
            .setDesc('The name of your new GitHub repository.')
            .addText(text => {
                const defaultName = projectRoot ? projectRoot.split(/[\\/]/).pop() : '';
                text.setPlaceholder('my-blog')
                    .setValue(this.state.gitConfig.repoName || defaultName || '')
                    .onChange(value => {
                        this.state.gitConfig.repoName = value.trim();
                    });
            });

        new Setting(containerEl)
            .setName('Description')
            .setDesc('A short description for your repository.')
            .addText(text => {
                text.setPlaceholder('My personal blog')
                    .setValue(this.state.gitConfig.repoDescription || '')
                    .onChange(value => {
                        this.state.gitConfig.repoDescription = value.trim();
                    });
            });

        // Visibility Toggle
        new Setting(containerEl)
            .setName('Private Repository')
            .setDesc('Keep this repository private and hidden from the public.')
            .addToggle(toggle => {
                toggle.setValue(this.state.gitConfig.isPrivate)
                    .onChange(value => {
                        this.state.gitConfig.isPrivate = value;
                    });
            });

        // Branch Name
        new Setting(containerEl)
            .setName('Default Branch')
            .setDesc('The name of the initial branch (e.g., "main" or "master").')
            .addText(text => {
                text.setPlaceholder('main')
                    .setValue(this.state.gitConfig.branchName || 'main')
                    .onChange(value => {
                        this.state.gitConfig.branchName = value.trim() || 'main';
                    });
            });

        // Auto-configure obsidian-git
        new Setting(containerEl)
            .setName('Auto-configure Git plugin')
            .setDesc('Automatically set up the "Git" plugin to work with this project.')
            .addToggle(toggle => {
                toggle.setValue(this.state.gitConfig.autoConfigureObsidianGit)
                    .onChange(value => {
                        this.state.gitConfig.autoConfigureObsidianGit = value;
                    });
            });

        // Action Button
        const actionContainer = containerEl.createDiv({ cls: 'git-action-container', attr: { style: 'margin-top: 2rem;' } });
        const createBtn = new ButtonComponent(actionContainer)
            .setButtonText('Initialize & Push to GitHub')
            .setCta()
            .onClick(async () => {
                await this.handleGitSetup(createBtn);
            });

        // Info about skipping
        containerEl.createEl('p', {
            cls: 'git-skip-info',
            attr: { style: 'font-size: 0.8em; color: var(--text-muted); margin-top: 1rem;' },
            text: 'Click "Next" to skip Git setup or if you already have it manually configured.'
        });
    }

    private hasAdvanced = false;

    private async handleGitSetup(button: ButtonComponent) {
        if (this.hasAdvanced) return;

        const { pat, repoName, repoDescription, isPrivate, branchName } = this.state.gitConfig;
        const projectRoot = this.getAbsoluteProjectRoot();
        const branch = branchName || 'main';

        // Try to get token from secret storage if not provided for this run
        const token = pat || (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');

        if (!token || !repoName || !projectRoot) {
            new Notice('Please provide a Token, Repository Name, and ensure project root is detected.');
            return;
        }

        button.setDisabled(true);
        button.setButtonText('Initializing...');

        try {
            // 1. Git Init
            const isRepo = await this.gitManager.isRepo(projectRoot);
            if (!isRepo) {
                await this.gitManager.initRepo(projectRoot);
                new Notice('Local Git repository initialized.');
            }

            // 2. Create GitHub Repo
            new Notice('Creating GitHub repository...');
            const repoInfo = await this.gitManager.createGitHubRepo(token, repoName, repoDescription || '', isPrivate);

            // 3. Set Remote
            await this.gitManager.setRemote(projectRoot, repoInfo.clone_url);
            new Notice(`Successfully connected to ${repoInfo.html_url}`);

            // 4. Initial Commit and Push
            new Notice(`Performing initial commit and pushing to ${branch}...`);
            await this.gitManager.initialCommitAndPush(projectRoot, branch);
            new Notice('Initial commit pushed successfully!');

            // 5. Configure Obsidian Git
            if (this.state.gitConfig.autoConfigureObsidianGit) {
                await this.configureObsidianGit(token, projectRoot);
            }

            // 6. Securely save token if it was just entered
            if (pat && (this.app as any).secretStorage) {
                (this.app as any).secretStorage.setSecret('vault-cms-github-pat', pat);
            }

            // Clear plain-text PAT from state before finishing
            this.state.gitConfig.pat = '';

            this.state.gitConfig.enabled = true;
            button.setButtonText('Success!');
            new Notice('Git setup complete!');

            // Auto-advance after small delay
            if (!this.hasAdvanced) {
                this.hasAdvanced = true;
                setTimeout(() => this.onNext(), 1500);
            }

        } catch (error) {
            console.error('Git integration failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            new Notice(`Setup failed: ${errorMessage}`);
            button.setDisabled(false);
            button.setButtonText('Initialize & Push to GitHub');
        }
    }

    private async configureObsidianGit(pat: string, projectRoot: string) {
        // Set PAT in localStorage
        this.app.saveLocalStorage('obsidian-git:password', pat);

        const adapter = this.app.vault.adapter as any;
        const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : '';

        if (vaultRoot && projectRoot) {
            // Ensure projectRoot is absolute for comparison
            const absoluteProjectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(vaultRoot, projectRoot);
            const relativePath = path.relative(vaultRoot, absoluteProjectRoot).replace(/\\/g, '/');

            const configUpdates: Record<string, any> = {
                basePath: relativePath
            };

            const currentGitConfig = await this.safeConfigWriter.readConfig('obsidian-git');
            if (currentGitConfig) {
                await this.safeConfigWriter.mergeConfig('obsidian-git', configUpdates);
            }
        }

        new Notice('Obsidian Git plugin configured.');
    }

    validate(): boolean {
        return true; // Optional step
    }

    getTitle(): string {
        return 'Git Integration';
    }

    getDescription(): string {
        return 'Connect to GitHub';
    }
}
