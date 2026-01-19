import { BaseWizardStep } from './BaseWizardStep';

export class WelcomeStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		containerEl.createEl('h2', { text: 'Welcome to Vault CMS setup' });
		containerEl.createEl('p', { 
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'This wizard will help you configure your Vault CMS setup. We\'ll guide you through:' 
		});

		const list = containerEl.createEl('ul');
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Detecting your Astro project structure' });
		list.createEl('li', { text: 'Identifying your content types' });
		list.createEl('li', { text: 'Mapping frontmatter properties' });
		list.createEl('li', { text: 'Configuring plugins and themes' });
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Setting up Bases CMS views' });
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Configuring Astro Composer and SEO plugins' });

		containerEl.createEl('p', { 
			text: 'Choose an option to continue:' 
		});

		const buttonContainer = containerEl.createDiv('wizard-welcome-buttons');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		const getStartedBtn = buttonContainer.createEl('button', {
			text: 'Get started',
			cls: 'mod-button mod-cta'
		});
		getStartedBtn.addEventListener('click', () => {
			this.onNext();
		});

		const selectPresetBtn = buttonContainer.createEl('button', {
			text: 'Select preset',
			cls: 'mod-button'
		});
		selectPresetBtn.addEventListener('click', () => {
			// Close modal and open settings tab
			this.onCancel();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(this.app as any).setting.open();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(this.app as any).setting.openTabById('vault-cms');
		});
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Welcome';
	}

	getDescription(): string {
		return 'Introduction to Vault CMS setup';
	}
}
