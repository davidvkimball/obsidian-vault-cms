import { BaseWizardStep } from './BaseWizardStep';

export class BasesCMSConfigStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// False positive: "Bases CMS" is a proper noun (product name) and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		containerEl.createEl('h2', { text: 'Bases CMS configuration' });
		containerEl.createEl('p', { 
			// False positive: "Bases CMS" is a proper noun (product name) and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'Bases CMS views will be automatically created for each enabled content type using your mapped frontmatter properties.' 
		});

		const enabledTypes = this.state.contentTypes.filter(ct => ct.enabled);
		
		if (enabledTypes.length === 0) {
			containerEl.createEl('p', { 
				text: 'No content types enabled. Please go back and enable at least one content type.' 
			});
			return;
		}

		containerEl.createEl('h3', { text: 'Views to be created:' });
		const list = containerEl.createEl('ul');
		
		for (const contentType of enabledTypes) {
			const props = this.state.frontmatterProperties[contentType.id];
			if (props) {
				const properties: string[] = [];
				if (props.titleProperty) properties.push(`title: ${props.titleProperty}`);
				if (props.dateProperty) properties.push(`date: ${props.dateProperty}`);
				if (props.descriptionProperty) properties.push(`description: ${props.descriptionProperty}`);
				if (props.tagsProperty) properties.push(`tags: ${props.tagsProperty}`);
				if (props.imageProperty) properties.push(`image: ${props.imageProperty}`);
				if (props.draftProperty) properties.push(`draft: ${props.draftProperty}`);
				
				const propertiesText = properties.length > 0 ? properties.join(', ') : 'default properties';
				list.createEl('li', { 
					text: `${contentType.name}: ${propertiesText}` 
				});
			}
		}

		containerEl.createEl('p', { 
			// False positive: "Bases CMS" is a proper noun (product name) and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'You can customize these views later in the Bases CMS settings.' 
		});
	}

	validate(): boolean {
		return this.state.contentTypes.some(ct => ct.enabled);
	}

	getTitle(): string {
		return 'Bases CMS configuration';
	}

	getDescription(): string {
		return 'Configure Bases CMS views';
	}
}

