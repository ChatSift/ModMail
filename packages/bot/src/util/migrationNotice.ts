import { Colors, EmbedBuilder, time, TimestampStyles } from 'discord.js';

/**
 * Temporary cutover comms for the move to the new ticket-based ModMail (ChatSift/ChatSift#313).
 *
 * This whole file and its two call sites (`events/ready.ts` for the bot status, `util/handleThreadManagement.ts`
 * for the in-thread notice) are meant to be deleted once the new bot is live -- everything here is hardcoded
 * on purpose rather than plumbed through `struct/Env.ts`, since it has a known expiry date.
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
 * Custom status shown on the bot's profile. Discord doesn't render `<t:...>` markup in a presence, so unlike the
 * embed below this has to spell the date out.
 */
export const MIGRATION_STATUS_TEXT = '⚠️ New ModMail on Aug 24 — 48h thread freeze';

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
