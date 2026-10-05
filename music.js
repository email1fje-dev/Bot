const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  StreamType,
  entersState
} = require("@discordjs/voice");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const ffmpegPath = require("ffmpeg-static");

const guilds = new Map();

function getGuildState(guildId) {
  if (!guilds.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });
    const state = {
      queue: [],
      current: null,
      player,
      connection: null,
      channelId: null,
      ffmpeg: null
    };

    player.on(AudioPlayerStatus.Idle, () => playNext(guildId));
    player.on("error", error => {
      console.error("Music player error:", error.message);
      state.current = null;
      if (state.ffmpeg) {
        state.ffmpeg.kill("SIGKILL");
        state.ffmpeg = null;
      }
      playNext(guildId);
    });

    guilds.set(guildId, state);
  }
  return guilds.get(guildId);
}

function cleanUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchAudio(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "DiscordMusicBot/1.0" },
    redirect: "follow"
  });

  if (!response.ok || !response.body) {
    throw new Error("The audio URL could not be opened.");
  }

  const contentType = response.headers.get("content-type") || "";
  const looksAudio = /^audio\//i.test(contentType) ||
    /mpeg|mp3|ogg|opus|wav|flac|aac|m4a|webm/i.test(contentType);

  if (!looksAudio && !/stream/i.test(contentType)) {
    throw new Error("The URL does not look like a direct audio stream.");
  }

  return Readable.fromWeb(response.body);
}

async function makeResource(item, state) {
  const input = await fetchAudio(item.url);

  const ffmpeg = spawn(ffmpegPath, [
    "-hide_banner",
    "-loglevel", "error",
    "-i", "pipe:0",
    "-vn",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "pipe:1"
  ], { stdio: ["pipe", "pipe", "pipe"] });

  state.ffmpeg = ffmpeg;
  input.pipe(ffmpeg.stdin);

  ffmpeg.on("error", error => {
    console.error("FFmpeg error:", error.message);
  });

  ffmpeg.on("close", () => {
    if (state.ffmpeg === ffmpeg) state.ffmpeg = null;
  });

  return createAudioResource(ffmpeg.stdout, {
    inputType: StreamType.Raw,
    metadata: item
  });
}

async function playNext(guildId) {
  const state = getGuildState(guildId);
  if (!state.connection) return;

  const next = state.queue.shift();
  if (!next) {
    state.current = null;
    return;
  }

  try {
    state.current = next;
    const resource = await makeResource(next, state);
    state.player.play(resource);
  } catch (error) {
    console.error("Music source failed:", error.message);
    state.current = null;
    playNext(guildId);
  }
}

async function connect(member, state) {
  const channel = member.voice.channel;
  if (!channel) throw new Error("Join a voice channel first.");

  if (state.connection && state.channelId !== channel.id) {
    state.connection.destroy();
    state.connection = null;
  }

  if (!state.connection) {
    state.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: member.guild.id,
      adapterCreator: member.guild.voiceAdapterCreator,
      selfDeaf: true
    });
    state.channelId = channel.id;

    await entersState(
      state.connection,
      VoiceConnectionStatus.Ready,
      15_000
    );

    state.connection.subscribe(state.player);
  }

  return channel;
}

function queueText(state) {
  if (!state.current && !state.queue.length) return "Queue is empty.";
  const lines = [];
  if (state.current) lines.push("▶️ **Now:** " + state.current.title);
  state.queue.slice(0, 10).forEach((item, i) => {
    lines.push((i + 1) + ". " + item.title);
  });
  if (state.queue.length > 10) {
    lines.push("…and " + (state.queue.length - 10) + " more.");
  }
  return lines.join("\n");
}

async function stopMusic(guildId) {
  const state = getGuildState(guildId);
  state.queue.length = 0;
  state.current = null;
  state.player.stop(true);

  if (state.ffmpeg) {
    state.ffmpeg.kill("SIGKILL");
    state.ffmpeg = null;
  }

  if (state.connection) {
    state.connection.destroy();
    state.connection = null;
    state.channelId = null;
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName("music")
    .setDescription("Play authorized direct audio streams in your voice channel.")
    .addSubcommand(s => s
      .setName("play")
      .setDescription("Add a direct audio URL to the queue.")
      .addStringOption(o => o
        .setName("url")
        .setDescription("Direct MP3/OGG/WAV/AAC/etc. audio or live stream URL.")
        .setRequired(true)))
    .addSubcommand(s => s
      .setName("radio")
      .setDescription("Play a direct internet radio/audio stream.")
      .addStringOption(o => o
        .setName("url")
        .setDescription("Direct radio stream URL.")
        .setRequired(true)))
    .addSubcommand(s => s.setName("pause").setDescription("Pause playback."))
    .addSubcommand(s => s.setName("resume").setDescription("Resume playback."))
    .addSubcommand(s => s.setName("skip").setDescription("Skip the current track."))
    .addSubcommand(s => s.setName("stop").setDescription("Stop music and clear the queue."))
    .addSubcommand(s => s.setName("queue").setDescription("Show the music queue."))
    .addSubcommand(s => s.setName("nowplaying").setDescription("Show the current track."))
];

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "music") {
    return false;
  }

  const member = interaction.member;
  const voice = member?.voice?.channel;
  const state = getGuildState(interaction.guild.id);
  const sub = interaction.options.getSubcommand();

  if (["play", "radio"].includes(sub)) {
    if (!voice) {
      await interaction.reply({
        content: "🎧 اول وارد یه Voice Channel شو.",
        ephemeral: true
      });
      return true;
    }

    const url = cleanUrl(interaction.options.getString("url", true));
    if (!url) {
      await interaction.reply({
        content: "❌ URL معتبر نیست.",
        ephemeral: true
      });
      return true;
    }

    try {
      await connect(member, state);

      const item = {
        url,
        title: sub === "radio"
          ? "📻 Internet Radio"
          : "🎵 Direct Audio Stream",
        requestedBy: interaction.user.id
      };

      const wasIdle = !state.current;
      state.queue.push(item);

      if (wasIdle) await playNext(interaction.guild.id);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(sub === "radio" ? "📻 Radio Added" : "🎵 Track Added")
            .setDescription(
              "**" + item.title + "**\n" +
              "Position: **" + (wasIdle ? "Playing now" : state.queue.length) + "**"
            )
            .setColor(0x5865F2)
        ]
      });
    } catch (error) {
      await interaction.reply({
        content: "❌ پخش نشد: " + error.message,
        ephemeral: true
      });
    }

    return true;
  }

  if (sub === "pause") {
    const ok = state.player.pause();
    return interaction.reply({
      content: ok ? "⏸️ موزیک Pause شد." : "❌ چیزی در حال پخش نیست."
    }).then(() => true);
  }

  if (sub === "resume") {
    const ok = state.player.unpause();
    return interaction.reply({
      content: ok ? "▶️ موزیک ادامه پیدا کرد." : "❌ چیزی برای Resume نیست."
    }).then(() => true);
  }

  if (sub === "skip") {
    if (!state.current) {
      await interaction.reply({ content: "❌ چیزی در حال پخش نیست.", ephemeral: true });
      return true;
    }
    state.player.stop(true);
    await interaction.reply({ content: "⏭️ Skipped." });
    return true;
  }

  if (sub === "stop") {
    await stopMusic(interaction.guild.id);
    await interaction.reply({ content: "⏹️ موزیک متوقف شد و Queue پاک شد." });
    return true;
  }

  if (sub === "queue") {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎶 Music Queue")
          .setDescription(queueText(state))
          .setColor(0x5865F2)
      ]
    });
    return true;
  }

  if (sub === "nowplaying") {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎵 Now Playing")
          .setDescription(state.current ? "**" + state.current.title + "**" : "Nothing is playing.")
          .setColor(0x5865F2)
      ]
    });
    return true;
  }

  return true;
}

function attach(client) {
  client.on("voiceStateUpdate", async (oldState, newState) => {
    const state = guilds.get(newState.guild.id);
    if (!state?.connection || state.channelId !== oldState.channelId) return;

    const channel = newState.guild.channels.cache.get(state.channelId);
    if (!channel) return;

    const humans = channel.members.filter(m => !m.user.bot);
    if (humans.size === 0) {
      await stopMusic(newState.guild.id);
    }
  });
}

module.exports = { commands, handleInteraction, attach, stopMusic };
