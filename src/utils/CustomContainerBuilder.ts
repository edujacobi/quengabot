import {
	ActionRowBuilder,
	ButtonBuilder,
	ContainerBuilder,
	SectionBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
} from "discord.js";

interface FooterOptions {
	text?: string;
	button?: ButtonBuilder;
	id?: number;
}

export class CustomSectionBuilder extends SectionBuilder {
	addTexts(texts: string[], id?: number) {
		this.addTextDisplayComponents(
			text => {
				text.setContent(texts.join("\n"));
				if (id) {
					text.setId(id);
				}
				return text;
			},
		);

		return this;
	}
}

export class CustomContainerBuilder extends ContainerBuilder {

	constructor() {
		super();
	}
	// @ts-expect-error: Override with narrower type for CustomSectionBuilder
	override addSectionComponents(...input: (CustomSectionBuilder | ((builder: CustomSectionBuilder) => CustomSectionBuilder))[]) {
		const sections: CustomSectionBuilder[] = [];

		input.forEach(builder => {
			if (builder instanceof CustomSectionBuilder) {
				sections.push(builder as CustomSectionBuilder);
			}
			else {
				const section = new CustomSectionBuilder();
				builder(section);
				sections.push(section);
			}
		});

		super.addSectionComponents(...sections);

		return this;
	}

	protected generateTextFooter(text = "") {
		return `-# ${text}`;
	}

	addTexts(texts: string[], id?: number) {
		this.addTextDisplayComponents(
			text => {
				text.setContent(texts.join("\n"));
				if (id) {
					text.setId(id);
				}
				return text;
			},
		);

		return this;
	}

	addFooter(options?: FooterOptions) {

		this.addLargeSeparator();

		const content = this.generateTextFooter(options?.text);

		if (options?.button) {
			return this.addSectionComponents(footerSection => footerSection
				.setId(100)
				.addTextDisplayComponents(footerText => footerText
					.setId(options.id || 101)
					.setContent(content))
				.setButtonAccessory(options.button!));
		}

		return this.addTextDisplayComponents(footerText => footerText
			.setId(options?.id || 100)
			.setContent(content));
	}

	changeFooterText(text: string) {
		const content = this.generateTextFooter(text);

		return this.changeTextFromSectionId(100, content);
	}

	/**
	 * Change the text from a specific section (or text component). To change a text inside a section, both need a id, and the text should be added 1.
	 * Example: Section: Id 30, Text inside Section: Id 31.
	 * @param id
	 * @param text
	 */
	changeTextFromSectionId(id: number, text: string | string[]) {
		const textComponent = this.components.find(component => component.data?.id === id);

		if (!textComponent) {
			return this;
		}

		const content = Array.isArray(text) ? text.join("\n") : text;

		if (textComponent instanceof TextDisplayBuilder) {
			textComponent.setContent(content);
		}
		else if (textComponent instanceof SectionBuilder) {
			const textComponentInside = textComponent.components.find(component => component.data?.id === id + 1);

			if (!textComponentInside) {
				return this;
			}

			if (textComponentInside instanceof TextDisplayBuilder) {
				textComponentInside.setContent(content);
			}

		}
		return this;
	}

	addLargeSeparator(visible = true) {
		this.addSeparatorComponents(separator => separator
			.setSpacing(SeparatorSpacingSize.Large)
			.setDivider(visible));
		return this;
	}

	addSmallSeparator(visible = true) {
		this.addSeparatorComponents(separator => separator
			.setSpacing(SeparatorSpacingSize.Small)
			.setDivider(visible));
		return this;
	}

	/**
	 * Add an image to the container.
	 * @param url
	 * @param altText
	 */
	addImage(url: string, altText?: string) {
		this.addMediaGalleryComponents(gallery => gallery
			.addItems(galleryItem => {
				galleryItem
					.setURL(url);

				if (altText) {
					galleryItem.setDescription(altText);
				}

				return galleryItem;
			}),
		);
		return this;
	}

	/**
	 * Add a button row to the container.
	 * @param buttons
	 */
	addButtonRow(...buttons: ((builder: ButtonBuilder) => ButtonBuilder)[]) {
		this.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>()
			.setComponents(...buttons.map(builder => builder(new ButtonBuilder()))));
		return this;
	}
}

export class SimpleContainerBuilder extends CustomContainerBuilder {

	constructor(text: string) {
		super();
		this.addTexts([text]);
	}

} 