const { createClient } = require("@supabase/supabase-js");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionOverwrites
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const HIDEM_PASSWORD = "3246";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

if (!db) console.warn("Supabase persistence is disabled. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Railway.");

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Per-server runtime settings. Defaults are safe and require no hard-coded server name.
const settings = new Map();
const spamTracker = new Map();
const joinTracker = new Map();
const raidMode = new Set();
const dailyCooldown = new Map();
const serverStats = new Map();

// Invite tracking cache.
// The bot needs "Manage Server" permission to fetch invite usage.
const inviteCache = new Map();
const inviteCounts = new Map();

// XP / level system. Runtime only; resets if the bot restarts.
const levelData = new Map();
const levelCooldown = new Map();
const LEVEL_ROLES = [
  {level:5,name:"Novice",color:0x95A5A6,emoji:"🌱"},
  {level:10,name:"Arcane",color:0x3498DB,emoji:"🔮"},
  {level:20,name:"Mystic",color:0x9B59B6,emoji:"🌙"},
  {level:30,name:"Ascendant",color:0x1ABC9C,emoji:"⚡"},
  {level:50,name:"Celestial",color:0xF1C40F,emoji:"☀️"},
  {level:75,name:"Immortal",color:0xE67E22,emoji:"🔥"},
  {level:100,name:"Legend",color:0xE91E63,emoji:"👑"}
];

function getLevelInfo(guildId, userId) {
  const key = guildId + ":" + userId;
  const data = levelData.get(key) || {xp:0,level:1,roles:{}};
  levelData.set(key,data);
  return data;
}

function normalizeLogChannels(value) {
  if (!value) return {member:null, mod:null, server:null};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") return {
      member: parsed.member || null,
      mod: parsed.mod || null,
      server: parsed.server || null
    };
  } catch {}
  return {member:null, mod:value, server:null};
}

function serializeLogChannels(s) {
  return JSON.stringify(s.logChannels || {member:null, mod:s.logs || null, server:null});
}

function serializeWarnings(warnings) {
  return Object.fromEntries(warnings.entries());
}

function deserializeWarnings(value) {
  const map = new Map();
  if (!value || typeof value !== "object") return map;
  for (const [userId, list] of Object.entries(value)) {
    map.set(userId, Array.isArray(list) ? list : []);
  }
  return map;
}

async function loadPersistentData() {
  if (!db) return;

  const [settingsResult, levelsResult, invitesResult] = await Promise.all([
    db.from("discord_guild_settings").select("*"),
    db.from("discord_user_levels").select("*"),
    db.from("discord_invite_stats").select("*")
  ]);

  if (settingsResult.error) console.error("Failed to load guild settings:", settingsResult.error.message);
  else for (const row of settingsResult.data || []) {
    settings.set(row.guild_id, {
      antilink: row.antilink,
      antispam: row.antispam,
      antiraid: row.antiraid,
      antimention: row.antimention,
      antiinvite: row.antiinvite,
      antibot: row.antibot ?? false,
      logs: row.logs_channel_id,
      logChannels: normalizeLogChannels(row.logs_channel_id),
      welcome: row.welcome_channel_id,
      inviteLog: row.invite_log_channel_id,
      levelChannel: row.level_channel_id,
      warnings: deserializeWarnings(row.warnings)
    });
  }

  if (levelsResult.error) console.error("Failed to load level data:", levelsResult.error.message);
  else for (const row of levelsResult.data || []) {
    levelData.set(row.guild_id + ":" + row.user_id, {
      xp: Number(row.xp) || 0,
      level: Number(row.level) || 1,
      roles: row.roles && typeof row.roles === "object" ? row.roles : {}
    });
  }

  if (invitesResult.error) console.error("Failed to load invite stats:", invitesResult.error.message);
  else for (const row of invitesResult.data || []) {
    inviteCounts.set(row.guild_id + ":" + row.user_id, Number(row.invite_count) || 0);
  }

  console.log("Persistent bot data loaded from Supabase.");
}

async function saveGuildSettings(guildId) {
  if (!db) return;
  const s = getSettings(guildId);
  const { error } = await db.from("discord_guild_settings").upsert({
    guild_id: guildId,
    antilink: s.antilink,
    antispam: s.antispam,
    antiraid: s.antiraid,
    antimention: s.antimention,
    antiinvite: s.antiinvite,
    antibot: !!s.antibot,
    logs_channel_id: serializeLogChannels(s),
    welcome_channel_id: s.welcome,
    invite_log_channel_id: s.inviteLog,
    level_channel_id: s.levelChannel,
    warnings: serializeWarnings(s.warnings),
    updated_at: new Date().toISOString()
  });
  if (error) console.error("Failed to save guild settings:", error.message);
}

async function saveLevelData(guildId, userId) {
  if (!db) return;
  const data = getLevelInfo(guildId, userId);
  const { error } = await db.from("discord_user_levels").upsert({
    guild_id: guildId,
    user_id: userId,
    xp: data.xp,
    level: data.level,
    roles: data.roles,
    updated_at: new Date().toISOString()
  });
  if (error) console.error("Failed to save level data:", error.message);
}

async function saveInviteCount(guildId, userId) {
  if (!db) return;
  const key = guildId + ":" + userId;
  const { error } = await db.from("discord_invite_stats").upsert({
    guild_id: guildId,
    user_id: userId,
    invite_count: inviteCounts.get(key) || 0,
    updated_at: new Date().toISOString()
  });
  if (error) console.error("Failed to save invite count:", error.message);
}

async function getEconomy(guildId,userId){
  const fallback={balance:0,inventory:[]}; if(!db)return fallback;
  const {data,error}=await db.from("discord_economy").select("*").eq("guild_id",guildId).eq("user_id",userId).maybeSingle();
  if(error){console.error("Economy load failed:",error.message);return fallback;}
  return data?{balance:Number(data.balance)||0,inventory:Array.isArray(data.inventory)?data.inventory:[]}:fallback;
}
async function saveEconomy(guildId,userId,data){
  if(!db)return;
  const {error}=await db.from("discord_economy").upsert({guild_id:guildId,user_id:userId,balance:Math.max(0,Math.floor(data.balance||0)),inventory:Array.isArray(data.inventory)?data.inventory:[],updated_at:new Date().toISOString()});
  if(error)console.error("Economy save failed:",error.message);
}
async function addModCase(guildId,action,targetUserId,moderatorUserId,reason){
  if(!db)return null;
  const {data,error}=await db.from("discord_mod_cases").insert({guild_id:guildId,action,target_user_id:targetUserId,moderator_user_id:moderatorUserId,reason:reason||"No reason provided"}).select("case_id").single();
  if(error){console.error("Mod case save failed:",error.message);return null;} return data?.case_id||null;
}
const SHOP_ITEMS=[{id:"coffee",name:"☕ Coffee",price:100},{id:"cookie",name:"🍪 Cookie",price:250},{id:"gem",name:"💎 Gem",price:1000}];
function statBucket(guildId){if(!serverStats.has(guildId))serverStats.set(guildId,{messages:0,joins:0,leaves:0});return serverStats.get(guildId);}
function levelFromXP(xp) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

async function ensureLevelRole(guild, roleInfo, repair = false) {
  const me = guild.members.me;
  const highestBotPosition = me ? me.roles.highest.position : -1;

  let role = guild.roles.cache.find(r =>
    r.name === roleInfo.name &&
    !r.managed &&
    r.position < highestBotPosition
  );

  if (!role) {
    role = await guild.roles.create({
      name: roleInfo.name,
      color: roleInfo.color,
      reason: repair ? "Repair level system role" : "Level system role"
    }).catch(error => {
      console.error(`Could not create level role ${roleInfo.name}:`, error);
      return null;
    });

    if (role) {
      await role.edit({
        unicodeEmoji: roleInfo.emoji,
        reason: "Set level role icon"
      }).catch(error => {
        console.warn(`Could not set icon for ${roleInfo.name}:`, error.message);
      });
    }
  }

  if (role && repair) {
    // Color is intentionally edited separately from the icon.
    // Discord can reject role icons while still allowing role colors.
    await role.edit({
      color: roleInfo.color,
      reason: "Repair level role color"
    }).catch(error => {
      console.error(`Could not set color for ${roleInfo.name}:`, error.message);
    });

    await role.edit({
      unicodeEmoji: roleInfo.emoji,
      reason: "Repair level role icon"
    }).catch(error => {
      console.warn(`Could not set icon for ${roleInfo.name}:`, error.message);
    });
  }

  return role;
}

function findLevelSticker(guild, roleInfo) {
  const names = [
    `level-${roleInfo.level}`,
    `level ${roleInfo.level}`,
    roleInfo.name,
    roleInfo.name.toLowerCase(),
    `levelup-${roleInfo.level}`
  ];
  return guild.stickers.cache.find(sticker =>
    names.some(name => sticker.name.toLowerCase() === name.toLowerCase())
  ) || null;
}

async function applyLevelRole(member, level) {
  const data = getLevelInfo(member.guild.id, member.id);
  const unlocked = LEVEL_ROLES.filter(r => level >= r.level).sort((a,b) => b.level-a.level)[0];
  if (!unlocked) return null;
  const role = await ensureLevelRole(member.guild, unlocked);
  if (!role) return null;
  for (const r of LEVEL_ROLES) {
    const oldRole = member.guild.roles.cache.find(x => x.name === r.name && !x.managed);
    if (oldRole && oldRole.id !== role.id && member.roles.cache.has(oldRole.id)) await member.roles.remove(oldRole).catch(() => {});
  }
  await member.roles.add(role).catch(() => {});
  data.roles[level] = role.id;
  return role;
}

function getSettings(guildId) {
  if (!settings.has(guildId)) {
    settings.set(guildId, {
      antilink: true,
      antispam: true,
      antiraid: true,
      antimention: true,
      antiinvite: true,
      antibot: false,
      logs: null,
      logChannels: {member:null, mod:null, server:null},
      welcome: null,
      inviteLog: null,
      levelChannel: null,
      warnings: new Map()
    });
  }
  return settings.get(guildId);
}

function isAdmin(member) {
  return member?.permissions.has(PermissionFlagsBits.Administrator);
}

function logChannel(guild, type = "mod") {
  const s = getSettings(guild.id);
  const id = s.logChannels?.[type] || (type === "mod" ? s.logs : null);
  return id ? guild.channels.cache.get(id) : null;
}

function clipLogText(value, max = 900) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

async function modLog(guild, text, type = "mod") {
  const channel = logChannel(guild, type);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setDescription(text)
    .setColor(type === "mod" ? 0xFEE75C : type === "member" ? 0x57F287 : 0x5865F2)
    .setTimestamp();
  await channel.send({embeds:[embed]}).catch(() => {});
}

async function sendLogEmbed(guild, type, embed) {
  const channel = logChannel(guild, type);
  if (!channel?.isTextBased()) return;
  await channel.send({embeds:[embed]}).catch(() => {});
}

async function lockLogChannelToAdmins(channel, guild) {
  await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
    ViewChannel:false, SendMessages:false
  }).catch(() => {});
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.roles.everyone.id || role.managed) continue;
    await channel.permissionOverwrites.edit(role.id, {ViewChannel:false}).catch(() => {});
  }
  await channel.permissionOverwrites.edit(client.user.id, {
    ViewChannel:true, SendMessages:true, ReadMessageHistory:true, ManageChannels:true
  }).catch(() => {});
}

async function setupLogChannels(guild) {
  const categoryName = "📋・LOGS";
  let category = guild.channels.cache.find(ch =>
    ch.type === ChannelType.GuildCategory && ch.name === categoryName
  );
  if (!category) {
    category = await guild.channels.create({
      name:categoryName,
      type:ChannelType.GuildCategory,
      permissionOverwrites:[
        {id:guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel]},
        {id:client.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ManageChannels]}
      ],
      reason:"Create bot logs category"
    });
  }
  await lockLogChannelToAdmins(category, guild);

  const definitions = [
    {key:"member", name:"👤・member-logs"},
    {key:"mod", name:"🛡️・mod-logs"},
    {key:"server", name:"⚙️・server-logs"}
  ];
  const result = {};
  for (const def of definitions) {
    let channel = guild.channels.cache.find(ch =>
      ch.type === ChannelType.GuildText && ch.name === def.name
    );
    if (!channel) {
      channel = await guild.channels.create({
        name:def.name,
        type:ChannelType.GuildText,
        parent:category.id,
        permissionOverwrites:[
          {id:guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]},
          {id:client.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}
        ],
        reason:"Create bot log channel"
      });
    } else if (channel.parentId !== category.id) {
      await channel.setParent(category.id,{lockPermissions:false}).catch(() => {});
    }
    await lockLogChannelToAdmins(channel, guild);
    result[def.key] = channel.id;
  }
  const s = getSettings(guild.id);
  s.logChannels = result;
  s.logs = result.mod;
  await saveGuildSettings(guild.id);
  return result;
}

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const data = new Map();
    for (const invite of invites.values()) {
      data.set(invite.code, {
        uses: invite.uses || 0,
        inviterId: invite.inviter?.id || null
      });
    }
    inviteCache.set(guild.id, data);
  } catch (error) {
    console.warn(`Could not cache invites for ${guild.name}: ${error.message}`);
    console.warn("Invite tracking needs the bot to have Manage Server permission.");
  }
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

  new SlashCommandBuilder().setName("setup-logs").setDescription("Create and configure the private bot logs category and channels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString()),

  new SlashCommandBuilder().setName("setlogs").setDescription("Set the moderation log channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Log channel.").addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder().setName("setwelcome").setDescription("Set or disable the welcome channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Welcome channel.").addChannelTypes(ChannelType.GuildText).setRequired(false)),

  new SlashCommandBuilder().setName("invites").setDescription("Show invite statistics for a member.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true)),

  new SlashCommandBuilder().setName("setinvitelog").setDescription("Set or disable the invite tracker channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Invite log channel.").addChannelTypes(ChannelType.GuildText).setRequired(false)),

  new SlashCommandBuilder().setName("setlevelchannel").setDescription("Set or disable the Level Up channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addChannelOption(o => o.setName("channel").setDescription("Channel for Level Up messages.").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)),
    
  new SlashCommandBuilder().setName("levelset").setDescription("Set a member's level.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true))
    .addIntegerOption(o => o.setName("level").setDescription("New level.").setMinValue(1).setMaxValue(1000).setRequired(true)),

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

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Create a Ticket Tool-style ticket panel.")
    .addStringOption(o => o.setName("title").setDescription("Panel title.").setMaxLength(256))
    .addStringOption(o => o.setName("description").setDescription("Panel description.").setMaxLength(4000)),

  new SlashCommandBuilder().setName("rules").setDescription("Send the server rules to a selected channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addChannelOption(o => o.setName("channel").setDescription("Channel where the rules will be posted.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)),

  new SlashCommandBuilder().setName("levelsetup").setDescription("Create and enable the level-up roles.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString()),

  new SlashCommandBuilder().setName("setuplevel").setDescription("Create or repair the Level Up system.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addSubcommand(sub => sub.setName("repair").setDescription("Repair Level Up roles, colors, and icons.")),

  new SlashCommandBuilder().setName("rank").setDescription("Show a member's level and rank.").addUserOption(o=>o.setName("user").setDescription("Member.").setRequired(false)),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Show the server XP leaderboard."),
  new SlashCommandBuilder().setName("stats").setDescription("Show server statistics."),
  new SlashCommandBuilder().setName("cases").setDescription("Show moderation cases for a member.").setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString()).addUserOption(o=>o.setName("user").setDescription("Member.").setRequired(true)),
  new SlashCommandBuilder().setName("antibot").setDescription("Enable or disable automatic bot protection.").setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString()).addBooleanOption(o=>o.setName("enabled").setDescription("Enable?").setRequired(true)),
  new SlashCommandBuilder().setName("balance").setDescription("Show your server wallet.").addUserOption(o=>o.setName("user").setDescription("Member.").setRequired(false)),
  new SlashCommandBuilder().setName("daily").setDescription("Claim your daily server coins."),
  new SlashCommandBuilder().setName("pay").setDescription("Pay another member.").addUserOption(o=>o.setName("user").setDescription("Recipient.").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("Amount.").setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName("inventory").setDescription("Show your shop inventory.").addUserOption(o=>o.setName("user").setDescription("Member.").setRequired(false)),
  new SlashCommandBuilder().setName("shop").setDescription("Show the server shop."),
  new SlashCommandBuilder().setName("buy").setDescription("Buy an item.").addStringOption(o=>o.setName("item").setDescription("Item ID.").setRequired(true).addChoices(...SHOP_ITEMS.map(x=>({name:x.id,value:x.id})))),
  new SlashCommandBuilder().setName("coinflip").setDescription("Flip a virtual coin.").addStringOption(o=>o.setName("side").setDescription("Heads or tails.").setRequired(true).addChoices({name:"Heads",value:"heads"},{name:"Tails",value:"tails"})),
  new SlashCommandBuilder().setName("dice").setDescription("Roll a virtual six-sided die."),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information."),
  new SlashCommandBuilder().setName("userinfo").setDescription("Show information about a member.")
    .addUserOption(o => o.setName("user").setDescription("Member.").setRequired(true))
];

async function registerCommands() {
  const rest = new REST({version:"10"}).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands.map(c => c.toJSON())
  });
  console.log(`Registered ${commands.length} GLOBAL slash commands.`);
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await loadPersistentData();
  for (const guild of client.guilds.cache.values()) {
    await cacheGuildInvites(guild);
  }
  try { await registerCommands(); } catch (e) { console.error("Command registration failed:", e); }
});

client.on("inviteCreate", invite => {
  const guild = invite.guild;
  const current = inviteCache.get(guild.id) || new Map();
  current.set(invite.code, {uses: invite.uses || 0, inviterId: invite.inviter?.id || null});
  inviteCache.set(guild.id, current);
});

client.on("inviteDelete", invite => {
  const current = inviteCache.get(invite.guild.id);
  current?.delete(invite.code);
});

client.on("interactionCreate", async interaction => {
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({content:"❌ This can only be used in a server.",ephemeral:true});

    if ((interaction.isButton() && interaction.customId.startsWith("ticket_type:")) || (interaction.isStringSelectMenu() && interaction.customId === "ticket_type_select")) {
      const type = interaction.isStringSelectMenu() ? interaction.values[0] : interaction.customId.split(":")[1];
      const types = {
        support:{label:"Support",emoji:"🛠️",text:"Please describe your issue and our support team will assist you."},
        bug:{label:"Bug Report",emoji:"🐛",text:"Please describe the bug, steps to reproduce it, and what you expected to happen."},
        report:{label:"Report a User",emoji:"🚨",text:"Please provide the user and a clear description of the report."},
        partnership:{label:"Partnership",emoji:"🤝",text:"Please tell us about your partnership proposal."},
        other:{label:"Other",emoji:"❓",text:"Please describe what you need help with."}
      };
      const selected=types[type]||types.other;
      const existing=guild.channels.cache.find(ch=>ch.type===ChannelType.GuildText && ch.topic===`ticket-owner:${interaction.user.id}`);
      if(existing)return interaction.reply({content:`🎫 You already have an open ticket: <#${existing.id}>`,ephemeral:true});
      const channel=await guild.channels.create({
        name:`ticket-${type}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,12)||"user"}`,
        type:ChannelType.GuildText,
        topic:`ticket-owner:${interaction.user.id} | ticket-type:${type}`,
        permissionOverwrites:[
          {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
          {id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
          {id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}
        ]
      });
      const embed=new EmbedBuilder().setTitle(selected.emoji+" "+selected.label+" Ticket").setDescription("Hello <@"+interaction.user.id+">!\\n\\n"+selected.text).setColor(0x5865F2).setTimestamp();
      await channel.send({embeds:[embed],components:[new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setEmoji("🛡️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_close").setLabel("Close Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger)
      )]});
      await modLog(guild,`🎫 ${selected.label} ticket created: <#${channel.id}> by <@${interaction.user.id}>.`);
      return interaction.reply({content:`✅ ${selected.label} ticket created: <#${channel.id}>`,ephemeral:true});
    }

    if (interaction.customId === "ticket_create") {
      return interaction.reply({
        content:"🎫 **Choose your ticket type**",
        components:[new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId("ticket_type_select").setPlaceholder("Select a ticket type").addOptions(
            {label:"Support",value:"support",emoji:"🛠️",description:"General help and support"},
            {label:"Bug Report",value:"bug",emoji:"🐛",description:"Report a bug or technical issue"},
            {label:"Report a User",value:"report",emoji:"🚨",description:"Report a member or user"},
            {label:"Partnership",value:"partnership",emoji:"🤝",description:"Partnership and collaboration"},
            {label:"Other",value:"other",emoji:"❓",description:"Anything else"}
          )
        )],
        ephemeral:true
      });
    }


    if (interaction.customId === "ticket_claim") {
      if (!isAdmin(interaction.member)) return interaction.reply({content:"❌ Only staff with Administrator permission can claim tickets.",ephemeral:true});
      await interaction.reply({content:`🛡️ Ticket claimed by <@${interaction.user.id}>.`});
      await modLog(guild,`🛡️ Ticket <#${interaction.channel.id}> claimed by <@${interaction.user.id}>.`);
      return;
    }

    if (interaction.customId === "ticket_close") {
      const topic = interaction.channel?.topic || "";
      const ownerId = topic.startsWith("ticket-owner:") ? topic.slice("ticket-owner:".length) : null;
      if (!isAdmin(interaction.member) && interaction.user.id !== ownerId) {
        return interaction.reply({content:"❌ Only the ticket owner or an Administrator can close this ticket.",ephemeral:true});
      }

      await interaction.reply({content:"🔒 Ticket closing in 5 seconds..."});
      await modLog(guild,`🔒 Ticket <#${interaction.channel.id}> closed by <@${interaction.user.id}>.`);
      setTimeout(() => interaction.channel?.delete("Ticket closed").catch(() => {}),5000);
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;
  const guild = interaction.guild;
  if (!guild) return interaction.reply({content:"❌ This command can only be used in a server.",ephemeral:true});

  const s = getSettings(guild.id);
  const adminCommands = ["hidem","warn","clearwarnings","timeout","kick","ban","purge","lockdown","setup-logs","setlogs","setwelcome","setinvitelog","setlevelchannel","levelset","config","raidmode","ticketpanel","rules","levelsetup","setuplevel","cases","antibot"];
  if (adminCommands.includes(interaction.commandName) && !isAdmin(interaction.member)) {
    return interaction.reply({content:"❌ Administrator permission required.",ephemeral:true});
  }

  try {
    if (interaction.commandName === "ticketpanel") {
      const title = interaction.options.getString("title") || "🎫 Support Tickets";
      const description = interaction.options.getString("description") ||
        "Need help? Click the button below to create a private ticket.\n\nOur staff will assist you as soon as possible.";

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x5865F2)
        .setFooter({text:"Ticket System"});

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket_type_select")
          .setPlaceholder("🎫 Select a ticket type")
          .addOptions(
            {label:"Support",value:"support",emoji:"🛠️",description:"General help and support"},
            {label:"Bug Report",value:"bug",emoji:"🐛",description:"Report a bug or technical issue"},
            {label:"Report a User",value:"report",emoji:"🚨",description:"Report a member or user"},
            {label:"Partnership",value:"partnership",emoji:"🤝",description:"Partnership and collaboration"},
            {label:"Other",value:"other",emoji:"❓",description:"Anything else"}
          )
      );

      await interaction.channel.send({embeds:[embed],components:[row]});
      return interaction.reply({content:"✅ Ticket panel created.",ephemeral:true});
    }

    if (interaction.commandName === "setup-logs") {
      await interaction.deferReply({ephemeral:true});
      const channels = await setupLogChannels(guild);
      return interaction.editReply(
        "✅ **Log system created!**\n\n" +
        "👤 Member Logs: <#" + channels.member + ">\n" +
        "🛡️ Mod Logs: <#" + channels.mod + ">\n" +
        "⚙️ Server Logs: <#" + channels.server + ">"
      );
    }

    if (interaction.commandName === "setwelcome") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) {
        s.welcome = null;
        await saveGuildSettings(guild.id);
        return interaction.reply({content:"👋 Welcome messages disabled.",ephemeral:true});
      }
      s.welcome = channel.id;
      await saveGuildSettings(guild.id);
      const welcomePerms = channel.permissionsFor(client.user);
      const canWelcome = welcomePerms?.has(PermissionFlagsBits.ViewChannel) && welcomePerms?.has(PermissionFlagsBits.SendMessages);
      return interaction.reply({
        content:`✨ Welcome channel set to <#${channel.id}>.${canWelcome ? "" : "\n⚠️ I don't have View Channel + Send Messages permission there."}`,
        ephemeral:true
      });
    }

    if (interaction.commandName === "setinvitelog") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) {
        s.inviteLog = null;
        await saveGuildSettings(guild.id);
        return interaction.reply({content:"📨 Invite tracker disabled.",ephemeral:true});
      }
      s.inviteLog = channel.id;
      await saveGuildSettings(guild.id);
      return interaction.reply({content:`📨 Invite tracker channel set to <#${channel.id}>.`,ephemeral:true});
    }

    if (interaction.commandName === "setlevelchannel") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) {
        s.levelChannel = null;
        await saveGuildSettings(guild.id);
        return interaction.reply({content:"✨ Level Up messages will now appear in the channel where the level-up happens.",ephemeral:true});
      }
      s.levelChannel = channel.id;
      await saveGuildSettings(guild.id);
      return interaction.reply({content:`✨ Level Up channel set to <#${channel.id}>.`,ephemeral:true});
    }

    if (interaction.commandName === "invites") {
      const user = interaction.options.getUser("user",true);
      const key = `${guild.id}:${user.id}`;
      const count = inviteCounts.get(key) || 0;
      const embed = new EmbedBuilder()
        .setAuthor({name:user.tag,iconURL:user.displayAvatarURL({size:128})})
        .setTitle("📨 Invite Statistics")
        .setDescription(`<@${user.id}> has brought **${count}** member${count === 1 ? "" : "s"} to this server.`)
        .addFields(
          {name:"Total Invites",value:`${count}`,inline:true},
          {name:"Member",value:`<@${user.id}>`,inline:true}
        )
        .setThumbnail(user.displayAvatarURL({size:256}))
        .setColor(0x5865F2)
        .setFooter({text:guild.name})
        .setTimestamp();
      return interaction.reply({embeds:[embed]});
    }

    if (interaction.commandName === "rank") {
      const user=interaction.options.getUser("user")||interaction.user,data=getLevelInfo(guild.id,user.id);
      const rows=[...levelData.entries()].filter(([k])=>k.startsWith(guild.id+":")).sort((a,b)=>(b[1].xp||0)-(a[1].xp||0)),pos=rows.findIndex(([k])=>k.endsWith(":"+user.id))+1;
      return interaction.reply({embeds:[new EmbedBuilder().setTitle("🏆 RANK").setDescription("<@"+user.id+"> is **Level "+data.level+"**.").addFields({name:"XP",value:String(data.xp),inline:true},{name:"Server Rank",value:pos>0?"#"+pos:"Unranked",inline:true}).setColor(0x9B59B6)]});
    }
    if (interaction.commandName === "leaderboard") {
      const rows=[...levelData.entries()].filter(([k])=>k.startsWith(guild.id+":")).sort((a,b)=>(b[1].xp||0)-(a[1].xp||0)).slice(0,10);
      return interaction.reply({embeds:[new EmbedBuilder().setTitle("🏆 SERVER LEADERBOARD").setDescription(rows.length?rows.map(([k,d],i)=>"**"+(i+1)+".** <@"+k.split(":")[1]+"> — Level **"+d.level+"** • "+d.xp+" XP").join("\n"):"No ranked members yet.").setColor(0xF1C40F)]});
    }
    if (interaction.commandName === "stats") {
      const st=statBucket(guild.id);
      return interaction.reply({embeds:[new EmbedBuilder().setTitle("📊 SERVER STATS").addFields({name:"Members",value:String(guild.memberCount),inline:true},{name:"Channels",value:String(guild.channels.cache.size),inline:true},{name:"Roles",value:String(guild.roles.cache.size),inline:true},{name:"Messages Seen",value:String(st.messages),inline:true},{name:"Joins Seen",value:String(st.joins),inline:true},{name:"Leaves Seen",value:String(st.leaves),inline:true}).setColor(0x5865F2)]});
    }
    if (interaction.commandName === "cases") {
      const user=interaction.options.getUser("user",true); if(!db)return interaction.reply({content:"❌ Supabase persistence is not configured.",ephemeral:true});
      const {data,error}=await db.from("discord_mod_cases").select("*").eq("guild_id",guild.id).eq("target_user_id",user.id).order("created_at",{ascending:false}).limit(10);
      if(error)return interaction.reply({content:"❌ Could not load cases.",ephemeral:true});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle("🛡️ MODERATION CASES").setDescription((data||[]).map(c=>"**Case #"+c.case_id+"** — "+c.action+" — "+(c.reason||"No reason")).join("\n")||"No moderation cases.").setColor(0xED4245)],ephemeral:true});
    }
    if (interaction.commandName === "antibot") {
      s.antibot=interaction.options.getBoolean("enabled",true); await saveGuildSettings(guild.id);
      return interaction.reply({content:s.antibot?"🤖 Automatic bot protection enabled.":"🟢 Automatic bot protection disabled.",ephemeral:true});
    }
    if (interaction.commandName === "balance") {
      const user=interaction.options.getUser("user")||interaction.user,e=await getEconomy(guild.id,user.id);
      return interaction.reply({content:"💰 <@"+user.id+"> has **"+e.balance+"** coins."});
    }
    if (interaction.commandName === "daily") {
      const key=guild.id+":"+interaction.user.id,last=dailyCooldown.get(key)||0;
      if(Date.now()-last<86400000)return interaction.reply({content:"⏳ Daily already claimed. Try again tomorrow.",ephemeral:true});
      const e=await getEconomy(guild.id,interaction.user.id);e.balance+=500;dailyCooldown.set(key,Date.now());await saveEconomy(guild.id,interaction.user.id,e);
      return interaction.reply({content:"💰 You received **500** daily coins!"});
    }
    if (interaction.commandName === "pay") {
      const user=interaction.options.getUser("user",true),amount=interaction.options.getInteger("amount",true);
      if(user.bot||user.id===interaction.user.id)return interaction.reply({content:"❌ Invalid recipient.",ephemeral:true});
      const from=await getEconomy(guild.id,interaction.user.id);if(from.balance<amount)return interaction.reply({content:"❌ Not enough coins.",ephemeral:true});
      const to=await getEconomy(guild.id,user.id);from.balance-=amount;to.balance+=amount;await Promise.all([saveEconomy(guild.id,interaction.user.id,from),saveEconomy(guild.id,user.id,to)]);
      return interaction.reply({content:"💸 Paid **"+amount+"** coins to <@"+user.id+">."});
    }
    if (interaction.commandName === "shop") return interaction.reply({content:"🛒 "+SHOP_ITEMS.map(x=>x.id+" = "+x.price+" coins").join(" • ")});
    if (interaction.commandName === "buy") {
      const item=SHOP_ITEMS.find(x=>x.id===interaction.options.getString("item",true)),e=await getEconomy(guild.id,interaction.user.id);
      if(e.balance<item.price)return interaction.reply({content:"❌ Not enough coins.",ephemeral:true});
      e.balance-=item.price;e.inventory.push(item);await saveEconomy(guild.id,interaction.user.id,e);return interaction.reply({content:"🛒 Bought **"+item.name+"**."});
    }
    if (interaction.commandName === "inventory") {
      const user=interaction.options.getUser("user")||interaction.user,e=await getEconomy(guild.id,user.id);
      return interaction.reply({content:"🎒 "+(e.inventory.length?e.inventory.map(x=>x.name).join(", "):"Inventory is empty.")});
    }
    if (interaction.commandName === "coinflip") {
      const side=interaction.options.getString("side",true),result=Math.random()<0.5?"heads":"tails";
      return interaction.reply("🪙 Result: **"+result+"** — "+(side===result?"You won!":"You lost!"));
    }
    if (interaction.commandName === "dice") return interaction.reply("🎲 You rolled **"+(1+Math.floor(Math.random()*6))+"**.");

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
      await saveGuildSettings(guild.id);
      await addModCase(guild.id,"WARN",user.id,interaction.user.id,reason);
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
      await saveGuildSettings(guild.id);
      await modLog(guild,`🧹 Warnings cleared for <@${user.id}> by <@${interaction.user.id}>.`);
      return interaction.reply({content:"✅ Warnings cleared.",ephemeral:true});
    }

    if (interaction.commandName === "timeout") {
      const member = await guild.members.fetch(interaction.options.getUser("user",true).id);
      const minutes = interaction.options.getInteger("minutes",true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      if (!member.moderatable) return interaction.reply({content:"❌ I cannot timeout that member.",ephemeral:true});
      await member.timeout(minutes*60000,reason);
      await addModCase(guild.id,"TIMEOUT",member.id,interaction.user.id,reason);
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
      await addModCase(guild.id,interaction.commandName.toUpperCase(),user.id,interaction.user.id,reason);
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
      await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: enabled ? false : null,
        CreatePublicThreads: enabled ? false : null,
        CreatePrivateThreads: enabled ? false : null,
        SendMessagesInThreads: enabled ? false : null
      });
      return interaction.reply({content:enabled ? "🔒 Channel locked." : "🔓 Channel unlocked.",ephemeral:true});
    }

    if (interaction.commandName === "setlogs") {
      const channel = interaction.options.getChannel("channel",true);
      s.logs = channel.id;
      s.logChannels = s.logChannels || {member:null, mod:null, server:null};
      s.logChannels.mod = channel.id;
      await saveGuildSettings(guild.id);
      return interaction.reply({content:`✅ Mod logs set to <#${channel.id}>.`,ephemeral:true});
    }

    if (interaction.commandName === "config") {
      const feature = interaction.options.getString("feature",true);
      const enabled = interaction.options.getBoolean("enabled",true);
      s[feature] = enabled;
      await saveGuildSettings(guild.id);
      return interaction.reply({content:`✅ ${feature} is now **${enabled ? "enabled" : "disabled"}**.`,ephemeral:true});
    }

    if (interaction.commandName === "raidmode") {
      const enabled = interaction.options.getBoolean("enabled",true);
      if (enabled) raidMode.add(guild.id); else raidMode.delete(guild.id);
      await modLog(guild,`${enabled ? "🚨" : "🟢"} Raid mode ${enabled ? "enabled" : "disabled"} by <@${interaction.user.id}>.`);
      return interaction.reply({content:enabled ? "🚨 Raid mode enabled." : "🟢 Raid mode disabled.",ephemeral:true});
    }

    if (interaction.commandName === "setuplevel") {
      for (const roleInfo of LEVEL_ROLES) await ensureLevelRole(guild, roleInfo, true);
      return interaction.reply({content:"🔧✨ **Level system repaired!**\n\nAll Level roles were created/fixed with their colors and icons.",ephemeral:true});
    }
    
    if (interaction.commandName === "levelset") {
      const user = interaction.options.getUser("user", true);
      const level = interaction.options.getInteger("level", true);
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({content:"❌ I couldn't find that member in this server.",ephemeral:true});

      const data = getLevelInfo(guild.id, user.id);
      const oldLevel = data.level;
      data.level = level;
      data.xp = Math.max(0, (level - 1) * (level - 1) * 100);
      await saveLevelData(guild.id, user.id);

      const role = await applyLevelRole(member, level);
      const roleInfo = LEVEL_ROLES.filter(r => level >= r.level).sort((a,b) => b.level - a.level)[0];
      const settingsNow = getSettings(guild.id);
      const levelChannel = settingsNow.levelChannel ? guild.channels.cache.get(settingsNow.levelChannel) : null;
      const targetChannel = levelChannel?.isTextBased() ? levelChannel : null;

      await saveLevelData(guild.id, user.id);

      if (targetChannel) {
        const embed = new EmbedBuilder()
          .setTitle("✨ LEVEL SET!")
          .setDescription("<@" + user.id + "> level was set to **Level " + level + "** by <@" + interaction.user.id + ">!\n\n" +
            (role ? "🏷️ New role: <@&" + role.id + ">" : "No level role unlocked at this level."))
          .setColor(roleInfo?.color || 0x9B59B6)
          .setThumbnail(user.displayAvatarURL({size:256}))
          .setTimestamp();

        const sticker = roleInfo ? findLevelSticker(guild, roleInfo) : null;
        const payload = {embeds:[embed]};
        if (sticker) payload.stickers = [sticker];
        await targetChannel.send(payload).catch(() => {});
      }

      return interaction.reply({
        content:"✅ <@" + user.id + "> is now **Level " + level + "**. Old level: **" + oldLevel + "**." +
          (targetChannel ? "\n📢 Announced in <#" + targetChannel.id + ">." : "\n⚠️ No Level Up channel is configured."),
        ephemeral:true
      });
    }

    if (interaction.commandName === "levelsetup") {
      const created = [];
      for (const roleInfo of LEVEL_ROLES) {
        const role = await ensureLevelRole(guild, roleInfo);
        if (role) created.push(`<@&${role.id}> → Level ${roleInfo.level}`);
      }
      return interaction.reply({content:"✨ **Level system enabled!**\n\n" + created.join("\n") + "\n\nMembers earn XP from chatting and receive the matching role automatically.",ephemeral:true});
    }

    if (interaction.commandName === "rules") {
      const channel = interaction.options.getChannel("channel", true);
      const embed = new EmbedBuilder()
        .setAuthor({name:guild.name, iconURL:guild.iconURL({size:128}) || undefined})
        .setTitle("📜 SERVER RULES")
        .setDescription("━━━━━━━━━━━━━━━━━━━━\n1️⃣ **Respect** — Treat everyone with respect.\n2️⃣ **No Spam** — No message, emoji, or mention spam.\n3️⃣ **No Advertising** — No ads without staff permission.\n4️⃣ **Keep It Appropriate** — Follow Discord rules and keep the server appropriate.\n5️⃣ **No Raiding** — No raids or intentional disruption.\n6️⃣ **Right Channels** — Use channels for their intended purpose.\n7️⃣ **Follow Staff** — Respect staff instructions.\n8️⃣ **No Exploits/Scams** — No malicious files, scams, or harmful content.\n━━━━━━━━━━━━━━━━━━━━")
        .setColor(0x5865F2)
        .setFooter({text:"By staying in this server, you agree to follow these rules."})
        .setTimestamp();
      await channel.send({embeds:[embed]});
      return interaction.reply({content:"✅ Rules panel sent to <#" + channel.id + ">.",ephemeral:true});
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
  statBucket(message.guild.id).messages++;

  // Leveling: one XP gain per user every 10 seconds.
  const xpKey = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (!levelCooldown.has(xpKey) || now - levelCooldown.get(xpKey) >= 10000) {
    levelCooldown.set(xpKey, now);
    const data = getLevelInfo(message.guild.id, message.author.id);
    const oldLevel = data.level;
    data.xp += 15 + Math.floor(Math.random() * 11);
    data.level = levelFromXP(data.xp);
    await saveLevelData(message.guild.id, message.author.id);
    if (data.level > oldLevel) {
      const role = await applyLevelRole(message.member, data.level);
      const embed = new EmbedBuilder()
        .setTitle("✨ LEVEL UP!")
        .setDescription(`<@${message.author.id}> reached **Level ${data.level}**!\n\n${role ? `🏷️ New role: <@&${role.id}>` : "Keep chatting to unlock your next rank!"}`)
        .setColor(0x9B59B6)
        .setThumbnail(message.author.displayAvatarURL({size:256}))
        .setTimestamp();
      const levelChannel = s.levelChannel ? message.guild.channels.cache.get(s.levelChannel) : null;
      const targetChannel = levelChannel?.isTextBased() ? levelChannel : message.channel;
      const levelInfo = LEVEL_ROLES.find(r => data.level >= r.level && r.level === data.level)
        || LEVEL_ROLES.filter(r => data.level >= r.level).sort((a,b) => b.level - a.level)[0];
      const sticker = levelInfo ? findLevelSticker(message.guild, levelInfo) : null;

      const payload = {embeds:[embed]};
      if (sticker) payload.stickers = [sticker];
      await targetChannel.send(payload).catch(() => {});
    }
  }

  if (isAdmin(message.member)) return;

  // Anti-link / Anti-invite.
  if ((s.antilink || s.antiinvite) && linkRegex.test(message.content)) {
    try { await message.delete(); } catch {}
    await modLog(message.guild,`🔗 Link removed from <@${message.author.id}> in <#${message.channel.id}>.`,`server`);
    return;
  }

  // Anti-mention spam.
  if (s.antimention && (message.mentions.users.size + message.mentions.roles.size >= 5 || message.mentions.everyone)) {
    try { await message.delete(); } catch {}
    await modLog(message.guild,`📢 Mention spam removed from <@${message.author.id}>.`,`server`);
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
      await modLog(message.guild,`🚫 Anti-spam triggered for <@${message.author.id}>.`,`server`);
      spamTracker.set(key,[]);
    }
  }
});

// Anti-raid + welcome + invite tracking.
client.on("guildMemberAdd", async member => {
  const s = getSettings(member.guild.id);
  statBucket(member.guild.id).joins++;
  if(member.user.bot && s.antibot && member.id !== client.user.id){ await addModCase(member.guild.id,"AUTO_BOT",member.id,client.user.id,"Automatic bot-account protection"); await member.kick("Automatic bot-account protection").catch(()=>{}); return; }
  if(s.antiraid && Date.now()-member.user.createdTimestamp<86400000) await modLog(member.guild,"⚠️ New account joined: <@"+member.id+"> (under 24h old).","server");

  // Determine which invite was used by comparing cached usage counts.
  let usedInvite = null;
  try {
    const oldInvites = inviteCache.get(member.guild.id) || new Map();
    const newInvites = await member.guild.invites.fetch();

    for (const invite of newInvites.values()) {
      const old = oldInvites.get(invite.code);
      if (invite.uses > (old?.uses || 0)) {
        usedInvite = invite;
        break;
      }
    }

    const updated = new Map();
    for (const invite of newInvites.values()) {
      updated.set(invite.code, {
        uses: invite.uses || 0,
        inviterId: invite.inviter?.id || null
      });
    }
    inviteCache.set(member.guild.id, updated);
  } catch (error) {
    console.warn(`Invite detection failed for ${member.guild.name}:`, error.message);
  }

  if (usedInvite?.inviter) {
    const key = `${member.guild.id}:${usedInvite.inviter.id}`;
    inviteCounts.set(key, (inviteCounts.get(key) || 0) + 1);
    await saveInviteCount(member.guild.id, usedInvite.inviter.id);
  }

  // Beautiful welcome embed.
  if (s.welcome) {
    const channel = member.guild.channels.cache.get(s.welcome);
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setAuthor({
          name: member.guild.name,
          iconURL: member.guild.iconURL({size:128}) || undefined
        })
        .setTitle("✨ Welcome to the server!")
        .setDescription(
          `Hey <@${member.id}>! 👋\n\n` +
          `We're happy to have you here. You are member **#${member.guild.memberCount}**!\n\n` +
          `📅 Account created: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`
        )
        .setThumbnail(member.user.displayAvatarURL({size:512}))
        .setColor(0x5865F2)
        .setFooter({
          text: usedInvite?.inviter ? `Invited by ${usedInvite.inviter.tag}` : "Enjoy your stay! 💜"
        })
        .setTimestamp();

      await channel.send({
        content: `Welcome <@${member.id}>! 🎉`,
        embeds: [embed]
      }).catch(error => console.error(`Welcome message failed in ${channel.name}:`, error.message));
    }
  }

  if (s.antiraid) {
    const now = Date.now();
    const arr = (joinTracker.get(member.guild.id) || []).filter(t => now-t < 20000);
    arr.push(now);
    joinTracker.set(member.guild.id,arr);
    if (arr.length >= 8) {
      raidMode.add(member.guild.id);
      await modLog(member.guild,`🚨 Raid detected: ${arr.length} joins in 20 seconds. Raid mode enabled.`,`server`);
    }
  }

  if (raidMode.has(member.guild.id)) {
    await modLog(member.guild,`🛡️ Raid mode active while <@${member.id}> joined.`,`server`);
  }

  if (usedInvite?.inviter) {
    const inviterKey = `${member.guild.id}:${usedInvite.inviter.id}`;
    const totalInvites = inviteCounts.get(inviterKey) || 0;
    const inviteLog = s.inviteLog ? member.guild.channels.cache.get(s.inviteLog) : null;

    if (inviteLog?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setAuthor({name: usedInvite.inviter.tag, iconURL: usedInvite.inviter.displayAvatarURL({size:128})})
        .setDescription(`👤 <@${usedInvite.inviter.id}> invited <@${member.id}>\n\n✨ **Now has ${totalInvites} invite${totalInvites === 1 ? "" : "s"}**`)
        .setThumbnail(member.user.displayAvatarURL({size:256}))
        .setColor(0x57F287)
        .setFooter({text:`Invite: ${usedInvite.code}`})
        .setTimestamp();
      await inviteLog.send({embeds:[embed]}).catch(() => {});
    }

    await modLog(member.guild,`📨 <@${member.id}> joined using an invite from <@${usedInvite.inviter.id}> (${usedInvite.code}).`,`member`);
  }
});


// Three-channel audit logging.
client.on("guildMemberAdd", async member => {
  await sendLogEmbed(member.guild,"member",new EmbedBuilder()
    .setTitle("👤 MEMBER JOINED")
    .setDescription("<@" + member.id + "> joined the server.")
    .addFields(
      {name:"User",value:"<@" + member.id + "> (" + member.user.tag + ")",inline:true},
      {name:"Member Count",value:String(member.guild.memberCount),inline:true}
    )
    .setThumbnail(member.user.displayAvatarURL({size:256}))
    .setColor(0x57F287).setTimestamp());
});

client.on("guildMemberRemove", async member => {
  statBucket(member.guild.id).leaves++;
  await sendLogEmbed(member.guild,"member",new EmbedBuilder()
    .setTitle("👋 MEMBER LEFT")
    .setDescription("<@" + member.id + "> left the server.")
    .addFields({name:"User",value:member.user?.tag || member.id})
    .setColor(0xED4245).setTimestamp());
});

client.on("messageDelete", async message => {
  if (!message.guild || message.author?.bot) return;
  await sendLogEmbed(message.guild,"server",new EmbedBuilder()
    .setTitle("🗑️ MESSAGE DELETED")
    .setDescription("A message was deleted in <#" + message.channel.id + ">.")
    .addFields(
      {name:"Author",value:"<@" + (message.author?.id || "unknown") + ">",inline:true},
      {name:"Content",value:clipLogText(message.content || "Content unavailable.")}
    )
    .setColor(0xED4245).setTimestamp());
});

client.on("messageUpdate", async (oldMessage,newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if ((oldMessage.content || "") === (newMessage.content || "")) return;
  await sendLogEmbed(newMessage.guild,"server",new EmbedBuilder()
    .setTitle("✏️ MESSAGE EDITED")
    .setDescription("A message was edited in <#" + newMessage.channel.id + ">.")
    .addFields(
      {name:"Author",value:"<@" + (newMessage.author?.id || "unknown") + ">",inline:true},
      {name:"Before",value:clipLogText(oldMessage.content || "Unavailable.")},
      {name:"After",value:clipLogText(newMessage.content || "Unavailable.")}
    )
    .setColor(0xFEE75C).setTimestamp());
});

client.on("channelCreate", async channel => {
  if (channel.guild) await modLog(channel.guild,"📁 Channel created: <#" + channel.id + "> (" + channel.name + ").","server");
});
client.on("channelDelete", async channel => {
  if (channel.guild) await modLog(channel.guild,"🗑️ Channel deleted: **" + channel.name + "**.","server");
});
client.on("channelUpdate", async (oldChannel,newChannel) => {
  if (!newChannel.guild) return;
  if (oldChannel.name === newChannel.name && oldChannel.topic === newChannel.topic) return;
  await modLog(newChannel.guild,"✏️ Channel updated: <#" + newChannel.id + ">. " + oldChannel.name + " → " + newChannel.name,"server");
});
client.on("roleCreate", async role => {
  if (!role.managed) await modLog(role.guild,"🎭 Role created: <@&" + role.id + ">.","server");
});
client.on("roleDelete", async role => {
  if (!role.managed) await modLog(role.guild,"🗑️ Role deleted: **" + role.name + "**.","server");
});
client.on("roleUpdate", async (oldRole,newRole) => {
  if (!newRole.managed && (oldRole.name !== newRole.name || oldRole.color !== newRole.color)) {
    await modLog(newRole.guild,"✏️ Role updated: **" + oldRole.name + "** → **" + newRole.name + "**.","server");
  }
});


// Extra audit events.
client.on("guildBanAdd", async ban => {
  await sendLogEmbed(ban.guild,"mod",new EmbedBuilder().setTitle("🔨 MEMBER BANNED")
    .setDescription("<@" + ban.user.id + "> was banned.").addFields({name:"User",value:ban.user.tag || ban.user.id})
    .setColor(0xED4245).setTimestamp());
});
client.on("guildBanRemove", async ban => {
  await sendLogEmbed(ban.guild,"mod",new EmbedBuilder().setTitle("🔓 MEMBER UNBANNED")
    .setDescription("<@" + ban.user.id + "> was unbanned.").addFields({name:"User",value:ban.user.tag || ban.user.id})
    .setColor(0x57F287).setTimestamp());
});
client.on("guildMemberUpdate", async (oldMember,newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    await sendLogEmbed(newMember.guild,"member",new EmbedBuilder().setTitle("✏️ NICKNAME CHANGED")
      .setDescription("<@" + newMember.id + "> changed nickname.")
      .addFields({name:"Before",value:oldMember.nickname || "None",inline:true},{name:"After",value:newMember.nickname || "None",inline:true})
      .setColor(0x5865F2).setTimestamp());
  }
  const oldRoles=new Set(oldMember.roles.cache.keys());
  const newRoles=new Set(newMember.roles.cache.keys());
  const added=[...newMember.roles.cache.values()].find(r=>!oldRoles.has(r.id));
  const removed=[...oldMember.roles.cache.values()].find(r=>!newRoles.has(r.id));
  if (added && !added.managed) await sendLogEmbed(newMember.guild,"member",new EmbedBuilder().setTitle("🏷️ ROLE ADDED")
    .setDescription("<@"+newMember.id+"> received <@&"+added.id+">.").setColor(0x57F287).setTimestamp());
  if (removed && !removed.managed) await sendLogEmbed(newMember.guild,"member",new EmbedBuilder().setTitle("🏷️ ROLE REMOVED")
    .setDescription("<@"+newMember.id+"> lost **"+removed.name+"**.").setColor(0xED4245).setTimestamp());
  if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
    const active=!!newMember.communicationDisabledUntilTimestamp;
    await sendLogEmbed(newMember.guild,"mod",new EmbedBuilder().setTitle(active ? "🔇 TIMEOUT ADDED" : "🔊 TIMEOUT REMOVED")
      .setDescription("<@"+newMember.id+"> was "+(active?"timed out.":"untimed out.")).setColor(active?0xED4245:0x57F287).setTimestamp());
  }
});
client.on("voiceStateUpdate", async (oldState,newState) => {
  if (!oldState.channelId && newState.channelId)
    await sendLogEmbed(newState.guild,"member",new EmbedBuilder().setTitle("🔊 VOICE JOIN")
      .setDescription("<@"+newState.id+"> joined <#"+newState.channelId+">.").setColor(0x57F287).setTimestamp());
  else if (oldState.channelId && !newState.channelId)
    await sendLogEmbed(newState.guild,"member",new EmbedBuilder().setTitle("🔇 VOICE LEAVE")
      .setDescription("<@"+newState.id+"> left <#"+oldState.channelId+">.").setColor(0xED4245).setTimestamp());
  else if (oldState.channelId !== newState.channelId)
    await sendLogEmbed(newState.guild,"member",new EmbedBuilder().setTitle("🔀 VOICE MOVE")
      .setDescription("<@"+newState.id+"> moved <#"+oldState.channelId+"> → <#"+newState.channelId+">.").setColor(0x5865F2).setTimestamp());
});
client.on("threadCreate", async thread => {
  await sendLogEmbed(thread.guild,"server",new EmbedBuilder().setTitle("🧵 THREAD CREATED")
    .setDescription("Thread <#"+thread.id+"> was created.").setColor(0x5865F2).setTimestamp());
});
client.on("threadDelete", async thread => {
  await sendLogEmbed(thread.guild,"server",new EmbedBuilder().setTitle("🧵 THREAD DELETED")
    .setDescription("Thread **"+thread.name+"** was deleted.").setColor(0xED4245).setTimestamp());
});

client.on("error", console.error);
client.login(TOKEN);
