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
const HIDEM_PASSWORD = "3246";

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
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
  )
  .addStringOption(option =>
    option
      .setName("password")
      .setDescription("Password required to send the message.")
      .setRequired(true)
      .setMinLength(4)
      .setMaxLength(4)
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
  const password = interaction.options.getString("password", true);

  if (password !== HIDEM_PASSWORD) {
    return interaction.reply({
      content: "❌ Wrong password.",
      ephemeral: true
    });
  }

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

// Anti-link: normal members are blocked, Administrators are exempt.
const linkRegex = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)[^\s<]+/i;

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  // Administrators bypass Anti-link.
  if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

  if (!linkRegex.test(message.content)) return;

  try {
    await message.delete();

    await message.channel.send({
      content: `🚫 ${message.author}, links aren't allowed for regular members.`,
      allowedMentions: { users: [message.author.id] }
    }).then(sent => {
      setTimeout(() => sent.delete().catch(() => {}), 5000);
    });
  } catch (error) {
    console.error("Anti-link error:", error);
  }
});

client.on("error", console.error);

client.login(TOKEN);
