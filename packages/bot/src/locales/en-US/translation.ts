export const enUS = {
	common: {
		yes: 'Yes',
		no: 'No',
		enable_notifications: 'Enable notifications',
		has_stickers: 'This message also included a sticker',
		success: {
			resource_creation: 'Successfully created {{ resource }}',
			resource_deletion: 'Successfully deleted the given {{ resource }}',
			resource_update: 'Successfully updated the given {{ resource }}',
			archived: 'Thread successfully archived',
			blocked: 'User successfully blocked',
			unblocked: 'User successfully unblocked',
			alert_global: 'You will now be alerted when new threads are opened',
			no_alert_global: 'You will no longer be alerted when new threads are opened',
			alert_thread: 'You will now be alerted when the user replies to this thread',
			no_alert_thread: 'You will no longer be alerted when the user replies to this thread',
			opened_thread: 'Successfully opened thread',
			reply_deleted: 'Successfully deleted your reply',
			setting_up_notifcation: '{{- user }}, your thread is being set up...',
			thread_created_notification:
				'{{- user }}, your thread has been created! All future messages in this channel will be sent to the staff team, and you can see their replies here. If you would like to be notified of incoming replies, click the button below.',
			internal_thread_created: 'Thread successfully created (mod-end)...',
			thread_created: 'Thread successfully created',
		},
		errors: {
			resource_exists: 'A {{ resource }} with that name already exists',
			resource_not_found: 'The {{ resource }} you are looking for could not be found',
			no_resources: 'There are no {{ resource }} available',
			resource_too_long: 'The given {{ snippet }} needs to be {{ length }} characters or less',
			no_guilds: 'Could not find any mutual guilds that are setup with this bot.',
			no_guild: "Could not find that guild. Are you sure you're still in it?",
			no_thread: 'This does not appear to be a thread',
			thread_deleted:
				'Could not find the channel associated with this thread. This is most likely because an Admin deleted it, opening a new thread with your message.',
			thread_creation:
				'Could not create the needed thread channel. This is likely a miss-configuration caused by an Admin',
			thread_exists: 'A thread already exists with this user',
			invalid_time: 'The given time is invalid',
			dm_fail: 'Failed to send a DM to the user. This is most likely because they have closed their DMs',
			no_member: 'Member is not currently in the server',
			not_own_message: 'You are not the author of that message',
			user_deleted: 'The user appears to have deleted their account',
			not_blocked: 'User is not blocked',
			message_deleted: 'Could not expose message, it was likely deleted',
			dm_only: 'This command is meant to only be used in DMs',
			no_content: 'Messages require content to be used as replies',
			no_results: "No server found, it's possible none have the bot set up",
			reserved_name: 'That name cannot be used, as its reserved for internal purposes',
			resource_limit_reached: 'You have reached the limit of {{ limit }} {{ resource }}s',
			no_args: 'You need to provide at least {{ count }} arguments to use this command',
			arg_conflict: 'You cannot provide both {{ first }} and {{ second }}',
			bad_snippet_name:
				'The name of your snippet cannot be used for slash command creation. Please try a different name',
			timed_out: 'Timed out. Please try again',
			no_embeds: 'The target message has no embeds',
			must_be_text_channel: 'The target message must be a regular text channel',
			already_open_thread: 'You already have an open thread for this ModMail',
			could_not_create_internal_thread:
				'Something went wrong while trying to create a thread for the staff team. Please inform them of this error',
			could_not_create_thread: 'Something went wrong while creating your thread. ',
			forum_not_found: 'The intended channel for your message no longer exists; please inform a staff member.',
			tag_not_found: 'The intended tag for your message no longer exists; please inform a staff member.',
			message_forward: 'Something went wrong while forwarding your message/edit. Please contact a server admin.',
			message_too_long: 'Sorry! I cannot forward messages longer than 3800 characters at this time.',
		},
	},
	snippet_command: {
		description: 'This is a local snippet',
		options: {
			anon: {
				name: 'anon',
				description: 'Whether or not to send the message as anonymous - defaults to false',
			},
		},
	},
	thread: {
		user_left: 'User has left the server',
		user_rejoin: 'User has rejoiend the server',
		prompt: 'Please select a guild',
		reprompt:
			"Just to make sure you don't get it wrong, please select the guild this message is meant to go to once more",
		tag_prompt: 'Please select a tag',
		start: {
			embed: {
				fields: {
					account_created: '📆 Account Created',
					joined_server: '📥 Joined Server',
					past_modmails: '🗂️ Past Modmails',
					opened_by: '🛠️ Opened by',
					roles: '🏷️ Roles',
				},
			},
		},
		greeting: {
			embed: {
				author: '{{- guild }} Team - Greeting',
			},
		},
		farewell: {
			embed: {
				author: '{{- guild }} Team - Farewell',
			},
		},
	},
	commands: {
		snippets: {
			name: 'snippets',
			description: 'Manage your ModMail snippets',
			add: {
				name: 'add',
				description: 'Add a snippet',
				options: {
					name: {
						name: 'name',
						description: 'The name of the snippet',
					},
					content: {
						name: 'content',
						description: 'The content of the snippet',
					},
				},
			},
			remove: {
				name: 'remove',
				description: 'Remove a snippet',
				options: {
					name: {
						name: 'name',
						description: 'The name of the snippet',
					},
				},
			},
			edit: {
				name: 'edit',
				description: 'Edit a snippet',
				options: {
					name: {
						name: 'name',
						description: 'The name of the snippet',
					},
					content: {
						name: 'content',
						description: 'The new content of the snippet',
					},
				},
			},
			show: {
				name: 'show',
				description: 'Show information about a specific snippet',
				options: {
					name: {
						name: 'name',
						description: 'The name of the snippet',
					},
				},
				embed: {
					title: 'Snippet {{ name }}',
					fields: {
						created_by: 'Created by',
						created_at: 'Created at',
						last_updated_at: 'Last updated at',
						last_used_at: 'Last used at',
					},
					footer: 'Used {{ uses }} times',
				},
				buttons: {
					view_history: 'View history',
					restore: 'Restore to this version',
				},
				history: {
					embed: {
						footer: 'Update done by: {{- user }}',
					},
				},
			},
			list: {
				name: 'list',
				description: 'List all snippets',
				embed: {
					title: 'Available snippets',
				},
			},
		},
		close: {
			name: 'close',
			description: 'Close a thread',
			options: {
				time: {
					name: 'time',
					description: 'The amount of time to wait before closing the thread',
				},
				silent: {
					name: 'silent',
					description: 'Whether or not to send the farewell message to the user - defaults to true',
				},
				cancel: {
					name: 'cancel',
					description: 'Cancels a scheduled thread close',
				},
			},
			no_scheduled_close: "This thread wasn't scheduled to close",
			successfully_canceled: 'Successfully canceled the closing of this thread',
		},
		reply: {
			name: 'reply',
			description: 'Reply to a thread',
			options: {
				content: {
					name: 'content',
					description: 'The content of the message',
				},
				attachment: {
					name: 'attachment',
					description: 'Optional attachment to send',
				},
				anon: {
					name: 'anon',
					description: 'Whether or not to send the message as anonymous - defaults to false',
				},
			},
		},
		edit: {
			name: 'edit',
			description: 'Edit a reply to a thread',
			options: {
				id: {
					name: 'id',
					description: 'ID of the reply you wish to edit',
				},
				content: {
					name: 'content',
					description: 'The new content of the reply',
				},
				attachment: {
					name: 'attachment',
					description: 'Optional attachment to edit in',
				},
				clear_attachment: {
					name: 'clear-attachment',
					description: 'Clears the attachment of the reply',
				},
			},
		},
		block: {
			name: 'block',
			description: 'Block the user from using ModMail',
			options: {
				duration: {
					name: 'duration',
					description: 'How long this user should be blocked for',
				},
			},
		},
		unblock: {
			name: 'unblock',
			description: 'Unblock a user',
			options: {
				user: {
					name: 'user',
					description: 'The user to unblock',
				},
			},
		},
		alert: {
			name: 'alert',
			description: 'Recieve alerts for the current thread, or whenever new threads are opened',
		},
		open: {
			name: 'open',
			description: 'Open a thread',
			options: {
				user: {
					name: 'user',
					description: 'The user to open a thread with',
				},
			},
		},
		switch: {
			name: 'switch',
			description: 'Switch the guild your messages are intended for',
			options: {
				guild: {
					name: 'guild',
					description: 'The guild to switch to',
				},
			},
			success: 'Succesfully switched to the given guild',
		},
		config: {
			name: 'config',
			description: "Manage your server's configuration",
			options: {
				modmail_channel: {
					name: 'modmail-channel',
					description: 'The channel your modmail threads should be going to',
				},
				greeting: {
					name: 'greeting',
					description: 'The initial message to send to the user when they open a new thread',
				},
				farewell: {
					name: 'farewell',
					description: 'The message to send to the user when a thread is closed',
				},
				simple_mode: {
					name: 'simple-mode',
					description: 'Whether or not to use the simple mode for ModMail threads',
				},
				alert_role: {
					name: 'alert-role',
					description: 'The role to ping when a new thread is open',
				},
			},
		},
		logs: {
			name: 'logs',
			description: 'View the logs for a user',
			options: {
				user: {
					name: 'user',
					description: 'The user to view the logs for - defaults to the user that opened the current thread',
				},
			},
			embed: {
				title: 'Available thread logs',
			},
		},
		delete: {
			name: 'delete',
			description: 'Delete a reply',
			options: {
				id: {
					name: 'id',
					description: 'The ID of the reply to delete',
				},
			},
		},
	},
	context_menus: {
		open: {
			name: 'Open',
		},
		create_snippet: {
			name: 'Create Snippet',
		},
		expose: {
			name: 'Expose Link',
		},
		reply: {
			name: 'Reply w/ Message',
		},
		reply_anon: {
			name: 'Reply Anon w/ Message',
		},
		setup_prompt: {
			name: 'Setup Prompt',
			select_channel: 'Select the forum channel to use for this prompt',
			confirm_want_tags: 'Do you want to have individual buttons for each tag?',
			creating: 'Creating prompt...',
			success: 'Successfully created prompt',
			start_thread: 'Start ModMail Thread',
		},
	},
};
