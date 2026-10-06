const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Player } = require("discord-player");
const { DefaultExtractors, SoundCloudExtractor } = require("@discord-player/extractor");
const ffmpegPath = require("ffmpeg-static");

let player = null;
const searches = new Map();

const commands = [
  new SlashCommandBuilder().setName("music").setDescription("Music player")
    .addSubcommand(s => s.setName("search").setDescription("Search music").addStringOption(o => o.setName("query").setDescription("Song, artist or link").setRequired(true)))
    .addSubcommand(s => s.setName("play").setDescription("Play music").addStringOption(o => o.setName("query").setDescription("Song, artist or link").setRequired(true)))
    .addSubcommand(s => s.setName("pause").setDescription("Pause"))
    .addSubcommand(s => s.setName("resume").setDescription("Resume"))
    .addSubcommand(s => s.setName("skip").setDescription("Skip"))
    .addSubcommand(s => s.setName("stop").setDescription("Stop"))
    .addSubcommand(s => s.setName("queue").setDescription("Show queue"))
    .addSubcommand(s => s.setName("nowplaying").setDescription("Now playing"))
    .addSubcommand(s => s.setName("volume").setDescription("Set volume").addIntegerOption(o => o.setName("percent").setDescription("1-150").setMinValue(1).setMaxValue(150).setRequired(true)))
    .addSubcommand(s => s.setName("autoplay").setDescription("Toggle autoplay"))
];

function isUrl(q) {
  return /^https?:\/\//i.test(q) || /^spotify:/i.test(q) || /^soundcloud:/i.test(q);
}

function label(t) {
  return (t.title || "Unknown") + " — " + (t.author || "Unknown");
}

async function search(query) {
  if (!player) throw new Error("Music system is still starting.");
  if (isUrl(query)) {
    const r = await player.search(query);
    return r.tracks.slice(0, 10);
  }

  const [sc, general] = await Promise.all([
    player.search("scsearch:" + query).catch(() => ({tracks: []})),
    player.search(query).catch(() => ({tracks: []}))
  ]);

  const all = [...(sc.tracks || []), ...(general.tracks || [])];
  const seen = new Set();
  return all.filter(t => {
    const key = t.url || (t.title + "|" + t.author);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

const nodeOptions = {
  bufferingTimeout: 20000,
  leaveOnStop: true,
  leaveOnStopCooldown: 5000,
  leaveOnEnd: false,
  leaveOnEmpty: true,
  leaveOnEmptyCooldown: 300000,
  skipOnNoStream: false,
  selfDeaf: true
};

async function playTrack(interaction, trackOrQuery) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) throw new Error("Join a voice channel first.");

  return player.play(channel, trackOrQuery, {
    nodeOptions: {
      ...nodeOptions,
      metadata: interaction.channel
    }
  });
}

async function handleInteraction(i) {
  if (i.isChatInputCommand() && i.commandName === "music") {
    const sub = i.options.getSubcommand();

    if (sub === "search") {
      await i.deferReply();
      try {
        const tracks = await search(i.options.getString("query", true));
        if (!tracks.length) return i.editReply("❌ Nothing playable was found.");
        searches.set(i.id, tracks);

        const menu = new StringSelectMenuBuilder()
          .setCustomId("music_result:" + i.id)
          .setPlaceholder("🎵 Choose a song")
          .addOptions(tracks.map((t, n) => ({
            label: (t.title || "Unknown").slice(0, 100),
            description: ((t.author || "Unknown") + " • " + (t.source || "music")).slice(0, 100),
            value: String(n)
          })));

        return i.editReply({
          embeds: [{
            title: "🎵 Music Search",
            description: tracks.map((t, n) => "**" + (n + 1) + ".** " + label(t)).join("\n"),
            color: 0x5865F2
          }],
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      } catch (e) {
        console.error("[Music search]", e);
        return i.editReply("❌ Search failed: " + e.message);
      }
    }

    if (sub === "play") {
      await i.deferReply();
      try {
        const query = i.options.getString("query", true);
        let tracks = await search(query);
        if (!tracks.length) throw new Error("No playable track found.");

        const track = tracks[0];
        await playTrack(i, track);
        return i.editReply({
          embeds: [new EmbedBuilder().setTitle("▶️ Now Playing").setDescription("**" + label(track) + "**").setColor(0x5865F2)]
        });
      } catch (e) {
        console.error("[Music play]", e);
        return i.editReply("❌ Playback failed: " + e.message);
      }
    }

    const q = player?.nodes.get(i.guildId);

    if (sub === "pause") {
      if (!q) return i.reply({content: "❌ Nothing is playing.", ephemeral: true});
      q.node.setPaused(true);
      return i.reply("⏸️ Paused.");
    }
    if (sub === "resume") {
      if (!q) return i.reply({content: "❌ Nothing is playing.", ephemeral: true});
      q.node.setPaused(false);
      return i.reply("▶️ Resumed.");
    }
    if (sub === "skip") {
      if (!q) return i.reply({content: "❌ Nothing is playing.", ephemeral: true});
      q.node.skip();
      return i.reply("⏭️ Skipped.");
    }
    if (sub === "stop") {
      if (!q) return i.reply({content: "❌ Music is not active.", ephemeral: true});
      q.delete();
      return i.reply("⏹️ Stopped.");
    }
    if (sub === "queue") {
      if (!q) return i.reply("📭 Queue is empty.");
      const lines = [];
      if (q.currentTrack) lines.push("▶️ " + label(q.currentTrack));
      lines.push(...q.tracks.toArray().slice(0, 10).map((t, n) => (n + 1) + ". " + label(t)));
      return i.reply({embeds: [new EmbedBuilder().setTitle("🎵 Queue").setDescription(lines.join("\n") || "Empty").setColor(0x5865F2)]});
    }
    if (sub === "nowplaying") {
      return i.reply({
        embeds: [new EmbedBuilder().setTitle("▶️ Now Playing").setDescription(q?.currentTrack ? "**" + label(q.currentTrack) + "**" : "Nothing is playing.").setColor(0x5865F2)]
      });
    }
    if (sub === "volume") {
      if (!q) return i.reply({content: "❌ Music is not active.", ephemeral: true});
      q.node.setVolume(i.options.getInteger("percent", true));
      return i.reply("🔊 Volume updated.");
    }
    if (sub === "autoplay") {
      if (!q) return i.reply({content: "❌ Music is not active.", ephemeral: true});
      const next = q.repeatMode === 3 ? 0 : 3;
      q.setRepeatMode(next);
      return i.reply(next === 3 ? "🔁 Autoplay enabled." : "🔁 Autoplay disabled.");
    }
    return true;
  }

  if (i.isStringSelectMenu() && i.customId.startsWith("music_result:")) {
    const id = i.customId.slice("music_result:".length);
    const track = searches.get(id)?.[Number(i.values[0])];
    if (!track) return i.reply({content: "❌ Search expired. Run /music search again.", ephemeral: true});

    await i.deferUpdate();
    try {
      await playTrack(i, track);
      searches.delete(id);
      await i.message.edit({
        embeds: [new EmbedBuilder().setTitle("▶️ Now Playing").setDescription("**" + label(track) + "**").setColor(0x5865F2)],
        components: []
      });
    } catch (e) {
      console.error("[Music select]", e);
      await i.message.edit({content: "❌ Playback failed: " + e.message, components: []}).catch(() => {});
    }
    return true;
  }

  return false;
}

function attach(client) {
  if (player) return player;

  player = new Player(client, {
    ffmpegPath: process.env.FFMPEG_PATH || ffmpegPath || undefined,
    connectionTimeout: 30000,
    probeTimeout: 10000
  });

  player.on("debug", m => console.log("[Music]", m));
  player.events.on("debug", (q, m) => console.log("[Music DEBUG]", q?.guild?.id || "global", m));
  player.events.on("playerError", (q, e) => console.error("[Music playerError]", e));
  player.events.on("error", (q, e) => console.error("[Music error]", e));
  player.events.on("playerSkip", (q, t) => console.warn("[Music skip]", t?.title));
  player.events.on("disconnect", q => console.log("[Music] disconnected from", q?.guild?.id));
  player.events.on("emptyChannel", q => console.log("[Music] voice channel empty", q?.guild?.id));

  client.once("ready", async () => {
    try {
      await player.extractors.loadMulti(DefaultExtractors);
      console.log("🎵 Music system ready: Discord Player + multi-source extractors");
      console.log(player.scanDeps());
    } catch (e) {
      console.error("❌ Music extractor init failed:", e);
    }
  });

  return player;
}

module.exports = { commands, handleInteraction, attach };
