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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Per-server runtime settings. Defaults are safe and require no hard-coded server name.
const settings = new Map();
const spamTracker = new Map();
const joinTracker = new Map();
const raidMode = new Set();

function getSettings(guildId) {
  if (!settings.has(guildId)) {
    settings.set(guildId, {
      antilink: true,
      antispam: true,
      antiraid: true,
      antimention: true,
      antiinvite: true,
      logs: null,
      warnings: new Map()
    });
  }
  return settings.get(guildId);
}

function isAdmin(member) {
  return member?.permissions.has(PermissionFlagsBits.Administrator);
}

function logChannel(guild) {
  const id = getSettings(guild.id).logs;
  return id ? guild.channels.cache.get(id) : null;
}

async function modLog(guild, text) {
  const channel = logChannel(guild);
  if (!channel?.isTextBased()) return;
  await channel.send({ content: text }).catch(() => {});
}

const commands = [
  new SlashCommandBuilder()
    .setName("hidem")
    .setDescription("Send a message as the bot to a selected channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addChannelOption(o => o.setName("channel").setDescription("Target channel.").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Message to send.").setRequired(true).setMaxLength(2000))
    .addStringOption(o => o.setName("password").setDescription("Password required to send.").setRequired(true).setMinLength(4).setMaxLength(4)),

  new SlashCommandBuilder().setName("warn").setDescription("Warn a member.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason.").setMaxLength(500).setRequired(true)),

  new SlashCommandBuilder().setName("warnings").setDescription("View a member's warnings.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true)),

  new SlashCommandBuilder().setName("clearwarnings").setDescription("Clear a member's warnings.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true)),

  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes.").setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason.").setMaxLength(500)),

  new SlashCommandBuilder().setName("kick").setDescription("Kick a member.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason.").setMaxLength(500)),

  new SlashCommandBuilder().setName("ban").setDescription("Ban a member.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason.").setMaxLength(500)),

  new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages.")
    .addIntegerOption(o => o.setName("amount").setDescription("1-100 messages.").setMinValue(1).setMaxValue(100).setRequired(true)),

  new SlashCommandBuilder().setName("lockdown").setDescription("Lock or unlock the current channel for regular members.")
    .addBooleanOption(o => o.setName("enabled").setDescription("Enable lockdown?").setRequired(true)),

  new SlashCommandBuilder().setName("setlogs").setDescription("Set the moderation log channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Log channel.").addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder().setName("config").setDescription("Configure security protection.")
    .addStringOption(o => o.setName("feature").setDescription("Feature.").setRequired(true)
      .addChoices(
        {name:"Anti-link",value:"antilink"},{name:"Anti-spam",value:"antispam"},
        {name:"Anti-raid",value:"antiraid"},{name:"Anti-mention",value:"antimention"},
        {name:"Anti-invite",value:"antiinvite"}
      ))
    .addBooleanOption(o => o.setName("enabled").setDescription("Enable?").setRequired(true)),

  new SlashCommandBuilder().setName("raidmode").setDescription("Manually enable or disable raid mode.")
    .addBooleanOption(o => o.setName("enabled").setDescription("Enable raid mode?").setRequired(true)),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information."),
  new SlashCommandBuilder().setName("userinfo").setDescription("Show information about a member.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true))
];

async function registerCommands() {
  const rest = new REST({version:"10"}).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands.map(c => c.toJSON())
  });
  console.log("Registered security/moderation commands.");
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try { await registerCommands(); } catch (e) { console.error("Command registration failed:", e); }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const guild = interaction.guild;
  if (!guild) return interaction.reply({content:"❌ This command can only be used in a server.",ephemeral:true});

  const s = getSettings(guild.id);
  const adminCommands = ["hidem","warn","clearwarnings","timeout","kick","ban","purge","lockdown","setlogs","config","raidmode"];
  if (adminCommands.includes(interaction.commandName) && !isAdmin(interaction.member)) {
    return interaction.reply({content:"❌ Administrator permission required.",ephemeral:true});
  }

  try {
    if (interaction.commandName === "hidem") {
      const channel = interaction.options.getChannel("channel",true);
      const message = interaction.options.getString("message",true);
      const password = interaction.options.getString("password",true);
      if (password !== HIDEM_PASSWORD) return interaction.reply({content:"❌ Wrong password.",ephemeral:true});
      await channel.send({content:message,allowedMentions:{parse:["users","roles","everyone"]}});
      return interaction.reply({content:`✅ Message sent in <#${channel.id}>.`,ephemeral:true});
    }

    if (interaction.commandName === "warn") {
      const user = interaction.options.getUser("user",true);
      const reason = interaction.options.getString("reason",true);
      if (!s.warnings.has(user.id)) s.warnings.set(user.id,[]);
      s.warnings.get(user.id).push({reason,by:interaction.user.id,at:Date.now()});
      await modLog(guild,`⚠️ <@${user.id}> was warned by <@${interaction.user.id}>: ${reason}`);
      return interaction.reply({content:`⚠️ <@${user.id}> has been warned.`,ephemeral:true});
    }

    if (interaction.commandName === "warnings") {
      const user = interaction.options.getUser("user",true);
      const list = s.warnings.get(user.id) || [];
      const text = list.length ? list.map((w,i)=>`${i+1}. ${w.reason}`).join("\n") : "No warnings.";
      return interaction.reply({content:`⚠️ Warnings for **${user.tag}**:\n${text}`,ephemeral:true});
    }

    if (interaction.commandName === "clearwarnings") {
      const user = interaction.options.getUser("user",true);
      s.warnings.delete(user.id);
      await modLog(guild,`🧹 Warnings cleared for <@${user.id}> by <@${interaction.user.id}>.`);
      return interaction.reply({content:"✅ Warnings cleared.",ephemeral:true});
    }

    if (interaction.commandName === "timeout") {
      const member = await guild.members.fetch(interaction.options.getUser("user",true).id);
      const minutes = interaction.options.getInteger("minutes",true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      if (!member.moderatable) return interaction.reply({content:"❌ I cannot timeout that member.",ephemeral:true});
      await member.timeout(minutes*60000,reason);
      await modLog(guild,`⏱️ <@${member.id}> timed out for ${minutes}m by <@${interaction.user.id}>: ${reason}`);
      return interaction.reply({content:`✅ <@${member.id}> timed out for ${minutes} minutes.`,ephemeral:true});
    }

    if (interaction.commandName === "kick" || interaction.commandName === "ban") {
      const user = interaction.options.getUser("user",true);
      const member = await guild.members.fetch(user.id).catch(()=>null);
      const reason = interaction.options.getString("reason") || "No reason provided";
      if (!member?.manageable) return interaction.reply({content:"❌ I cannot moderate that member.",ephemeral:true});
      if (interaction.commandName === "kick") await member.kick(reason);
      else await member.ban({reason});
      await modLog(guild,`${interaction.commandName === "kick" ? "👢" : "🔨"} <@${user.id}> ${interaction.commandName}ed by <@${interaction.user.id}>: ${reason}`);
      return interaction.reply({content:`✅ Member ${interaction.commandName}ed.`,ephemeral:true});
    }

    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount",true);
      if (!interaction.channel?.isTextBased()) return interaction.reply({content:"❌ Text channel only.",ephemeral:true});
      await interaction.deferReply({ephemeral:true});
      const deleted = await interaction.channel.bulkDelete(amount,true);
      return interaction.editReply(`🧹 Deleted ${deleted.size} messages.`);
    }

    if (interaction.commandName === "lockdown") {
      const enabled = interaction.options.getBoolean("enabled",true);
      await interaction.channel.permissionOverwrites.edit(guild.roles.everyone,{SendMessages:enabled ? false : null});
      return interaction.reply({content:enabled ? "🔒 Channel locked." : "🔓 Channel unlocked.",ephemeral:true});
    }

    if (interaction.commandName === "setlogs") {
      const channel = interaction.options.getChannel("channel",true);
      s.logs = channel.id;
      return interaction.reply({content:`✅ Logs set to <#${channel.id}>.`,ephemeral:true});
    }

    if (interaction.commandName === "config") {
      const feature = interaction.options.getString("feature",true);
      const enabled = interaction.options.getBoolean("enabled",true);
      s[feature] = enabled;
      return interaction.reply({content:`✅ ${feature} is now **${enabled ? "enabled" : "disabled"}**.`,ephemeral:true});
    }

    if (interaction.commandName === "raidmode") {
      const enabled = interaction.options.getBoolean("enabled",true);
      if (enabled) raidMode.add(guild.id); else raidMode.delete(guild.id);
      await modLog(guild,`${enabled ? "🚨" : "🟢"} Raid mode ${enabled ? "enabled" : "disabled"} by <@${interaction.user.id}>.`);
      return interaction.reply({content:enabled ? "🚨 Raid mode enabled." : "🟢 Raid mode disabled.",ephemeral:true});
    }

    if (interaction.commandName === "serverinfo") {
      return interaction.reply({content:`📊 **${guild.name}**\nMembers: ${guild.memberCount}\nChannels: ${guild.channels.cache.size}\nRoles: ${guild.roles.cache.size}`,ephemeral:true});
    }

    if (interaction.commandName === "userinfo") {
      const user = interaction.options.getUser("user",true);
      const member = await guild.members.fetch(user.id).catch(()=>null);
      return interaction.reply({content:`👤 **${user.tag}**\nID: ${user.id}\nJoined: ${member?.joinedAt ? member.joinedAt.toISOString() : "Unknown"}`,ephemeral:true});
    }
  } catch (error) {
    console.error("Command error:",error);
    if (interaction.replied || interaction.deferred) await interaction.editReply("❌ Something went wrong.").catch(()=>{});
    else await interaction.reply({content:"❌ Something went wrong.",ephemeral:true}).catch(()=>{});
  }
});

// Security message filters.
const linkRegex = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)[^\s<]+/i;

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  const s = getSettings(message.guild.id);
  if (isAdmin(message.member)) return;

  // Anti-link / Anti-invite.
  if ((s.antilink || s.antiinvite) && linkRegex.test(message.content)) {
    try { await message.delete(); } catch {}
    await modLog(message.guild,`🔗 Link removed from <@${message.author.id}> in <#${message.channel.id}>.`);
    return;
  }

  // Anti-mention spam.
  if (s.antimention && (message.mentions.users.size + message.mentions.roles.size >= 5 || message.mentions.everyone)) {
    try { await message.delete(); } catch {}
    await modLog(message.guild,`📢 Mention spam removed from <@${message.author.id}>.`);
    return;
  }

  // Anti-spam: 6 messages within 7 seconds.
  if (s.antispam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const arr = (spamTracker.get(key) || []).filter(t => now-t < 7000);
    arr.push(now);
    spamTracker.set(key,arr);
    if (arr.length >= 6) {
      try { await message.member.timeout(60000,"Anti-spam"); } catch {}
      await modLog(message.guild,`🚫 Anti-spam triggered for <@${message.author.id}>.`);
      spamTracker.set(key,[]);
    }
  }
});

// Anti-raid: 8 joins in 20 seconds -> raid mode.
client.on("guildMemberAdd", async member => {
  const s = getSettings(member.guild.id);
  if (!s.antiraid) return;
  const now = Date.now();
  const arr = (joinTracker.get(member.guild.id) || []).filter(t => now-t < 20000);
  arr.push(now);
  joinTracker.set(member.guild.id,arr);
  if (arr.length >= 8) {
    raidMode.add(member.guild.id);
    await modLog(member.guild,`🚨 Raid detected: ${arr.length} joins in 20 seconds. Raid mode enabled.`);
  }
  if (raidMode.has(member.guild.id)) {
    // Do not automatically punish users; raid mode is a protective state for admins to handle.
    await modLog(member.guild,`🛡️ Raid mode active while <@${member.id}> joined.`);
  }
});

client.on("error", console.error);
client.login(TOKEN);
