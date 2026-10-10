const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");

const configs = new Map();
const applications = new Map();
const sessions = new Map();
const cooldowns = new Map();
let nextId = 1000;

const QUESTIONS = [
  ["Introduction", "Tell us a little about yourself. What should the staff team know about you?"],
  ["Motivation", "Why do you want to become a Trial Moderator in this server?"],
  ["Experience", "Have you moderated a Discord server before? If yes, what did you learn? If not, how would you prepare?"],
  ["Availability", "What timezone are you in, and roughly how many hours per week can you be active?"],
  ["Rule enforcement", "A member keeps spamming after being warned. What steps would you take, and why?"],
  ["Conflict handling", "Two members are arguing and both report each other. How would you investigate and handle it fairly?"],
  ["Friend breaks a rule", "Your friend breaks a server rule. What would you do? Would your answer change if they asked you not to punish them?"],
  ["Staff misconduct", "You believe another moderator is abusing their permissions. What would you do, and what would you avoid doing?"],
  ["Safety & evidence", "A member reports serious harassment but gives you very little evidence. How would you respond while protecting their privacy?"],
  ["Final question", "Why should we choose you, and what is one area of moderation you still want to improve?"]
];

const commands = [
  new SlashCommandBuilder().setName("tmps").setDescription("Set up and manage Trial Moderator applications.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addSubcommand(s => s.setName("setup").setDescription("Configure the application system and post its panel.")
      .addRoleOption(o => o.setName("trial_role").setDescription("Role granted when an applicant is accepted.").setRequired(true))
      .addRoleOption(o => o.setName("review_role").setDescription("Optional role allowed to review applications."))
      .addChannelOption(o => o.setName("review_channel").setDescription("Existing private review channel; leave empty to create one.").addChannelTypes(ChannelType.GuildText))
      .addChannelOption(o => o.setName("panel_channel").setDescription("Channel for the public application panel; defaults to this channel.").addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("panel").setDescription("Post another copy of the application panel.")
      .addChannelOption(o => o.setName("channel").setDescription("Channel for the panel; defaults to this channel.").addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("stats").setDescription("View Trial Moderator application statistics."))
    .addSubcommand(s => s.setName("status").setDescription("Show the current application configuration."))
];

function isAdmin(i) { return i.memberPermissions && i.memberPermissions.has(PermissionFlagsBits.Administrator); }
function canReview(i, c) { return !!(isAdmin(i) || (c && c.reviewRoleId && i.member && i.member.roles.cache.has(c.reviewRoleId))); }

function panelPayload() {
  return {
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("🛡️ Trial Moderator Applications")
      .setDescription("Think you have what it takes to help keep our community safe, fair, and welcoming?\n\n" +
        "We're looking for responsible, calm, active members who follow the rules and treat everyone fairly.\n\n" +
        "**Before you apply:**\n• Answer honestly and in your own words.\n• You will answer **10 questions in the bot's DMs**.\n" +
        "• Type **skip** to skip a question, **back** to return to the previous question, or **cancel** to stop.\n" +
        "• Staff decisions are based on your answers and the needs of the server.\n\nReady to apply? Press the button below!")
      .setFooter({text:"Trial Moderator Recruitment • One active application per member"}).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("tmps:start").setLabel("Start Application").setEmoji("📝").setStyle(ButtonStyle.Primary))]
  };
}

function reviewPayload(app) {
  const embed = new EmbedBuilder().setColor(app.status === "accepted" ? 0x57F287 : app.status === "rejected" ? 0xED4245 : 0xFEE75C)
    .setTitle("🛡️ Trial Moderator Application • " + app.id)
    .setDescription("**Applicant:** <@" + app.userId + "> (" + app.userTag + ")\n**Status:** " + app.status.toUpperCase() +
      "\n**Submitted:** <t:" + Math.floor(app.createdAt / 1000) + ":F>")
    .setFooter({text:"Review fairly • Keep applicant answers private"}).setTimestamp(new Date(app.createdAt));
  if (app.avatar) embed.setThumbnail(app.avatar);
  QUESTIONS.forEach((q, i) => {
    const answer = app.answers[i] || "*Skipped*";
    embed.addFields({name:(i + 1) + ". " + q[0], value:answer.length > 1000 ? answer.slice(0,997) + "..." : answer});
  });
  const scoreEntries = Object.entries(app.scores || {});
  if (scoreEntries.length) embed.addFields({name:"📊 Staff evaluations",value:scoreEntries.map(x => "<@" + x[0] + "> — **" + x[1] + "/5**").join("\n").slice(0,1000)});
  if (app.decisionBy) embed.addFields({name:"Decision",value:"**" + app.status.toUpperCase() + "** by <@" + app.decisionBy + ">"});
  const components = [];
  if (app.status === "pending") {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("tmps:accept:" + app.id).setLabel("Accept").setEmoji("✅").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("tmps:reject:" + app.id).setLabel("Reject").setEmoji("❌").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("tmps:interview:" + app.id).setLabel("Request Interview").setEmoji("🎤").setStyle(ButtonStyle.Secondary)
    ));
    components.push(new ActionRowBuilder().addComponents([1,2,3,4,5].map(n =>
      new ButtonBuilder().setCustomId("tmps:score:" + app.id + ":" + n).setLabel(String(n)).setStyle(ButtonStyle.Secondary)
    )));
  }
  return {embeds:[embed],components};
}

async function sendDM(user, payload) {
  try { await user.send(payload); return true; } catch { return false; }
}
async function askQuestion(user, session) {
  const q = QUESTIONS[session.index];
  return user.send({embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle("📝 Trial Moderator Application")
    .setDescription("**Question " + (session.index + 1) + " of " + QUESTIONS.length + " — " + q[0] + "**\n\n" + q[1] +
      "\n\nReply with your answer below.\n\nType **skip** to skip · **back** to go back · **cancel** to cancel")
    .setFooter({text:"Your answers are sent privately to the server's authorized review team."})]});
}
async function createReviewChannel(guild, reviewRoleId) {
  const me = guild.members.me || await guild.members.fetchMe();
  const overwrites = [
    {id:guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel]},
    {id:me.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}
  ];
  if (reviewRoleId) overwrites.push({id:reviewRoleId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.roles.everyone.id || role.id === reviewRoleId || role.managed) continue;
    if (role.permissions.has(PermissionFlagsBits.Administrator)) overwrites.push({id:role.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
  }
  return guild.channels.create({name:"trial-mod-applications",type:ChannelType.GuildText,
    topic:"Private Trial Moderator application reviews. Keep applicant information confidential.",
    permissionOverwrites:overwrites,reason:"Set up Trial Moderator application review channel"});
}

async function handleInteraction(i) {
  if (i.isChatInputCommand() && i.commandName === "tmps") {
    if (!isAdmin(i)) { await i.reply({content:"❌ Only server administrators can configure this system.",ephemeral:true}); return true; }
    const guild=i.guild, sub=i.options.getSubcommand();
    if (!guild) { await i.reply({content:"Use this command inside a server.",ephemeral:true}); return true; }
    if (sub === "setup") {
      await i.deferReply({ephemeral:true});
      const trialRole=i.options.getRole("trial_role",true), reviewRole=i.options.getRole("review_role");
      const botMember=guild.members.me || await guild.members.fetchMe();
      if (trialRole.managed || trialRole.position >= botMember.roles.highest.position) {
        await i.editReply("❌ I can't assign that role. Move my highest role above the Trial Moderator role and make sure it isn't integration-managed."); return true;
      }
      let reviewChannel=i.options.getChannel("review_channel");
      if (!reviewChannel) {
        try { reviewChannel=await createReviewChannel(guild,reviewRole ? reviewRole.id : null); }
        catch (e) { console.error("TMPS channel creation failed:",e); await i.editReply("❌ I couldn't create the private review channel. Give me **Manage Channels**, **View Channels**, and **Send Messages** permissions."); return true; }
      } else if (reviewRole) {
        await reviewChannel.permissionOverwrites.edit(reviewRole.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}).catch(()=>{});
      }
      configs.set(guild.id,{trialRoleId:trialRole.id,reviewRoleId:reviewRole ? reviewRole.id : null,reviewChannelId:reviewChannel.id,configuredBy:i.user.id});
      const panelChannel=i.options.getChannel("panel_channel") || i.channel;
      const panelSent=!!(panelChannel && await panelChannel.send(panelPayload()).then(()=>true).catch(()=>false));
      await i.editReply("✅ **Trial Moderator Applications are ready!**\n\n• Trial role: <@&" + trialRole.id + ">\n• Review channel: <#" + reviewChannel.id + ">\n• Reviewer role: " + (reviewRole ? "<@&" + reviewRole.id + ">" : "Server administrators") +
        "\n• Panel posted: " + (panelSent ? "<#" + panelChannel.id + ">" : "No — check my channel permissions") +
        "\n\nAll questions and texts are pre-written. Applicants answer in my DMs.");
      return true;
    }
    if (sub === "panel") {
      if (!configs.has(guild.id)) { await i.reply({content:"❌ Run /tmps setup first.",ephemeral:true}); return true; }
      const channel=i.options.getChannel("channel") || i.channel;
      const ok=await channel.send(panelPayload()).then(()=>true).catch(()=>false);
      await i.reply({content:ok ? "✅ Panel posted in <#" + channel.id + ">." : "❌ I couldn't post there. Check channel permissions.",ephemeral:true}); return true;
    }
    if (sub === "status") {
      const c=configs.get(guild.id);
      await i.reply({content:c ? "🛡️ **TMPS is configured.**\nTrial role: <@&" + c.trialRoleId + ">\nReview channel: <#" + c.reviewChannelId + ">\nReviewer role: " + (c.reviewRoleId ? "<@&" + c.reviewRoleId + ">" : "Server administrators") : "TMPS isn't configured yet. Run /tmps setup.",ephemeral:true});
      return true;
    }
    if (sub === "stats") {
      const list=[...applications.values()].filter(a=>a.guildId===guild.id);
      await i.reply({embeds:[new EmbedBuilder().setTitle("📊 Trial Moderator Application Statistics").setColor(0x5865F2)
        .addFields({name:"Total",value:String(list.length),inline:true},
          {name:"Pending",value:String(list.filter(a=>a.status==="pending").length),inline:true},
          {name:"Accepted",value:String(list.filter(a=>a.status==="accepted").length),inline:true},
          {name:"Rejected",value:String(list.filter(a=>a.status==="rejected").length),inline:true})
        .setFooter({text:"Statistics are available while the bot process is running."})],ephemeral:true}); return true;
    }
  }

  if (i.isButton() && i.customId === "tmps:start") {
    const guildId=i.guildId, config=configs.get(guildId);
    if (!config) { await i.reply({content:"❌ Applications aren't configured yet. Please notify the staff team.",ephemeral:true}); return true; }
    const key=guildId + ":" + i.user.id;
    const active=[...applications.values()].find(a=>a.guildId===guildId && a.userId===i.user.id && a.status==="pending");
    if (active || sessions.has(key)) { await i.reply({content:"📝 You already have an application in progress or awaiting review.",ephemeral:true}); return true; }
    const cd=cooldowns.get(key);
    if (cd && Date.now()-cd < 7*24*60*60*1000) { await i.reply({content:"⏳ You can apply again 7 days after the last decision.",ephemeral:true}); return true; }
    const session={guildId,userId:i.user.id,reviewChannelId:config.reviewChannelId,index:0,answers:[],createdAt:Date.now(),userTag:i.user.tag,avatar:i.user.displayAvatarURL({size:256})};
    const dm=await i.user.createDM().catch(()=>null);
    if (!dm) { await i.reply({content:"❌ I couldn't open your DMs. Enable direct messages from server members and try again.",ephemeral:true}); return true; }
    sessions.set(key,session);
    await i.reply({content:"📬 I've sent you a DM to start the application. Check your inbox!",ephemeral:true});
    try { await askQuestion(dm,session); }
    catch { sessions.delete(key); await i.followUp({content:"❌ I couldn't DM you. Check your privacy settings and try again.",ephemeral:true}).catch(()=>{}); }
    return true;
  }

  if (i.isButton() && i.customId.startsWith("tmps:") && i.customId !== "tmps:start") {
    const parts=i.customId.split(":"), action=parts[1], app=applications.get(parts[2]);
    if (!app) { await i.reply({content:"❌ This application isn't available in the current bot session.",ephemeral:true}); return true; }
    const config=configs.get(app.guildId);
    if (!config || !canReview(i,config)) { await i.reply({content:"❌ You don't have permission to review applications.",ephemeral:true}); return true; }
    if (action==="score") {
      const score=Number(parts[3]);
      if (app.status!=="pending") { await i.reply({content:"This application is already closed.",ephemeral:true}); return true; }
      app.scores[i.user.id]=score;
      await i.message.edit(reviewPayload(app)).catch(()=>{});
      await i.reply({content:"📊 Evaluation saved: **" + score + "/5**.",ephemeral:true}); return true;
    }
    if (action==="interview") {
      if (app.status!=="pending") { await i.reply({content:"This application is already closed.",ephemeral:true}); return true; }
      const user=await i.client.users.fetch(app.userId).catch(()=>null);
      const ok=user && await sendDM(user,{embeds:[new EmbedBuilder().setTitle("🎤 Interview Requested").setColor(0xFEE75C)
        .setDescription("The staff team would like to arrange a short interview for your Trial Moderator application in **" + i.guild.name + "**.\n\nPlease contact a staff member or open a support ticket to arrange a suitable time. This is not an acceptance or rejection yet.")]});
      await i.reply({content:ok ? "🎤 Interview request sent." : "⚠️ I couldn't DM the applicant; their DMs may be closed.",ephemeral:true}); return true;
    }
    if (action==="accept" || action==="reject") {
      if (app.status!=="pending") { await i.reply({content:"This application has already been decided.",ephemeral:true}); return true; }
      await i.deferReply({ephemeral:true});
      if (action==="accept") {
        const role=i.guild.roles.cache.get(config.trialRoleId), member=await i.guild.members.fetch(app.userId).catch(()=>null);
        if (!role || !member) { await i.editReply("❌ The role or applicant couldn't be found. No decision was made."); return true; }
        if (role.managed || role.position >= i.guild.members.me.roles.highest.position) { await i.editReply("❌ I can't assign the Trial Moderator role. Move my highest role above it."); return true; }
        try { await member.roles.add(role,"Trial Moderator application accepted by " + i.user.tag); }
        catch { await i.editReply("❌ I couldn't assign the role. Check Manage Roles and role hierarchy."); return true; }
        app.status="accepted";
      } else app.status="rejected";
      app.decisionBy=i.user.id; app.decidedAt=Date.now(); cooldowns.set(app.guildId + ":" + app.userId,Date.now());
      const user=await i.client.users.fetch(app.userId).catch(()=>null);
      if (user) await sendDM(user,{embeds:[new EmbedBuilder().setColor(action==="accept"?0x57F287:0xED4245)
        .setTitle(action==="accept" ? "🎉 Trial Moderator Application Accepted!" : "📩 Trial Moderator Application Update")
        .setDescription(action==="accept" ? "Congratulations! Your application in **" + i.guild.name + "** was accepted. You've been assigned the Trial Moderator role.\n\nFollow the staff guidelines, ask questions when unsure, and treat every member fairly."
          : "Thank you for applying to become a Trial Moderator in **" + i.guild.name + "**. After reviewing your application, the team has decided not to move forward this time. You may apply again after 7 days.")
        .setFooter({text:"Thank you for your time and effort."})]});
      await i.message.edit(reviewPayload(app)).catch(()=>{});
      await i.editReply(action==="accept" ? "✅ Accepted, role assigned, and applicant notified." : "✅ Rejected and applicant notified."); return true;
    }
  }
  return false;
}

async function handleMessage(message) {
  if (!message || message.author.bot || message.guild) return false;
  const entry=[...sessions.entries()].find(x=>x[1].userId===message.author.id);
  if (!entry) return false;
  const key=entry[0], session=entry[1], config=configs.get(session.guildId);
  if (!config) { sessions.delete(key); await message.reply("❌ The application system was reset. Please contact staff.").catch(()=>{}); return true; }
  const text=String(message.content || "").trim(), lower=text.toLowerCase();
  if (lower==="cancel") { sessions.delete(key); await message.reply("🛑 Your application has been cancelled.").catch(()=>{}); return true; }
  if (lower==="back") {
    if (session.index===0) { await message.reply("You're already at the first question.").catch(()=>{}); return true; }
    session.index--; session.answers.length=session.index;
    await askQuestion(message.author,session).catch(()=>{}); return true;
  }
  if (lower==="skip") session.answers[session.index]="*Skipped*";
  else {
    if (!text) { await message.reply("Please send a text answer, or type skip, back, or cancel.").catch(()=>{}); return true; }
    if (text.length>1800) { await message.reply("That answer is too long. Please keep each answer under 1,800 characters.").catch(()=>{}); return true; }
    session.answers[session.index]=text;
  }
  session.index++;
  if (session.index<QUESTIONS.length) { await askQuestion(message.author,session).catch(()=>{}); return true; }
  const guild=message.client.guilds.cache.get(session.guildId), channel=guild && guild.channels.cache.get(session.reviewChannelId);
  if (!guild || !channel || !channel.isTextBased()) {
    sessions.delete(key); await message.reply("❌ I couldn't submit your application because the review channel is unavailable. Please contact staff.").catch(()=>{}); return true;
  }
  const id="TM-" + (nextId++);
  const app={id:id,guildId:session.guildId,userId:session.userId,userTag:session.userTag,avatar:session.avatar,
    answers:session.answers.slice(),status:"pending",createdAt:Date.now(),scores:{},decisionBy:null};
  applications.set(id,app); sessions.delete(key);
  const sent=await channel.send(reviewPayload(app)).then(()=>true).catch(()=>false);
  if (!sent) { applications.delete(id); await message.reply("❌ I couldn't send your application to staff. Please contact staff and try again later.").catch(()=>{}); return true; }
  await message.reply({embeds:[new EmbedBuilder().setTitle("✅ Application Submitted!").setColor(0x57F287)
    .setDescription("Your Trial Moderator application has been sent to the staff team.\n\n**Application ID:** " + id + "\n\nYou can close this DM now. Staff will contact you when a decision is made.")
    .setFooter({text:"Thank you for applying!"})]}).catch(()=>{});
  return true;
}

module.exports={commands,handleInteraction,handleMessage};
