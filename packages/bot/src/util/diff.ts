export function diff(oldContent: string, newContent: string) {
	oldContent = oldContent
		.split('\n')
		.map((line) => `- ${line}`)
		.join('\n');

	newContent = newContent
		.split('\n')
		.map((line) => `+ ${line}`)
		.join('\n');

	return `${oldContent}\n\n${newContent}`;
}
