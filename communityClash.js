const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits
} = require("discord.js");
const crypto = require("node:crypto");
const TABLE = "community_clash_events";
const events = new Map(), timers = new Map();
const makeId = () => crypto.randomBytes(6).toString("hex");
const get = guildId => events.get(String(guildId)) || null;
const log = (e, action, userId, details="") => { e.audit.unshift({id:makeId(),action,userId:String(userId||""),details,at:Date.now()}); e.audit=e.audit.slice(0,300); };
async function save(db,e) {
  if(!db)return;
  const {error}=await db.from(TABLE).upsert({guild_id:e.guildId,event_id:e.id,status:e.status,event_data:e,updated_at:new Date().toISOString()},{onConflict:"guild_id,event_id"});
  if(error)throw new Error("ذخیره ایونت ناموفق بود: "+error.message);
}
async function load(db) {
  if(!db)return;
  const {data,error}=await db.from(TABLE).select("guild_id,event_id,event_data");
  if(error){console.error("[Community Clash] load:",error.message);return;}
  for(const row of data||[]){const e=row.event_data;if(e&&e.guildId){const old=get(row.guild_id);if(!old||e.createdAt>old.createdAt)events.set(row.guild_id,e);}}
}
function board(e){
  const pts=new Map();
  for(const s of e.submissions||[])if(s.status==="approved"){const votes=s.type==="meme"?Object.keys((e.votes||{})[s.id]||{}).length:0;const row=pts.get(s.userId)||{points:0,memeVotes:0,challengePoints:0};row.points+=Number(s.points||0)+votes+Number(s.bonusPoints||0);if(s.type==="meme")row.memeVotes+=votes;if(s.type==="challenge")row.challengePoints+=Number(s.points||0);pts.set(s.userId,row);}
  return [...pts.entries()].map(([userId,v])=>({userId,points:v.points,memeVotes:v.memeVotes,challengePoints:v.challengePoints})).sort((a,b)=>b.points-a.points||b.memeVotes-a.memeVotes||b.challengePoints-a.challengePoints||a.userId.localeCompare(b.userId));
}
function summary(e){
  if(!e)return null;
  return {id:e.id,title:e.title,description:e.description,status:e.status,stage:e.stage,createdAt:e.createdAt,startsAt:e.startsAt,endsAt:e.endsAt,
    winnerCount:e.winnerCount,roleDays:e.roleDays,participants:e.participants.length,submissionCount:e.submissions.length,pending:e.submissions.filter(s=>s.status==="pending").length,
    channels:e.channels,roles:e.roles,question:e.question,mission:e.mission,leaderboard:board(e).slice(0,10),audit:e.audit.slice(0,30),
    submissions:e.submissions.slice(-100).reverse().map(s=>({id:s.id,userId:s.userId,type:s.type,content:s.content,status:s.status,points:s.points||0,createdAt:s.createdAt,reason:s.reason||"",votes:Object.keys((e.votes||{})[s.id]||{}).length}))};
}
function registration(e){
  return {embeds:[new EmbedBuilder().setColor(0x45e0a0).setTitle("🏆 "+e.title).setDescription(e.description+"\n\n🧠 Community Challenge\n😂 Meme Battle\n🤝 Community Mission\n\nشرکت‌کننده‌ها: **"+e.participants.length+"**\nوضعیت: **"+e.status+"**")],
    components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cc:join:"+e.id).setLabel("شرکت می‌کنم").setEmoji("✅").setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId("cc:leave:"+e.id).setLabel("لغو ثبت‌نام").setStyle(ButtonStyle.Secondary))]};
}
async function makeResources(g,e){
  const me=g.members.me||await g.members.fetchMe();
  if(!me.permissions.has(PermissionFlagsBits.ManageChannels)||!me.permissions.has(PermissionFlagsBits.ManageRoles))throw new Error("بات به مجوز Manage Channels و Manage Roles نیاز دارد.");
  const catName="clash-"+e.id;
  let cat=g.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name===catName);
  if(!cat)cat=await g.channels.create({name:catName,type:ChannelType.GuildCategory,reason:"Community Clash setup"});
  const marker="community-clash:"+e.id+":";
  const specs=[["announcements","📣-clash-announcements",false],["registration","✅-clash-registration",false],["challenge","🧠-clash-challenge",false],["memes","😂-clash-memes",false],["suggestions","💡-clash-suggestions",false],["leaderboard","🏆-clash-leaderboard",false],["review","🔒-clash-review",true]];
  for(const [key,name,priv] of specs){
    let ch=g.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.topic&&c.topic.includes(marker+key));
    if(!ch){const overwrites=priv?[{id:g.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.EmbedLinks]},{id:g.ownerId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}]:undefined;
      ch=await g.channels.create({name,type:ChannelType.GuildText,parent:cat.id,topic:marker+key,permissionOverwrites:overwrites,reason:"Community Clash setup"});}
    e.channels[key]=ch.id;
  }
  const roles=[["champion","Community Champion",0xf1c40f],["mvp","Community MVP",0x3498db],["rising","Rising Star",0xe67e22]];
  for(const [key,name,color] of roles){let role=g.roles.cache.find(r=>r.name===name&&!r.managed&&r.permissions.bitfield===0n);if(!role){const roleName=g.roles.cache.some(r=>r.name===name)?name+" • Clash":name;role=await g.roles.create({name:roleName,color,permissions:[],hoist:true,mentionable:false,reason:"Community Clash reward role with no elevated permissions"});}e.roles[key]=role.id;}
}
async function postPanels(g,e){
  const ch=k=>g.channels.cache.get(e.channels[k]);
  await ch("announcements")?.send({embeds:[new EmbedBuilder().setColor(0x45e0a0).setTitle("🏆 COMMUNITY CLASH IS HERE!").setDescription("@everyone\n\n"+e.description+"\n\n🎯 Day 1 — Community Challenge\n😂 Day 2 — Meme Battle\n🤝 Day 3 — Community Mission\n\n🥇 Community Champion • 🥈 Community MVP • 🥉 Rising Star\n\nثبت‌نام: <#"+e.channels.registration+">")],allowedMentions:{parse:[]}});
  await ch("registration")?.send(registration(e));
  await ch("challenge")?.send({embeds:[new EmbedBuilder().setColor(0x5865f2).setTitle("🧠 Community Challenge").setDescription("**سؤال:** "+e.question+"\n\nپاسخت را از دکمه ارسال کن؛ ارسال‌ها برای بررسی می‌روند.")],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cc:submit:challenge:"+e.id).setLabel("ارسال پاسخ").setStyle(ButtonStyle.Primary))]});
  await ch("memes")?.send({embeds:[new EmbedBuilder().setColor(0xf1c40f).setTitle("😂 Meme Battle").setDescription("لینک مستقیم تصویر میم مناسب قوانین سرور را ارسال کن. میم‌های تأییدشده برای رأی‌گیری منتشر می‌شوند.")],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cc:submit:meme:"+e.id).setLabel("ارسال میم").setStyle(ButtonStyle.Primary))]});
  await ch("suggestions")?.send({embeds:[new EmbedBuilder().setColor(0x45e0a0).setTitle("🤝 Community Mission").setDescription(e.mission+"\n\nهر پیشنهاد متفاوت پس از تأیید امتیاز می‌گیرد.")],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cc:submit:suggestion:"+e.id).setLabel("ثبت پیشنهاد").setStyle(ButtonStyle.Success))]});
  await ch("leaderboard")?.send({embeds:[new EmbedBuilder().setColor(0x45e0a0).setTitle("🏆 Leaderboard").setDescription("بعد از تأیید ارسال‌ها، جدول امتیازها در پنل وب قابل مشاهده است.")]});
}
async function create(client,db,guildId,input){
  const g=client.guilds.cache.get(String(guildId));if(!g)throw new Error("سرور پیدا نشد.");
  const old=get(guildId);if(old&&["setup","active","paused"].includes(old.status))throw new Error("یک ایونت آماده یا فعال از قبل وجود دارد.");
  const now=Date.now(),e={id:makeId(),guildId:String(guildId),title:String(input.title||"Community Clash").slice(0,100),description:String(input.description||"سه روز رقابت دوستانه برای جامعه سرور").slice(0,1500),
    status:"setup",stage:"challenge",createdAt:now,startsAt:input.startsAt||now,endsAt:input.endsAt||now+3*86400000,winnerCount:Math.max(1,Math.min(3,Number(input.winnerCount)||3)),roleDays:Math.max(1,Math.min(90,Number(input.roleDays)||30)),
    question:String(input.question||"اگر می‌توانستی یک قابلیت به Discord اضافه کنی، چه بود و چرا؟").slice(0,1000),mission:String(input.mission||"سه پیشنهاد کاربردی و متفاوت برای بهتر شدن سرور ثبت کن.").slice(0,1000),
    createdBy:String(input.createdBy||""),channels:{},roles:{},participants:[],submissions:[],votes:{},audit:[],roleExpiries:[],remindersSent:[]};
  await makeResources(g,e);events.set(g.id,e);log(e,"created",input.createdBy,"ساخت چنل‌ها، رول‌ها و پیام‌ها");
  await save(db,e);await postPanels(g,e);await save(db,e);return summary(e);
}
async function refreshReg(g,e){
  const ch=g.channels.cache.get(e.channels.registration);if(!ch)return;
  const msgs=await ch.messages.fetch({limit:10}).catch(()=>null);const msg=msgs&&msgs.find(m=>m.author.id===g.client.user.id&&m.components.some(r=>r.components.some(c=>c.customId==="cc:join:"+e.id)));
  if(msg)await msg.edit(registration(e)).catch(()=>{});
}
async function refreshLeaderboard(client,db,e){
  const g=client.guilds.cache.get(String(e.guildId));if(!g)return;
  const ch=g.channels.cache.get(e.channels.leaderboard);if(!ch)return;
  const rows=board(e).slice(0,10);
  const desc=rows.length?rows.map((x,n)=>(["🥇","🥈","🥉"][n]||("**"+(n+1)+".**"))+" <@"+x.userId+"> — **"+x.points+"** امتیاز").join("\n"):"هنوز امتیاز تأییدشده‌ای ثبت نشده.";
  const msgs=await ch.messages.fetch({limit:25}).catch(()=>null);
  const msg=msgs&&msgs.find(m=>m.author.id===client.user.id&&m.embeds.some(x=>x.title==="🏆 Leaderboard"));
  if(msg)await msg.edit({embeds:[new EmbedBuilder().setColor(0x45e0a0).setTitle("🏆 Leaderboard").setDescription(desc+"\n\nوضعیت: **"+e.status+"** · مرحله: **"+e.stage+"**").setTimestamp()]});
  await save(db,e);
}
function timer(client,db,e){
  const t=timers.get(e.guildId);if(t)clearTimeout(t);if(e.status!=="active")return;
  const remaining=Number(e.endsAt)-Date.now();if(remaining<=0){finish(client,db,e.guildId,e.createdBy,true).catch(err=>console.error("[Community Clash] end:",err.message));return;}timers.set(e.guildId,setTimeout(()=>timer(client,db,e),Math.min(remaining,2147480000)));
}
function scheduleReminders(client,db,e){
  if(e.status!=="active")return;
  e.remindersSent ||= [];
  for(const hours of [24,1]){
    const key="reminder:"+e.guildId+":"+hours;
    if(e.remindersSent.includes(hours))continue;
    const delay=Number(e.endsAt)-Date.now()-hours*3600000;
    const old=timers.get(key);if(old)clearTimeout(old);
    const fire=async()=>{
      if(Date.now()<Number(e.endsAt)-hours*3600000){scheduleReminders(client,db,e);return;}
      if(e.status!=="active"||e.remindersSent.includes(hours))return;
      const g=client.guilds.cache.get(e.guildId),ch=g&&g.channels.cache.get(e.channels.announcements);
      if(ch)await ch.send({embeds:[new EmbedBuilder().setColor(0xf1c40f).setTitle("⏰ یادآوری Community Clash").setDescription(hours===24?"فقط ۲۴ ساعت تا پایان ایونت باقی مانده؛ ارسال‌ها و رأی‌ها را کامل کن.":"فقط یک ساعت تا پایان ایونت باقی مانده؛ آخرین فرصت مشارکت است.")],allowedMentions:{parse:[]}});
      e.remindersSent.push(hours);log(e,"reminder-sent","system",hours+"h");await save(db,e);
    };
    if(delay<0)continue;
    timers.set(key,setTimeout(()=>fire().catch(err=>console.error("[Community Clash] reminder:",err.message)),Math.min(delay,2147480000)));
  }
}
async function start(client,db,gid,uid){const e=get(gid);if(!e)throw new Error("ایونتی ساخته نشده.");if(!["setup","paused"].includes(e.status))throw new Error("ایونت باید آماده یا متوقف‌شده باشد.");if(Number(e.endsAt)<=Date.now())throw new Error("زمان پایان ایونت گذشته است.");e.status="active";e.startedAt=e.startedAt||Date.now();log(e,"started",uid);await save(db,e);timer(client,db,e);scheduleReminders(client,db,e);const g=client.guilds.cache.get(String(gid));if(g)await refreshReg(g,e);return summary(e);}
async function pause(client,db,gid,uid){const e=get(gid);if(!e||e.status!=="active")throw new Error("ایونت فعالی وجود ندارد.");e.remainingMs=Math.max(0,Number(e.endsAt)-Date.now());e.pausedAt=Date.now();e.status="paused";log(e,"paused",uid,"remainingMs="+e.remainingMs);clearTimeout(timers.get(String(gid)));timers.delete(String(gid));await save(db,e);const g=client.guilds.cache.get(String(gid));if(g)await refreshReg(g,e);return summary(e);}
async function resume(client,db,gid,uid){const e=get(gid);if(!e||e.status!=="paused")throw new Error("ایونت متوقف‌شده‌ای وجود ندارد.");const remaining=Number(e.remainingMs??(Number(e.endsAt)-Date.now()));if(remaining<=0)return finish(client,db,gid,uid,true);e.endsAt=Date.now()+remaining;delete e.remainingMs;delete e.pausedAt;e.status="active";log(e,"resumed",uid);await save(db,e);timer(client,db,e);scheduleReminders(client,db,e);const g=client.guilds.cache.get(String(gid));if(g)await refreshReg(g,e);return summary(e);}
async function setStage(client,db,gid,stage,uid){const e=get(gid);if(!e||!["active","paused","setup"].includes(e.status))throw new Error("ابتدا ایونت را بساز.");if(!["challenge","meme","mission"].includes(stage))throw new Error("مرحله نامعتبر است.");e.stage=stage;log(e,"stage-changed",uid,stage);await save(db,e);const g=client.guilds.cache.get(String(gid)),ch=g&&g.channels.cache.get(e.channels.announcements);const names={challenge:"🧠 Community Challenge",meme:"😂 Meme Battle",mission:"🤝 Community Mission"};if(ch)await ch.send({embeds:[new EmbedBuilder().setColor(0x45e0a0).setTitle("مرحله جدید: "+names[stage]).setDescription(stage==="challenge"?e.question:stage==="mission"?e.mission:"ارسال میم باز است؛ میم‌های تأییدشده برای رأی‌گیری منتشر می‌شوند.")],allowedMentions:{parse:[]}});if(g)await refreshReg(g,e);return summary(e);}
async function finish(client,db,gid,uid,automatic=false){
  const e=get(gid);if(!e||!["active","paused","setup"].includes(e.status))throw new Error("ایونتی برای پایان دادن وجود ندارد.");e.status="ended";e.endedAt=Date.now();log(e,automatic?"auto-ended":"ended",uid);clearTimeout(timers.get(gid));timers.delete(gid);
  for(const s of e.submissions||[])if(s.type==="meme")s.bonusPoints=0;const awardedUsers=new Set();let rank=0;const memeRank=(e.submissions||[]).filter(s=>s.type==="meme"&&s.status==="approved").sort((a,b)=>Object.keys((e.votes||{})[b.id]||{}).length-Object.keys((e.votes||{})[a.id]||{}).length||a.createdAt-b.createdAt);for(const meme of memeRank){if(awardedUsers.has(meme.userId))continue;awardedUsers.add(meme.userId);meme.bonusPoints=[5,3,1][rank]||0;rank++;if(rank>=3)break;}if(rank)log(e,"meme-bonuses-awarded",uid,"رتبه‌های میم: "+rank);
  const g=client.guilds.cache.get(gid);if(g){const winners=board(e),keys=["champion","mvp","rising"];
    for(let n=0;n<Math.min(e.winnerCount,3,winners.length);n++){const m=await g.members.fetch(winners[n].userId).catch(()=>null),r=g.roles.cache.get(e.roles[keys[n]]);if(m&&r&&r.position<(g.members.me?.roles.highest.position||0)&&!m.roles.cache.has(r.id)){const added=await m.roles.add(r,"Community Clash winner").then(()=>true).catch(()=>false);if(added)e.roleExpiries.push({userId:m.id,roleId:r.id,expiresAt:Date.now()+e.roleDays*86400000,removedAt:null});}}
    const ch=g.channels.cache.get(e.channels.announcements);if(ch)await ch.send({embeds:[new EmbedBuilder().setColor(0xf1c40f).setTitle("🏆 Community Clash Results").setDescription(winners.slice(0,e.winnerCount).map((x,n)=>(["🥇","🥈","🥉"][n])+" <@"+x.userId+"> — **"+x.points+"** امتیاز").join("\n")||"امتیاز تأییدشده‌ای ثبت نشده.")],allowedMentions:{parse:[]}});
  }
  await save(db,e);if(g)await refreshReg(g,e);expireRoles(client,db,e);return summary(e);
}
async function cancel(client,db,gid,uid){const e=get(gid);if(!e||!["setup","active","paused"].includes(e.status))throw new Error("ایونت قابل لغو پیدا نشد.");e.status="cancelled";e.endedAt=Date.now();log(e,"cancelled",uid);clearTimeout(timers.get(String(gid)));timers.delete(String(gid));await save(db,e);const g=client.guilds.cache.get(String(gid));if(g){await refreshReg(g,e);const ch=g.channels.cache.get(e.channels.announcements);if(ch)await ch.send({embeds:[new EmbedBuilder().setColor(0xe74c3c).setTitle("Community Clash لغو شد").setDescription("این ایونت توسط مدیریت لغو شده است.")],allowedMentions:{parse:[]}});}return summary(e);}
function expireRoles(client,db,e){
  for(const x of e.roleExpiries||[]){
    if(x.removedAt)continue;
    const key=e.guildId+":"+x.userId+":"+x.roleId;
    const old=timers.get("expiry:"+key);if(old)clearTimeout(old);
    const remove=async()=>{
      if(Date.now()<Number(x.expiresAt)){const wait=Number(x.expiresAt)-Date.now();timers.set("expiry:"+key,setTimeout(()=>remove().catch(err=>console.error("[Community Clash] role expiry:",err.message)),Math.min(wait,2147480000)));return;}
      const g=client.guilds.cache.get(String(e.guildId));
      if(g){const m=await g.members.fetch(x.userId).catch(()=>null);if(m&&m.roles.cache.has(x.roleId))await m.roles.remove(x.roleId,"Community Clash reward expired").catch(()=>{});}
      x.removedAt=Date.now();log(e,"reward-role-expired",x.userId,x.roleId);await save(db,e);
    };
    const delay=Number(x.expiresAt)-Date.now();
    if(delay<=0)remove().catch(err=>console.error("[Community Clash] role expiry:",err.message));
    else timers.set("expiry:"+key,setTimeout(()=>remove().catch(err=>console.error("[Community Clash] role expiry:",err.message)),Math.min(delay,2147480000)));
  }
}
async function modal(i,e,type,existing=null){const m=new ModalBuilder().setCustomId("cc:modal:"+type+":"+e.id+(existing?":"+existing.id:"")).setTitle(type==="challenge"?"Community Challenge":type==="meme"?"Meme Battle":"Community Mission");const input=new TextInputBuilder().setCustomId("content").setLabel(type==="meme"?"لینک مستقیم تصویر HTTPS":"متن ارسال").setStyle(type==="meme"?TextInputStyle.Short:TextInputStyle.Paragraph).setRequired(true).setMaxLength(type==="meme"?500:1500);if(existing)input.setValue(existing.content.slice(0,type==="meme"?500:1500));m.addComponents(new ActionRowBuilder().addComponents(input));await i.showModal(m);}
async function review(client,db,gid,sid,action,points,uid,reason){
  const e=get(gid);if(!e)throw new Error("ایونت پیدا نشد.");if(!["setup","active","paused"].includes(e.status))throw new Error("ایونت پایان یافته یا لغو شده است؛ بررسی جدید ممکن نیست.");const s=e.submissions.find(x=>x.id===sid);if(!s)throw new Error("ارسال پیدا نشد.");
  s.status=action==="approve"?"approved":"rejected";let awarded=Number(points)||0;if(s.type==="challenge")awarded=Math.min(3,awarded);else if(s.type==="suggestion"){const used=e.submissions.filter(x=>x.userId===s.userId&&x.type==="suggestion"&&x.status==="approved"&&x.id!==s.id).reduce((n,x)=>n+Number(x.points||0),0);awarded=Math.min(1,Math.max(0,3-used),awarded);}else awarded=0;s.points=action==="approve"?Math.max(0,awarded):0;s.reviewedBy=String(uid);s.reason=String(reason||"").slice(0,300);log(e,"review-"+action,uid,sid+" points="+s.points);
  if(s.type==="meme"&&action==="approve"){const g=client.guilds.cache.get(gid),ch=g&&g.channels.cache.get(e.channels.memes);if(ch)await ch.send({content:"😂 **Meme Battle** • <@"+s.userId+">\n"+s.content,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cc:vote:"+e.id+":"+s.id).setLabel("رأی می‌دهم").setStyle(ButtonStyle.Primary))],allowedMentions:{parse:[]}});}
  await save(db,e);await refreshLeaderboard(client,db,e);return summary(e);
}
async function handle(i,client,db){
  if(!i.guild)return false;const c=i.customId||"";
  if(i.isButton()&&c.startsWith("cc:join:")){const e=get(i.guild.id);if(!e||e.id!==c.split(":")[2]||!["setup","active"].includes(e.status)){await i.reply({content:"ثبت‌نام در دسترس نیست.",ephemeral:true});return true;}if(e.participants.includes(i.user.id)){await i.reply({content:"از قبل ثبت‌نام کرده‌ای.",ephemeral:true});return true;}e.participants.push(i.user.id);log(e,"join",i.user.id);await save(db,e);await i.reply({content:"ثبت‌نامت انجام شد! 💚",ephemeral:true});await refreshReg(i.guild,e);return true;}
  if(i.isButton()&&c.startsWith("cc:leave:")){const e=get(i.guild.id);if(!e||e.id!==c.split(":")[2]){await i.reply({content:"ایونت پیدا نشد.",ephemeral:true});return true;}e.participants=e.participants.filter(x=>x!==i.user.id);log(e,"leave",i.user.id);await save(db,e);await i.reply({content:"ثبت‌نامت لغو شد.",ephemeral:true});await refreshReg(i.guild,e);return true;}
  if(i.isButton()&&c.startsWith("cc:submit:")){const p=c.split(":"),type=p[2],e=get(i.guild.id);if(!e||e.id!==p[3]||e.status!=="active"){await i.reply({content:"ارسال‌ها فعلاً بسته‌اند.",ephemeral:true});return true;}if(!e.participants.includes(i.user.id)){await i.reply({content:"اول ثبت‌نام کن.",ephemeral:true});return true;}
    const requiredStage=type==="suggestion"?"mission":type;if(e.stage!==requiredStage){await i.reply({content:"این مرحله در حال حاضر فعال نیست.",ephemeral:true});return true;}const userSubs=e.submissions.filter(s=>s.userId===i.user.id&&s.type===type);if(type==="challenge"){const existing=userSubs.find(s=>s.status==="pending"||s.status==="approved");if(existing){await modal(i,e,type,existing);return true;}}else if(userSubs.filter(s=>s.status!=="rejected").length>=3){await i.reply({content:"به سقف ۳ ارسال برای این مرحله رسیدی.",ephemeral:true});return true;}await modal(i,e,type);return true;}
  if(i.isModalSubmit()&&c.startsWith("cc:modal:")){
    const p=c.split(":"),type=p[2],e=get(i.guild.id),eventId=p[3],existingId=p[4];
    if(!e||e.id!==eventId||e.status!=="active"||!e.participants.includes(i.user.id)){await i.reply({content:"ایونت یا ثبت‌نامت در دسترس نیست.",ephemeral:true});return true;}
    const requiredStage=type==="suggestion"?"mission":type;
    if(e.stage!==requiredStage){await i.reply({content:"مهلت این مرحله تمام شده.",ephemeral:true});return true;}
    const content=i.fields.getTextInputValue("content").trim();
    if(!content){await i.reply({content:"متن خالی پذیرفته نمی‌شود.",ephemeral:true});return true;}
    if(type==="meme"&&!/^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(content)){await i.reply({content:"لینک مستقیم HTTPS به تصویر PNG/JPG/GIF/WEBP وارد کن.",ephemeral:true});return true;}
    const normalized=content.toLocaleLowerCase().replace(/\s+/g," ").trim();
    if(type==="suggestion"&&e.submissions.some(s=>s.type==="suggestion"&&s.status!=="rejected"&&s.userId!==i.user.id&&s.content.toLocaleLowerCase().replace(/\s+/g," ").trim()===normalized)){await i.reply({content:"این پیشنهاد قبلاً ثبت شده؛ ایده متفاوت بفرست.",ephemeral:true});return true;}
    let current;
    if(existingId){
      current=e.submissions.find(s=>s.id===existingId&&s.userId===i.user.id&&s.type==="challenge");
      if(!current||!["pending","approved"].includes(current.status)){await i.reply({content:"پاسخ قابل ویرایش پیدا نشد.",ephemeral:true});return true;}
      current.content=content;current.status="pending";current.points=0;current.reason="";current.reviewedBy=null;current.updatedAt=Date.now();
      log(e,"submission-edited",i.user.id,current.id);
    }else{
      if(type==="challenge"&&e.submissions.some(s=>s.type==="challenge"&&s.userId===i.user.id&&s.status!=="rejected")){await i.reply({content:"پاسخ قبلی را با دکمه ویرایش کن.",ephemeral:true});return true;}
      if(type!=="challenge"&&e.submissions.filter(s=>s.type===type&&s.userId===i.user.id&&s.status!=="rejected").length>=3){await i.reply({content:"به سقف ارسال این مرحله رسیدی.",ephemeral:true});return true;}
      current={id:makeId(),userId:i.user.id,type,content,status:"pending",points:0,createdAt:Date.now(),reason:"",reviewedBy:null};
      e.submissions.push(current);
    }
    log(e,"submission",i.user.id,type);await save(db,e);
    const ch=i.guild.channels.cache.get(e.channels.review);
    if(ch)await ch.send({embeds:[new EmbedBuilder().setColor(0xf1c40f).setTitle("📥 ارسال جدید/ویرایش‌شده: "+type).setDescription("شناسه: "+current.id+"\nکاربر: <@"+current.userId+">\n\n"+(type==="meme"?"[مشاهده میم]("+current.content+")":current.content)).setFooter({text:"برای بررسی از پنل وب استفاده کن."})]});
    await i.reply({content:existingId?"پاسخت به‌روزرسانی شد و دوباره برای بررسی رفت. 💚":"ارسالت برای بررسی ثبت شد. 💚",ephemeral:true});return true;
  }
  if(i.isButton()&&c.startsWith("cc:vote:")){
    const p=c.split(":"),e=get(i.guild.id),sid=p[3],s=e&&e.id===p[2]&&e.submissions.find(x=>x.id===sid);
    if(!e||e.status!=="active"||e.stage!=="meme"||!s||s.type!=="meme"||s.status!=="approved"){await i.reply({content:"رأی‌گیری برای این میم فعلاً بسته است.",ephemeral:true});return true;}
    if(!e.participants.includes(i.user.id)){await i.reply({content:"برای رأی دادن باید در ایونت ثبت‌نام کرده باشی.",ephemeral:true});return true;}
    if(s.userId===i.user.id){await i.reply({content:"به میم خودت نمی‌توانی رأی بدهی.",ephemeral:true});return true;}
    e.votes[sid]=e.votes[sid]||{};
    if(e.votes[sid][i.user.id]){await i.reply({content:"قبلاً به این میم رأی داده‌ای.",ephemeral:true});return true;}
    e.votes[sid][i.user.id]=true;log(e,"meme-vote",i.user.id,sid);await save(db,e);
    await i.reply({content:"رأی ثبت شد. 💚",ephemeral:true});await refreshLeaderboard(client,db,e);return true;
  }
  return false;
}
function attach(client,db){
  client.__communityClash={ready:null,get:g=>summary(get(g)),create:(g,x)=>create(client,db,g,x),start:(g,u)=>start(client,db,g,u),pause:(g,u)=>pause(client,db,g,u),resume:(g,u)=>resume(client,db,g,u),stage:(g,stage,u)=>setStage(client,db,g,stage,u),end:(g,u)=>finish(client,db,g,u),cancel:(g,u)=>cancel(client,db,g,u),review:(g,s,a,p,u,r)=>review(client,db,g,s,a,p,u,r)};
  client.on("interactionCreate",async i=>{try{if(client.__communityClash?.ready)await client.__communityClash.ready;if(await handle(i,client,db))return;}catch(e){console.error("[Community Clash]",e);if(i.isRepliable()&&!i.replied&&!i.deferred)await i.reply({content:"خطای ایونت: "+String(e.message||"خطا").slice(0,250),ephemeral:true}).catch(()=>{});}});
  client.__communityClash.ready=load(db).then(()=>{for(const e of events.values()){if(e.status==="active"){timer(client,db,e);scheduleReminders(client,db,e);}if(e.status==="ended")expireRoles(client,db,e);}}).catch(e=>{console.error("[Community Clash] load:",e.message);});
}
module.exports={attach};
