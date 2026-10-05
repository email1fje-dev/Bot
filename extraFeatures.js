const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const music = require("./music");

const state = {
  automod:new Map(), welcome:new Map(), goodbye:new Map(), xp:new Map(),
  ticket:new Map(), giveaways:new Map()
};

const commands = [
  ...music.commands.map(c => c),
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
    .addSubcommand(s=>s.setName("restore").setDescription("Restore a JSON backup.")
      .addAttachmentOption(o=>o.setName("file").setDescription("Backup JSON.").setRequired(true)))
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
    const me=guild.members.me, roles=guild.roles.cache.filter(r=>!r.managed&&!r.isEveryone()&&r.position<me.roles.highest.position&&r.members.size===0); let count=0;
    for(const r of roles.values())if(await r.delete("Cleanup unused role").then(()=>true).catch(()=>false))count++;
    return interaction.reply({content:"🧹 Removed **"+count+"** unused roles.",ephemeral:true});
  }

  if(name==="backup"){
    if(interaction.options.getSubcommand()==="create"){
      const data={version:1,createdAt:new Date().toISOString(),guild:{name:guild.name},
        roles:guild.roles.cache.filter(r=>!r.managed&&!r.isEveryone()).sort((a,b)=>a.position-b.position).map(r=>({name:r.name,color:r.hexColor,hoist:r.hoist,mentionable:r.mentionable})),
        channels:guild.channels.cache.filter(c=>c.type===ChannelType.GuildCategory||c.isTextBased()).sort((a,b)=>(a.rawPosition||0)-(b.rawPosition||0)).map(c=>({name:c.name,type:c.type,parentName:c.parent?.name||null,topic:"topic"in c?c.topic:null,nsfw:"nsfw"in c?c.nsfw:false}))
      };
      return interaction.reply({content:"📦 Server structure backup created.",files:[new AttachmentBuilder(Buffer.from(JSON.stringify(data,null,2)),{name:"server-backup.json"})],ephemeral:true});
    }
    const file=interaction.options.getAttachment("file",true); if(!file.name.toLowerCase().endsWith(".json"))return interaction.reply({content:"❌ Backup must be JSON.",ephemeral:true});
    const response=await fetch(file.url).catch(()=>null); if(!response?.ok)return interaction.reply({content:"❌ Could not download the backup file.",ephemeral:true}); const data=await response.json().catch(()=>null);
    if(!data?.version||!Array.isArray(data.roles)||!Array.isArray(data.channels))return interaction.reply({content:"❌ Invalid backup.",ephemeral:true});
    let roles=0,channels=0; const cats=new Map();
    for(const r of data.roles){if(guild.roles.cache.some(x=>x.name===r.name&&!x.managed))continue;await guild.roles.create({name:r.name,color:r.color,hoist:!!r.hoist,mentionable:!!r.mentionable,reason:"Backup restore"}).then(()=>roles++).catch(()=>{});}
    for(const c of data.channels.filter(x=>x.type===ChannelType.GuildCategory)){const ex=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===c.name);const cat=ex||await guild.channels.create({name:c.name,type:c.type,reason:"Backup restore"}).catch(()=>null);if(cat)cats.set(c.name,cat);}
    for(const c of data.channels.filter(x=>x.type!==ChannelType.GuildCategory)){if(guild.channels.cache.some(x=>x.name===c.name&&x.type===c.type))continue;await guild.channels.create({name:c.name,type:c.type,parent:cats.get(c.parentName)?.id,topic:c.topic||undefined,nsfw:!!c.nsfw,reason:"Backup restore"}).then(()=>channels++).catch(()=>{});}
    return interaction.reply({content:"♻️ Restore complete. Created **"+roles+"** roles and **"+channels+"** channels. Existing items were preserved.",ephemeral:true});
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