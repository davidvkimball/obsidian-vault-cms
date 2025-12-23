import { BaseWizardStep } from './BaseWizardStep';

export class WelcomeStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// False positive: "Vault CMS" is a proper noun (product name) and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		containerEl.createEl('h2', { text: 'Welcome to Vault CMS setup' });
		containerEl.createEl('p', { 
			// False positive: "Vault CMS" is a proper noun (product name) and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'This wizard will help you configure your Vault CMS setup. We\'ll guide you through:' 
		});

		const list = containerEl.createEl('ul');
		// False positive: "Astro" is a proper noun (framework name) and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Detecting your Astro project structure' });
		list.createEl('li', { text: 'Identifying your content types' });
		list.createEl('li', { text: 'Mapping frontmatter properties' });
		list.createEl('li', { text: 'Configuring plugins and themes' });
		// False positive: "Bases CMS" is a proper noun (product name) and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Setting up Bases CMS views' });
		// False positive: "Astro Composer" and "SEO" are proper nouns and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Configuring Astro Composer and SEO plugins' });

		containerEl.createEl('p', { 
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'Click "Next" to begin the setup process.' 
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

