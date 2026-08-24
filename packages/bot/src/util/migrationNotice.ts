import { Colors, EmbedBuilder, time, TimestampStyles } from 'discord.js';

/**
 * Temporary cutover comms for the move to the new ticket-based ModMail (ChatSift/ChatSift#313), plus the
 * thread freeze itself (ChatSift/ChatSift#159).
 *
 * This whole file and its call sites (`events/ready.ts` for the bot status, `util/handleThreadManagement.ts`
 * for the in-thread notice and the freeze guard) are meant to be deleted once the new bot is live --
 * everything here is hardcoded on purpose rather than plumbed through `struct/Env.ts`, since it has a known
 * expiry date.
 *
 * The owner announcement DMs (`scripts/announce-modmail-migration.mjs` over in ChatSift/ChatSift) only reach 21
 * guild owners; the moderators who actually run the bot day to day never see them, which is what the in-thread
 * notice is for.
 */

/**
 * Start of the freeze window, in seconds: Mon 2026-08-24 18:00 EEST, i.e. `2026-08-24T15:00:00Z`.
 *
 * The announcement DMs are generated from the same instant (`MIGRATION_START_ISO=2026-08-24T15:00:00Z` passed to
 * the script named above) -- if this ever moves, both have to move together, or owners and moderators end up
 * looking at two different dates.
 */
export const MIGRATION_START_TS = 1_787_583_600;

/**
 * End of the freeze window and the point the migration itself runs: 48h after {@link MIGRATION_START_TS}, i.e.
 * `2026-08-26T15:00:00Z`. Same 48h arithmetic the announcement script does.
 */
export const FREEZE_END_TS = MIGRATION_START_TS + 48 * 60 * 60;

/**
 * Whether new threads are frozen, i.e. we're at or past {@link MIGRATION_START_TS}.
 *
 * Deliberately has **no upper bound** -- it does not lift itself at {@link FREEZE_END_TS}. If the cutover slips
 * past the announced end of the window, an auto-lift would quietly reopen thread creation on a bot whose data has
 * already been migrated, and every thread opened after that point would exist only on the legacy side (the
 * migration script refuses to run twice for the same `--source`, so there is no second pass to pick them up).
 * Staying frozen until this file is deleted is the safe failure mode.
 */
export function isThreadFreezeActive(): boolean {
	return Date.now() >= MIGRATION_START_TS * 1_000;
}

/**
 * Custom status shown on the bot's profile. Discord doesn't render `<t:...>` markup in a presence, so unlike the
 * embeds below this has to spell the date out. A function rather than a constant because `events/ready.ts`
 * re-applies it hourly, which is what flips it to the freeze wording within an hour of the window opening
 * without needing a restart.
 */
export function migrationStatusText(): string {
	return isThreadFreezeActive()
		? '⚠️ Thread freeze — new ModMail on Aug 26'
		: '⚠️ New ModMail on Aug 24 — 48h thread freeze';
}

/**
 * Posted as the first embed of every newly opened thread, ahead of the usual "who is this" info embed. Yellow
 * rather than the info embed's `NotQuiteBlack` so the two don't read as one block.
 */
export function buildMigrationNoticeEmbed(): EmbedBuilder {
	const start = time(MIGRATION_START_TS, TimestampStyles.LongDateTime);
	const startRelative = time(MIGRATION_START_TS, TimestampStyles.RelativeTime);
	const freezeEnd = time(FREEZE_END_TS, TimestampStyles.LongDateTime);

	return new EmbedBuilder()
		.setColor(Colors.Yellow)
		.setTitle('⚠️ ModMail is moving to a new system')
		.setDescription(
			[
				`On **${start}** (${startRelative}), ModMail switches to a new ticket-based system with a full web dashboard.`,
				'',
				'• For **48 hours** from that moment, **no new threads can be opened**. Threads already open keep working as normal.',
				`• At **${freezeEnd}**, we force-close every open thread and migrate your full history over — nothing gets left behind.`,
				"• After that you're live on the new ModMail. **Configuring a panel on the dashboard will be mandatory** to keep using the bot.",
				'',
				'Questions? Join the support server: https://discord.gg/tgZ2pSgXXv',
			].join('\n'),
		);
}

/**
 * Shown to a **moderator** who tried to open a thread with `/open` or the Open context menu while the freeze is
 * on. Carries the operational detail -- window, force-close, the panel requirement -- because they're the ones
 * who have to act on it. See {@link userFreezeMessage} for what the person on the other side gets instead.
 */
export function buildStaffFreezeEmbed(): EmbedBuilder {
	const freezeEnd = time(FREEZE_END_TS, TimestampStyles.LongDateTime);
	const freezeEndRelative = time(FREEZE_END_TS, TimestampStyles.RelativeTime);

	return new EmbedBuilder()
		.setColor(Colors.Yellow)
		.setTitle('⚠️ New threads are frozen for the migration')
		.setDescription(
			[
				`ModMail is moving to a new ticket-based system. **No new threads can be opened** until the switch completes at **${freezeEnd}** (${freezeEndRelative}).`,
				'',
				'• Threads already open keep working as normal — wrap them up before then if you can.',
				'• At that point every still-open thread is force-closed and your full history is migrated over.',
				"• Afterwards, **configuring a panel on the dashboard is mandatory** — that's how users open tickets from inside the server instead of DMing the bot.",
				'',
				'Questions? Join the support server: https://discord.gg/tgZ2pSgXXv',
			].join('\n'),
		);
}

/**
 * Sent to a **user** who DMed the bot to start a conversation while the freeze is on. Deliberately says almost
 * nothing: they're a community member of whichever server they picked, not a ChatSift user, and none of the
 * migration mechanics in {@link buildStaffFreezeEmbed} is theirs to act on. All they need is that it's
 * temporary, when to come back, and that an existing conversation still works. Plain text rather than an embed,
 * matching the voice of every other DM-side message in this flow.
 */
export function userFreezeMessage(guildName: string): string {
	const freezeEnd = time(FREEZE_END_TS, TimestampStyles.LongDateTime);
	const freezeEndRelative = time(FREEZE_END_TS, TimestampStyles.RelativeTime);

	return [
		`⚠️ **${guildName}**'s ModMail is temporarily unavailable while it's being upgraded, so this won't reach the staff team right now.`,
		`Please try again after **${freezeEnd}** (${freezeEndRelative}). If you already have a conversation open with them, it still works as normal.`,
	].join('\n\n');
}
