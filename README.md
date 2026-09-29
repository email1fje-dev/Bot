# Discord Hidem Bot

A lightweight Discord bot for administrators.

## Command

`/hidem`

- Select a text/announcement channel.
- Enter a message.
- The bot posts the message as the bot.
- The command is restricted to members with the **Administrator** permission.
- The command response is ephemeral, so other members do not see who used it.

## Railway variables

Set:

- `DISCORD_TOKEN`
- `CLIENT_ID`

Then deploy with:

```bash
npm install
npm start
```

The bot needs permission to **View Channel** and **Send Messages** in the channels where it will post.
