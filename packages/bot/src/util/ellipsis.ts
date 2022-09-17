/**
 * Cuts off text after the given length - appending "..." at the end
 *
 * @param text - The text to cut off
 * @param total - The maximum length of the text
 */
export function ellipsis(text: string, total: number): string {
	if (text.length <= total) {
		return text;
	}

	const keep = total - 3;
	if (keep < 1) {
		return text.slice(0, total);
	}

	return `${text.slice(0, keep)}...`;
}
