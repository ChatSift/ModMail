import { ms } from '@naval-base/ms';
import type { ApplicationCommandOptionChoiceData, AutocompleteInteraction } from 'discord.js';

export function durationAutoComplete(
	interaction: AutocompleteInteraction<'cached'>,
): ApplicationCommandOptionChoiceData[] {
	const commonOptions = ['1min', '5min', '30min', '1h', '1d', '7d'].map((time) => {
		const parsed = ms(ms(time), true);
		return {
			name: parsed,
			value: parsed,
		};
	});

	const input = interaction.options.getFocused();
	const raw = commonOptions.filter((option) => option.name.includes(input));

	let parsedMs: number;
	if (isNaN(Number(input))) {
		try {
			parsedMs = ms(input);
		} catch {
			return raw;
		}
	} else {
		// Treat the number as minutes
		parsedMs = ms(`${input}m`);
	}

	if (parsedMs <= 0) {
		return raw;
	}

	const parsed = ms(parsedMs, true);
	return commonOptions.filter((option) => option.name.includes(parsed));
}
