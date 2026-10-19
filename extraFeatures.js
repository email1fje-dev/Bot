const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const music = require("./music");

const state = {
  automod:new Map(), welcome:new Map(), goodbye:new Map(), xp:new Map(),
  ticket:new Map(), giveaways:new Map()
};

const commands = [
  new SlashCommandBuilder().setName("automod").setDescription("Professional AutoMod controls.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addSubcommand(s=>s.setName("setup").setDescription("Enable the professional AutoMod preset."))
    .addSubcommand(s=>s.setName("status").setDescription("Show AutoMod settings."))
    .addSubcommand(s=>s.setName("set").setDescription("Enable or disable a protection.")
      .addStringOption(o=>o.setName("filter").setDescription("Protection filter.").setRequired(true).addChoices(
        {name:"Links",value:"links"},{name:"Invites",value:"invites"},{name:"Spam",value:"spam"},
        {name:"Mentions",value:"mentions"},{name:"Caps",value:"caps"},{name:"Bad Words",value:"badwords"}))
      .addBooleanOption(o=>o.setName("enabled").setDescription("Enabled?").setRequired(true))),

  new SlashCommandBuilder().setName("ticket-staff").setDescription("Advanced ticket staff tools.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addSubcommand(s=>s.setName("claim").setDescription("Claim the current ticket."))
    .addSubcommand(s=>s.setName("unclaim").setDescription("Remove the current ticket claim."))
    .addSubcommand(s=>s.setName("priority").setDescription("Set ticket priority.")
      .addStringOption(o=>o.setName("level").setDescription("Priority.").setRequired(true).addChoices(
        {name:"Low",value:"low"},{name:"Normal",value:"normal"},{name:"High",value:"high"},{name:"Urgent",value:"urgent"})))
    .addSubcommand(s=>s.setName("note").setDescription("Add a private staff note.")
      .addStringOption(o=>o.setName("text").setDescription("Note.").setRequired(true).setMaxLength(1000))),

  new SlashCommandBuilder().setName("giveaway-advanced").setDescription("Create an advanced giveaway.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addIntegerOption(o=>o.setName("minutes").setDescription("Duration in minutes.").setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption(o=>o.setName("winners").setDescription("Number of winners.").setRequired(true).setMinValue(1).setMaxValue(20))
    .addStringOption(o=>o.setName("prize").setDescription("Prize.").setRequired(true).setMaxLength(200))
    .addRoleOption(o=>o.setName("required_role").setDescription("Optional required role."))
    .addChannelOption(o=>o.setName("channel").setDescription("Giveaway channel.").addChannelTypes(ChannelType.GuildText)),

  new SlashCommandBuilder().setName("xp").setDescription("Advanced XP administration.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addSubcommand(s=>s.setName("set").setDescription("Set XP.")
      .addUserOption(o=>o.setName("user").setDescription("Member.").setRequired(true))
      .addIntegerOption(o=>o.setName("amount").setDescription("XP.").setRequired(true).setMinValue(0)))
    .addSubcommand(s=>s.setName("add").setDescription("Add XP.")
      .addUserOption(o=>o.setName("user").setDescription("Member.").setRequired(true))
      .addIntegerOption(o=>o.setName("amount").setDescription("XP.").setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName("reset").setDescription("Reset XP.")
      .addUserOption(o=>o.setName("user").setDescription("Member.").setRequired(true)))
    .addSubcommand(s=>s.setName("multiplier").setDescription("Set XP multiplier.")
      .addNumberOption(o=>o.setName("value").setDescription("0.1 to 5.").setRequired(true).setMinValue(0.1).setMaxValue(5))),

  new SlashCommandBuilder().setName("welcome-setup").setDescription("Configure welcome and goodbye.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addChannelOption(o=>o.setName("welcome").setDescription("Welcome channel.").addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o=>o.setName("goodbye").setDescription("Goodbye channel.").addChannelTypes(ChannelType.GuildText))
    .addBooleanOption(o=>o.setName("welcome_enabled").setDescription("Enable welcome."))
    .addBooleanOption(o=>o.setName("goodbye_enabled").setDescription("Enable goodbye.")),

  new SlashCommandBuilder().setName("serverstats").setDescription("Show detailed server statistics."),

  new SlashCommandBuilder().setName("cleanup").setDescription("Clean up server content.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addSubcommand(s=>s.setName("messages").setDescription("Bulk-delete recent messages.")
      .addIntegerOption(o=>o.setName("amount").setDescription("1-100 messages.").setRequired(true).setMinValue(1).setMaxValue(100))
      .addChannelOption(o=>o.setName("channel").setDescription("Channel to clean.").addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s=>s.setName("unused-roles").setDescription("Remove unused unmanaged roles.")),

  new SlashCommandBuilder().setName("backup").setDescription("Create or restore a server structure backup.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addSubcommand(s=>s.setName("create").setDescription("Create a JSON backup."))
    .addSubcommand(s=>s.setName("restore").setDescription("Restore a JSON backup."))
];

function get(map,id,defaults){if(!map.has(id))map.set(id,Object.assign({},defaults));return map.get(id);}
function auto(id){return get(state.automod,id,{links:true,invites:true,spam:true,mentions:true,caps:false,badwords:false});}
function welcome(id){return get(state.welcome,id,{channelId:null,enabled:true});}
function goodbye(id){return get(state.goodbye,id,{channelId:null,enabled:false});}
function xpState(id){return get(state.xp,id,{multiplier:1});}
function ticket(id,cid){const k=id+":"+cid;if(!state.ticket.has(k))state.ticket.set(k,{claimedBy:null,priority:"normal",notes:[]});return state.ticket.get(k);}

async function finishGiveaway(client,key){
  const g=state.giveaways.get(key); if(!g)return; state.giveaways.delete(key);
  try{
    const guild=client.guilds.cache.get(g.guildId), channel=guild?.channels.cache.get(g.channelId);
    const msg=await channel?.messages.fetch(g.messageId); if(!msg)return;
    const reaction=msg.reactions.cache.get("🎉"); const users=reaction?await reaction.users.fetch():new Map();
    let pool=[...users.values()].filter(u=>!u.bot);
    if(g.roleId)pool=pool.filter(u=>guild.members.cache.get(u.id)?.roles.cache.has(g.roleId));
    const picked=[];
    while(pool.length&&picked.length<g.winners)picked.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    const winners=picked.length?picked.map(u=>"<@"+u.id+">").join(", "):"No eligible winners.";
    await channel.send({embeds:[new EmbedBuilder().setTitle("🎊 Giveaway Ended").setDescription("Prize: **"+g.prize+"**\\nWinner(s): "+winners).setColor(0x57F287)]});
  }catch(e){console.error("Advanced giveaway:",e.message);}
}

async function handleInteraction(interaction,ctx){
  if(!interaction.isChatInputCommand()||!interaction.guild)return false;
  const guild=interaction.guild, name=interaction.commandName;
  if(name==="music") return music.handleInteraction(interaction);

  if(name==="automod"){
    const a=auto(guild.id), sub=interaction.options.getSubcommand();
    if(sub==="setup"){Object.assign(a,{links:true,invites:true,spam:true,mentions:true,caps:true,badwords:true});return interaction.reply({content:"🛡️ Professional AutoMod enabled: links, invites, spam, mentions, caps and bad words."});}
    if(sub==="status")return interaction.reply({embeds:[new EmbedBuilder().setTitle("🛡️ AutoMod Status").setDescription(Object.entries(a).map(x=>(x[1]?"🟢 ":"🔴 ")+x[0]).join("\\n")).setColor(0x5865F2)]});
    const f=interaction.options.getString("filter",true); a[f]=interaction.options.getBoolean("enabled",true);
    return interaction.reply({content:"🛡️ AutoMod **"+f+"** is now **"+(a[f]?"enabled":"disabled")+"**."});
  }

  if(name==="ticket-staff"){
    if(!interaction.channel?.topic?.includes("ticket-owner:"))return interaction.reply({content:"❌ Use this inside a ticket.",ephemeral:true});
    const t=ticket(guild.id,interaction.channel.id), sub=interaction.options.getSubcommand();
    if(sub==="claim"){t.claimedBy=interaction.user.id;return interaction.reply({content:"🛡️ Ticket claimed by <@"+interaction.user.id+">."});}
    if(sub==="unclaim"){t.claimedBy=null;return interaction.reply({content:"↩️ Ticket unclaimed."});}
    if(sub==="priority"){t.priority=interaction.options.getString("level",true);await interaction.channel.setTopic((interaction.channel.topic+" | priority:"+t.priority).slice(0,1024)).catch(()=>{});return interaction.reply({content:"🚦 Priority set to **"+t.priority+"**."});}
    t.notes.push({by:interaction.user.id,text:interaction.options.getString("text",true),at:new Date().toISOString()});
    return interaction.reply({content:"📝 Staff note saved.",ephemeral:true});
  }

  if(name==="giveaway-advanced"){
    const minutes=interaction.options.getInteger("minutes",true), winners=interaction.options.getInteger("winners",true);
    const prize=interaction.options.getString("prize",true), role=interaction.options.getRole("required_role");
    const channel=interaction.options.getChannel("channel")||interaction.channel;
    if(!channel?.isTextBased())return interaction.reply({content:"❌ Invalid channel.",ephemeral:true});
    const end=Date.now()+minutes*60000;
    const embed=new EmbedBuilder().setTitle("🎉 GIVEAWAY").setDescription("**"+prize+"**\\n\\nReact with 🎉 to enter!\\n"+(role?"🔒 Required role: <@&"+role.id+">\\n":"")+"🏆 Winners: **"+winners+"**\\n⏰ Ends <t:"+Math.floor(end/1000)+":R>").setColor(0xFEE75C);
    const msg=await channel.send({embeds:[embed]}); await msg.react("🎉");
    const key=msg.id; state.giveaways.set(key,{guildId:guild.id,channelId:channel.id,messageId:key,winners:winners,prize:prize,roleId:role?.id||null});
    setTimeout(()=>finishGiveaway(ctx.client,key),Math.min(minutes*60000,2147483647));
    return interaction.reply({content:"🎉 Advanced giveaway created in <#"+channel.id+">.",ephemeral:true});
  }

  if(name==="xp"){
    const sub=interaction.options.getSubcommand(), xs=xpState(guild.id);
    if(sub==="multiplier"){xs.multiplier=interaction.options.getNumber("value",true);return interaction.reply({content:"✨ XP multiplier set to **"+xs.multiplier+"x**."});}
    const user=interaction.options.getUser("user",true), data=ctx.getLevelInfo(guild.id,user.id);
    if(sub==="reset")data.xp=0;
    if(sub==="set")data.xp=interaction.options.getInteger("amount",true);
    if(sub==="add")data.xp+=interaction.options.getInteger("amount",true);
    data.level=Math.max(1,Math.floor(Math.sqrt(data.xp/100))+1); await ctx.saveLevelData(guild.id,user.id);
    const member=await guild.members.fetch(user.id).catch(()=>null); if(member)await ctx.applyLevelRole(member,data.level).catch(()=>{});
    return interaction.reply({content:"✨ <@"+user.id+"> → Level **"+data.level+"**, **"+data.xp+" XP**."});
  }

  if(name==="welcome-setup"){
    const w=welcome(guild.id), g=goodbye(guild.id), wc=interaction.options.getChannel("welcome"), gc=interaction.options.getChannel("goodbye");
    const we=interaction.options.getBoolean("welcome_enabled"), ge=interaction.options.getBoolean("goodbye_enabled");
    if(wc)w.channelId=wc.id;if(gc)g.channelId=gc.id;if(we!==null)w.enabled=we;if(ge!==null)g.enabled=ge;
    return interaction.reply({content:"👋 Welcome: "+(w.enabled&&w.channelId?"<#"+w.channelId+">":"disabled")+"\\n🚪 Goodbye: "+(g.enabled&&g.channelId?"<#"+g.channelId+">":"disabled")});
  }

  if(name==="serverstats"){
    const st=ctx.statBucket(guild.id), bots=guild.members.cache.filter(m=>m.user.bot).size;
    return interaction.reply({embeds:[new EmbedBuilder().setTitle("📊 Server Statistics").setDescription(
      "👥 Members: **"+guild.memberCount+"**\\n🙂 Humans: **"+(guild.memberCount-bots)+"**\\n🤖 Bots: **"+bots+"**\\n💬 Messages tracked: **"+st.messages+"**\\n📥 Joins: **"+st.joins+"**\\n📤 Leaves: **"+st.leaves+"**\\n📁 Channels: **"+guild.channels.cache.size+"**\\n🎭 Roles: **"+guild.roles.cache.size+"**\\n🚀 Boosts: **"+(guild.premiumSubscriptionCount||0)+"**"
    ).setColor(0x5865F2).setTimestamp()]});
  }

  if(name==="cleanup"){
    if(interaction.options.getSubcommand()==="messages"){
      const amount=interaction.options.getInteger("amount",true), channel=interaction.options.getChannel("channel")||interaction.channel;
      if(!channel?.bulkDelete)return interaction.reply({content:"❌ This channel cannot be cleaned.",ephemeral:true});
      const result=await channel.bulkDelete(amount,true).catch(()=>null);
      return interaction.reply({content:"🧹 Deleted **"+(result?.size||0)+"** messages in <#"+channel.id+">.",ephemeral:true});
    }
    const me=guild.members.me, roles=guild.roles.cache.filter(r=>!r.managed&&r.id!==guild.id&&r.position<me.roles.highest.position&&r.members.size===0); let count=0;
    for(const r of roles.values())if(await r.delete("Cleanup unused role").then(()=>true).catch(()=>false))count++;
    return interaction.reply({content:"🧹 Removed **"+count+"** unused roles.",ephemeral:true});
  }

  if(name==="backup"){
    const sub=interaction.options.getSubcommand();
    const fail=content=>interaction.reply({content,ephemeral:true});
    const channelTypeName=type=>({
      [ChannelType.GuildCategory]:"category",
      [ChannelType.GuildText]:"text",
      [ChannelType.GuildAnnouncement]:"announcement",
      [ChannelType.GuildVoice]:"voice",
      [ChannelType.GuildStageVoice]:"stage",
      [ChannelType.GuildForum]:"forum",
      [ChannelType.GuildMedia]:"media"
    }[type]||"unsupported");
    const typeFromName=name=>({
      category:ChannelType.GuildCategory,text:ChannelType.GuildText,
      announcement:ChannelType.GuildAnnouncement,voice:ChannelType.GuildVoice,
      stage:ChannelType.GuildStageVoice,forum:ChannelType.GuildForum,
      media:ChannelType.GuildMedia
    }[name]);
    const channelRef=(id,g)=>{const c=id?g.channels.cache.get(id):null;return c?{name:c.name,type:channelTypeName(c.type)}:null;};
    if(sub==="create"){
      await interaction.deferReply({ephemeral:true});
      try{
        const core=ctx.getSettings?ctx.getSettings(guild.id):null;
        const serialCore=core?{
          antilink:!!core.antilink,antispam:!!core.antispam,antiraid:!!core.antiraid,
          antimention:!!core.antimention,antiinvite:!!core.antiinvite,antibot:!!core.antibot,
          welcome:channelRef(core.welcome,guild),inviteLog:channelRef(core.inviteLog,guild),
          levelChannel:channelRef(core.levelChannel,guild),
          logChannels:Object.fromEntries(["member","mod","server"].map(k=>[k,channelRef(core.logChannels?.[k]|| (k==="mod"?core.logs:null),guild)]))
        }:null;
        const roles=guild.roles.cache.filter(r=>!r.managed&&r.id!==guild.id)
          .sort((a,b)=>a.position-b.position).map(r=>({
            name:r.name,color:r.hexColor,hoist:r.hoist,mentionable:r.mentionable,
            permissions:r.permissions.bitfield.toString()
          }));
        const channels=guild.channels.cache
          .filter(c=>channelTypeName(c.type)!=="unsupported")
          .sort((a,b)=>(a.rawPosition||0)-(b.rawPosition||0)).map(c=>({
            name:c.name,type:channelTypeName(c.type),parentName:c.parent?.name||null,
            topic:"topic"in c?c.topic:null,nsfw:"nsfw"in c?!!c.nsfw:false,
            rateLimitPerUser:c.rateLimitPerUser||0,bitrate:"bitrate"in c?c.bitrate:null,
            userLimit:"userLimit"in c?c.userLimit:null,
            permissionOverwrites:c.permissionOverwrites.cache.map(o=>{
              const target=o.type===0?guild.roles.cache.get(o.id):guild.channels.cache.get(o.id);
              return target?{targetType:o.type===0?"role":"channel",targetName:target.name,
                allow:o.allow.bitfield.toString(),deny:o.deny.bitfield.toString()}:null;
            }).filter(Boolean)
          }));
        const data={
          format:"kylo-discord-backup",version:2,createdAt:new Date().toISOString(),
          guild:{name:guild.name},roles,channels,
          settings:serialCore,
          extraFeatures:{
            automod:state.automod.get(guild.id)||null,
            welcome:state.welcome.get(guild.id)||null,
            goodbye:state.goodbye.get(guild.id)||null,
            xp:state.xp.get(guild.id)||null
          },
          notes:[
            "This backup stores bot-supported settings and server roles/channels, not messages, members, or private application submissions.",
            "Restore matches roles/channels by exact name. Ambiguous permission-overwrite targets are skipped.",
            "Role order, member role assignments, integrations, webhooks, emojis, and secrets are not restored."
          ]
        };
        const json=JSON.stringify(data,null,2);
        if(Buffer.byteLength(json,"utf8")>7_500_000)return interaction.editReply({content:"❌ Backup is too large to attach to Discord. Try a smaller server."});
        return interaction.editReply({content:"📦 **Backup created.** It includes supported security/welcome settings, roles, channel structure, and channel permission overwrites. Download the JSON and keep it safe.",files:[new AttachmentBuilder(Buffer.from(json,"utf8"),{name:"server-backup.json"})]});
      }catch(error){
        console.error("Backup create failed:",error);
        return interaction.editReply({content:"❌ Could not create the backup. Check the bot logs and permissions."});
      }
    }
    await interaction.deferReply({ephemeral:true});
    await interaction.editReply({content:"📎 حالا فایل بکاپ با پسوند `.json` رو همین‌جا بفرست. اولین فایل JSON که بفرستی دریافت می‌شه (تا ۲ دقیقه فرصت داری)."});
    let file=null;
    try{
      const collected=await interaction.channel.awaitMessages({
        filter:m=>m.author.id===interaction.user.id&&m.attachments.some(a=>a.name?.toLowerCase().endsWith(".json")),
        max:1,time:120_000,errors:["time"]
      });
      file=collected.first()?.attachments.find(a=>a.name?.toLowerCase().endsWith(".json"))||null;
    }catch{
      return interaction.editReply({content:"⌛ زمان ارسال فایل تموم شد. دوباره `/backup restore` رو اجرا کن و فایل JSON رو بفرست."});
    }
    if(!file)return interaction.editReply({content:"❌ فایل JSON پیدا نشد. دوباره `/backup restore` رو اجرا کن."});
    if(file.size>8_000_000)return interaction.editReply({content:"❌ حجم فایل باید کمتر از ۸ مگابایت باشه."});
    const response=await fetch(file.url).catch(()=>null);
    if(!response?.ok)return interaction.editReply({content:"❌ Could not download the backup file."});
    const data=await response.json().catch(()=>null);
    if(!data||data.format!=="kylo-discord-backup"||![1,2].includes(data.version)||!Array.isArray(data.roles)||!Array.isArray(data.channels))return interaction.editReply({content:"❌ Invalid or unsupported backup file. Use a JSON made by this bot."});
    if(data.roles.length>250||data.channels.length>500)return interaction.editReply({content:"❌ Backup exceeds safe role/channel limits."});
    let rolesCreated=0,channelsCreated=0,skipped=0,overwritesApplied=0;
    const roleMap=new Map(),channelMap=new Map(), ambiguousRoles=new Set(),ambiguousChannels=new Set();
    const matchUnique=(collection,name)=>{const found=collection.filter(x=>x.name===name);return found.length===1?found[0]:null;};
    for(const r of data.roles){
      const matches=guild.roles.cache.filter(x=>x.name===r.name&&!x.managed);
      if(matches.size===1)roleMap.set(r.name,matches.first());
      else if(matches.size>1)ambiguousRoles.add(r.name);
    }
    for(const c of data.channels){
      const matches=guild.channels.cache.filter(x=>x.name===c.name&&channelTypeName(x.type)===c.type);
      if(matches.size===1)channelMap.set(c.type+":"+c.name,matches.first());
      else if(matches.size>1)ambiguousChannels.add(c.type+":"+c.name);
    }
    // Create missing roles first; never edit or delete existing roles.
    for(const r of data.roles){
      if(roleMap.has(r.name)||ambiguousRoles.has(r.name)){skipped++;continue;}
      const created=await guild.roles.create({
        name:String(r.name).slice(0,100),color:/^#[0-9a-f]{6}$/i.test(r.color||"")?r.color:0,
        hoist:!!r.hoist,mentionable:!!r.mentionable,
        permissions:/^\d+$/.test(String(r.permissions||""))?BigInt(r.permissions):0n,
        reason:"Restore bot server backup"
      }).catch(()=>null);
      if(created){roleMap.set(r.name,created);rolesCreated++;}else skipped++;
    }
    const ordered=[...data.channels].sort((a,b)=>(a.type==="category"?-1:0)-(b.type==="category"?-1:0));
    // Create categories before child channels, preserving existing matching channels.
    for(const c of ordered){
      if(!typeFromName(c.type)){skipped++;continue;}
      const key=c.type+":"+c.name;
      if(channelMap.has(key)||ambiguousChannels.has(key)){skipped++;continue;}
      const parent= c.parentName ? channelMap.get("category:"+c.parentName) : null;
      const options={name:String(c.name).slice(0,100),type:typeFromName(c.type),reason:"Restore bot server backup"};
      if(parent&&c.type!=="category")options.parent=parent.id;
      if(c.topic&&["text","announcement","forum","media"].includes(c.type))options.topic=String(c.topic).slice(0,1024);
      if(["text","announcement","forum","media"].includes(c.type))options.nsfw=!!c.nsfw;
      if(c.type==="text"||c.type==="announcement")options.rateLimitPerUser=Math.max(0,Math.min(21600,Number(c.rateLimitPerUser)||0));
      if(c.type==="voice"||c.type==="stage"){if(Number(c.bitrate)>0)options.bitrate=Math.min(Number(c.bitrate),guild.maximumBitrate||96000);if(Number(c.userLimit)>=0)options.userLimit=Math.min(Number(c.userLimit)||0,99);}
      const created=await guild.channels.create(options).catch(()=>null);
      if(created){channelMap.set(key,created);channelsCreated++;}else skipped++;
    }
    // Rebuild permission overwrites only from unambiguous role/channel name matches.
    for(const c of data.channels){
      const target=channelMap.get(c.type+":"+c.name);
      if(!target||!Array.isArray(c.permissionOverwrites))continue;
      const overwrites=[];
      for(const o of c.permissionOverwrites){
        let dest=null;
        if(o.targetType==="role"){
          const matches=guild.roles.cache.filter(r=>r.name===o.targetName&&!r.managed);
          if(matches.size===1)dest=matches.first();
        }else if(o.targetType==="channel"){
          const matches=guild.channels.cache.filter(ch=>ch.name===o.targetName);
          if(matches.size===1)dest=matches.first();
        }
        if(!dest)continue;
        if(!/^\d+$/.test(String(o.allow))||!/^\d+$/.test(String(o.deny)))continue;
        overwrites.push({id:dest.id,allow:BigInt(o.allow),deny:BigInt(o.deny)});
      }
      if(overwrites.length){
        await target.permissionOverwrites.set(overwrites,"Restore bot server backup").then(()=>overwritesApplied+=overwrites.length).catch(()=>{skipped++;});
      }
    }
    // Restore supported bot settings using destination IDs resolved by exact unique channel names.
    if(data.settings&&ctx.getSettings){
      const s=ctx.getSettings(guild.id);
      for(const key of ["antilink","antispam","antiraid","antimention","antiinvite","antibot"])if(typeof data.settings[key]==="boolean")s[key]=data.settings[key];
      const resolveChannel=ref=>{
        if(!ref||!ref.name||!ref.type)return null;
        const matches=guild.channels.cache.filter(ch=>ch.name===ref.name&&channelTypeName(ch.type)===ref.type);
        return matches.size===1?matches.first().id:null;
      };
      for(const key of ["welcome","inviteLog","levelChannel"])if(key in data.settings)s[key]=resolveChannel(data.settings[key]);
      if(data.settings.logChannels){
        s.logChannels={member:resolveChannel(data.settings.logChannels.member),mod:resolveChannel(data.settings.logChannels.mod),server:resolveChannel(data.settings.logChannels.server)};
        s.logs=s.logChannels.mod;
      }
      if(ctx.saveGuildSettings)await ctx.saveGuildSettings(guild.id);
    }
    for(const key of ["automod","welcome","goodbye","xp"]){
      const value=data.extraFeatures?.[key];
      if(value&&typeof value==="object")state[key].set(guild.id,value);
    }
    const summary="♻️ **Restore finished.**\n• Roles created: **"+rolesCreated+"**\n• Channels created: **"+channelsCreated+"**\n• Permission overwrites applied: **"+overwritesApplied+"**\n• Skipped/ambiguous items: **"+skipped+"**\n\nExisting roles and channels were preserved. Check channel permissions before using the server.";
    return interaction.editReply({content:summary});
  }
  return false;
}

function attach(client,ctx){
  music.attach(client);
  client.on("guildMemberAdd",async member=>{const w=welcome(member.guild.id);if(w.enabled&&w.channelId){const ch=member.guild.channels.cache.get(w.channelId);if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder().setTitle("👋 Welcome!").setDescription("Welcome <@"+member.id+"> to **"+member.guild.name+"**!\\nYou are member **#"+member.guild.memberCount+"**.").setThumbnail(member.user.displayAvatarURL({size:256})).setColor(0x57F287)]}).catch(()=>{});}});
  client.on("guildMemberRemove",async member=>{const g=goodbye(member.guild.id);if(g.enabled&&g.channelId){const ch=member.guild.channels.cache.get(g.channelId);if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder().setTitle("🚪 Goodbye").setDescription("**"+member.user.tag+"** has left the server.").setColor(0xED4245)]}).catch(()=>{});}});
  client.on("messageCreate",async message=>{
    if(!message.guild||message.author.bot||message.member?.permissions.has(PermissionFlagsBits.Administrator))return;
    const a=auto(message.guild.id);
    if(a.caps&&message.content.length>=12){const letters=message.content.replace(/[^A-Za-z]/g,""), caps=(message.content.match(/[A-Z]/g)||[]).length;if(letters.length>=8&&caps/letters.length>=0.75){await message.delete().catch(()=>{});return;}}
    if(a.badwords&&/(badword1|badword2|badword3)/i.test(message.content))await message.delete().catch(()=>{});
  });
}
function getXPMultiplier(guildId){return xpState(guildId).multiplier||1;}
module.exports={commands,handleInteraction,attach,getXPMultiplier};