const {SlashCommandBuilder,EmbedBuilder,ActionRowBuilder,StringSelectMenuBuilder}=require("discord.js");
const {Player}=require("discord-player");
const {SoundCloudExtractor}=require("@discord-player/extractor");
let player;const searches=new Map();

const commands=[new SlashCommandBuilder().setName("music").setDescription("Music player")
.addSubcommand(s=>s.setName("search").setDescription("Search SoundCloud").addStringOption(o=>o.setName("query").setDescription("Song or artist").setRequired(true)))
.addSubcommand(s=>s.setName("play").setDescription("Play a song").addStringOption(o=>o.setName("query").setDescription("Song or SoundCloud URL").setRequired(true)))
.addSubcommand(s=>s.setName("pause").setDescription("Pause")).addSubcommand(s=>s.setName("resume").setDescription("Resume"))
.addSubcommand(s=>s.setName("skip").setDescription("Skip")).addSubcommand(s=>s.setName("stop").setDescription("Stop"))
.addSubcommand(s=>s.setName("queue").setDescription("Queue")).addSubcommand(s=>s.setName("nowplaying").setDescription("Now playing"))
.addSubcommand(s=>s.setName("volume").setDescription("Volume").addIntegerOption(o=>o.setName("percent").setDescription("1-150").setRequired(true).setMinValue(1).setMaxValue(150)))];

const search=async q=>(await player.search(q,{searchEngine:"ext:"+SoundCloudExtractor.identifier})).tracks.slice(0,5);
const label=t=>(t.title||"Unknown")+" — "+(t.author||"Unknown");

async function start(i,t){
 const v=i.member?.voice?.channel;if(!v)throw Error("Join a voice channel first.");
 return player.play(v,t,{nodeOptions:{metadata:i.channel,bufferingTimeout:15000,leaveOnStop:true,leaveOnEnd:true,leaveOnEmpty:true,leaveOnEmptyCooldown:300000,skipOnNoStream:true}});
}

async function handleInteraction(i){
 if(!i.isChatInputCommand()||i.commandName!=="music")return false;
 const sub=i.options.getSubcommand();
 if(sub==="search"){
  await i.deferReply();try{
   const ts=await search(i.options.getString("query",true));if(!ts.length)return i.editReply("❌ No SoundCloud tracks found.");
   searches.set(i.id,ts);
   const menu=new StringSelectMenuBuilder().setCustomId("music_result:"+i.id).setPlaceholder("🎵 Select a track").addOptions(ts.map((t,n)=>({label:t.title.slice(0,100),description:(t.author||"Unknown").slice(0,100),value:String(n)})));
   return i.editReply({embeds:[new EmbedBuilder().setTitle("🎵 Music Search").setDescription(ts.map((t,n)=>"**"+(n+1)+".** "+label(t)).join("\n")).setColor(0x5865F2)],components:[new ActionRowBuilder().addComponents(menu)]});
  }catch(e){console.error(e);return i.editReply("❌ Search failed: "+e.message)}
 }
 if(sub==="play"){
  await i.deferReply();try{const t=(await search(i.options.getString("query",true)))[0];if(!t)throw Error("No playable SoundCloud track found.");await start(i,t);return i.editReply({embeds:[new EmbedBuilder().setTitle("▶️ Now Playing").setDescription("**"+label(t)+"**").setColor(0x5865F2)]})}catch(e){console.error(e);return i.editReply("❌ Playback failed: "+e.message)}
 }
 let q=player?.nodes.get(i.guildId);
 if(sub==="pause"){if(!q)return i.reply({content:"❌ Nothing is playing.",ephemeral:true});q.node.setPaused(true);return i.reply("⏸️ Paused.")}
 if(sub==="resume"){if(!q)return i.reply({content:"❌ Nothing is playing.",ephemeral:true});q.node.setPaused(false);return i.reply("▶️ Resumed.")}
 if(sub==="skip"){if(!q)return i.reply({content:"❌ Nothing is playing.",ephemeral:true});await q.node.skip();return i.reply("⏭️ Skipped.")}
 if(sub==="stop"){if(!q)return i.reply({content:"❌ Music is not active.",ephemeral:true});q.delete();return i.reply("⏹️ Stopped.")}
 if(sub==="queue"){if(!q)return i.reply("📭 Queue is empty.");const a=q.tracks.toArray().slice(0,10).map((t,n)=>(n+1)+". "+label(t));if(q.currentTrack)a.unshift("▶️ "+label(q.currentTrack));return i.reply({embeds:[new EmbedBuilder().setTitle("🎵 Queue").setDescription(a.join("\n")||"Empty").setColor(0x5865F2)]})}
 if(sub==="nowplaying")return i.reply({embeds:[new EmbedBuilder().setTitle("▶️ Now Playing").setDescription(q?.currentTrack?"**"+label(q.currentTrack)+"**":"Nothing is playing.").setColor(0x5865F2)]});
 if(sub==="volume"){if(!q)return i.reply({content:"❌ Music is not active.",ephemeral:true});q.node.setVolume(i.options.getInteger("percent",true));return i.reply("🔊 Volume updated.")}
 return true;
}

function attach(client){
 try{
  player=new Player(client);player.extractors.register(SoundCloudExtractor);
  player.on("debug",m=>console.log("[Music]",m));player.events.on("playerError",(q,e)=>console.error("[Music] Player error",e));player.events.on("error",(q,e)=>console.error("[Music] Queue error",e));
  console.log("Discord Player + SoundCloud music system ready.");
 }catch(e){console.error("Music init failed:",e)}
 client.on("interactionCreate",async i=>{
  if(!i.isStringSelectMenu()||!i.customId.startsWith("music_result:"))return;
  const t=searches.get(i.customId.slice(13))?.[Number(i.values[0])];if(!t)return i.reply({content:"❌ Search expired.",ephemeral:true});
  await i.deferUpdate();try{await start(i,t);await i.message.edit({content:"",embeds:[new EmbedBuilder().setTitle("▶️ Now Playing").setDescription("**"+label(t)+"**").setColor(0x5865F2)],components:[]})}catch(e){console.error(e);await i.message.edit({content:"❌ Playback failed: "+e.message,components:[]}).catch(()=>{})}
 });
}
module.exports={commands,handleInteraction,attach};
