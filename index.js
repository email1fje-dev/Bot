const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const command = new SlashCommandBuilder()
  .setName("hidem")
  .setDescription("Send a message as the bot to a selected channel.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
  .addChannelOption(option =>
    option
      .setName("channel")
      .setDescription("The channel where the bot should send the message.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("message")
      .setDescription("The message to send.")
      .setRequired(true)
      .setMaxLength(2000)
  );

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: [command.toJSON()]
  });
  console.log("Registered /hidem globally.");
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Failed to register slash command:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "hidem") return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ You need the Administrator permission to use this command.",
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel("channel", true);
  const message = interaction.options.getString("message", true);

  if (!channel.isTextBased()) {
    return interaction.reply({
      content: "❌ Please select a text-based channel.",
      ephemeral: true
    });
  }

  try {
    await channel.send({
      content: message,
      allowedMentions: { parse: ["users", "roles", "everyone"] }
    });

    await interaction.reply({
      content: `✅ Message sent anonymously in <#${channel.id}>.`,
      ephemeral: true
    });
  } catch (error) {
    console.error("Failed to send message:", error);

    await interaction.reply({
      content: "❌ I couldn't send the message there. Check that I can view and send messages in that channel.",
      ephemeral: true
    });
  }
});

client.on("error", console.error);

client.login(TOKEN);
