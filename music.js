const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");
const { LavalinkManager } = require("lavalink-client");

let manager = null;
const searches = new Map();

function config() {
  if (!process.env.LAVALINK_HOST || !process.env.LAVALINK_PASSWORD) {
    throw new Error("Lavalink is not configured. Set LAVALINK_HOST and LAVALINK_PASSWORD.");
  }
  return {
    host: process.env.LAVALINK_HOST,
    password: process.env.LAVALINK_PASSWORD,
    port: Number(process.env.LAVALINK_PORT || 2333),
    secure: String(process.env.LAVALINK_SECURE || "false").toLowerCase() === "true",
    source: process.env.LAVALINK_SEARCH_PREFIX || ""
  };
}

function getManager() {
  if (!manager) throw new Error("Music system is still starting.");
  return manager;
}

function getNode() {
  const node = getManager().nodeManager.leastUsedNodes("memory")[0];
  if (!node) throw new Error("No Lavalink node is available.");
  return node;
}

function playerFor(guildId) {
  return getManager().getPlayer(guildId);
}

async function ensurePlayer(interaction) {
  const voice = interaction.member?.voice?.channel;
  if (!voice) throw new Error("Join a voice channel first.");

  let player = playerFor(interaction.guildId);
  if (!player) {
    player = getManager().createPlayer({
      guildId: interaction.guildId,
      voiceChannelId: voice.id,
      textChannelId: interaction.channelId,
      selfDeaf: true,
      selfMute: false
    });
  } else {
    player.voiceChannelId = voice.id;
  }

  if (!player.connected) await player.connect();
  return player;
}

async function searchMusic(query) {
  const prefix = config().source;
  if (!prefix) throw new Error("Set LAVALINK_SEARCH_PREFIX in the bot environment.");

  const result = await getNode().search({ query, source: prefix }, null, false);
  return (result?.tracks || []).slice(0, 5);
}

function label(track) {
  return (track?.info?.title || "Unknown track") +
    " — " + (track?.info?.author || "Unknown artist");
}

async function addTrack(interaction, track) {
  const player = await ensurePlayer(interaction);
  const wasPlaying = !!player.queue.current || player.playing;
  await player.queue.add(track);
  if (!player.playing && !player.paused) await player.play();
  return { player, wasPlaying };
}

const commands = [
  new SlashCommandBuilder()
    .setName("music")
    .setDescription("Full-track music player.")
    .addSubcommand(s => s.setName("search").setDescription("Search for a track.")
      .addStringOption(o => o.setName("query").setDescription("Song or artist.").setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName("play").setDescription("Play a track or audio URL.")
      .addStringOption(o => o.setName("query").setDescription("Track name or audio URL.").setRequired(true).setMaxLength(300)))
    .addSubcommand(s => s.setName("pause").setDescription("Pause playback."))
    .addSubcommand(s => s.setName("resume").setDescription("Resume playback."))
    .addSubcommand(s => s.setName("skip").setDescription("Skip the current track."))
    .addSubcommand(s => s.setName("stop").setDescription("Stop music and clear the queue."))
    .addSubcommand(s => s.setName("queue").setDescription("Show the queue."))
    .addSubcommand(s => s.setName("nowplaying").setDescription("Show the current track."))
    .addSubcommand(s => s.setName("volume").setDescription("Set volume.")
      .addIntegerOption(o => o.setName("percent").setDescription("1 to 150.").setRequired(true).setMinValue(1).setMaxValue(150)))
];

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "music") return false;

  const sub = interaction.options.getSubcommand();

  if (sub === "search") {
    const query = interaction.options.getString("query", true);
    await interaction.deferReply();

    try {
      const tracks = await searchMusic(query);
      if (!tracks.length) {
        await interaction.editReply("No tracks found.");
        return true;
      }

      searches.set(interaction.id, tracks);

      const menu = new StringSelectMenuBuilder()
        .setCustomId("music_result:" + interaction.id)
        .setPlaceholder("Select a full track")
        .addOptions(tracks.map((track, index) => ({
          label: (track.info.title || "Unknown").slice(0, 100),
          description: (track.info.author || "Unknown artist").slice(0, 100),
          value: String(index)
        })));

      const text = tracks.map((track, index) => {
        const ms = Number(track.info.length || 0);
        const duration = Math.floor(ms / 60000) + ":" +
          Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
        return "**" + (index + 1) + ".** " + label(track) + " • " + duration;
      }).join("\n");

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Music Search")
            .setDescription(text)
            .setColor(0x5865F2)
            .setFooter({ text: "Full-track playback through Lavalink" })
        ],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    } catch (error) {
      await interaction.editReply("Search failed: " + error.message);
    }
    return true;
  }

  if (sub === "play") {
    await interaction.deferReply();

    try {
      const query = interaction.options.getString("query", true);
      let track;

      if (/^https?:\/\//i.test(query)) {
        const result = await getNode().search({ query }, null, false);
        track = result?.tracks?.[0];
      } else {
        track = (await searchMusic(query))[0];
      }

      if (!track) throw new Error("No playable track was found.");

      const { wasPlaying } = await addTrack(interaction, track);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(wasPlaying ? "Added to Queue" : "Now Playing")
            .setDescription("**" + label(track) + "**")
            .setColor(0x5865F2)
        ]
      });
    } catch (error) {
      await interaction.editReply("Playback failed: " + error.message);
    }
    return true;
  }

  const player = playerFor(interaction.guildId);

  if (sub === "pause") {
    if (!player?.playing) return interaction.reply({ content: "Nothing is playing.", ephemeral: true }).then(() => true);
    await player.pause(true);
    await interaction.reply("Music paused.");
    return true;
  }

  if (sub === "resume") {
    if (!player?.paused) return interaction.reply({ content: "Nothing is paused.", ephemeral: true }).then(() => true);
    await player.pause(false);
    await interaction.reply("Music resumed.");
    return true;
  }

  if (sub === "skip") {
    if (!player?.playing) return interaction.reply({ content: "Nothing is playing.", ephemeral: true }).then(() => true);
    await player.skip();
    await interaction.reply("Skipped.");
    return true;
  }

  if (sub === "stop") {
    if (!player) return interaction.reply({ content: "Music is not active.", ephemeral: true }).then(() => true);
    await player.queue.clear();
    await player.destroy("Stopped by user.");
    await interaction.reply("Music stopped and the queue was cleared.");
    return true;
  }

  if (sub === "queue") {
    const lines = [];
    if (player?.queue?.current) lines.push("Now: **" + label(player.queue.current) + "**");
    for (const [i, track] of (player?.queue?.tracks || []).slice(0, 10).entries()) {
      lines.push((i + 1) + ". " + label(track));
    }
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Music Queue")
          .setDescription(lines.length ? lines.join("\n") : "Queue is empty.")
          .setColor(0x5865F2)
      ]
    });
    return true;
  }

  if (sub === "nowplaying") {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Now Playing")
          .setDescription(player?.queue?.current ? "**" + label(player.queue.current) + "**" : "Nothing is playing.")
          .setColor(0x5865F2)
      ]
    });
    return true;
  }

  if (sub === "volume") {
    if (!player) return interaction.reply({ content: "Music is not active.", ephemeral: true }).then(() => true);
    const percent = interaction.options.getInteger("percent", true);
    await player.setVolume(percent);
    await interaction.reply("Volume set to **" + percent + "%**.");
    return true;
  }

  return true;
}

function attach(client) {
  try {
    const c = config();

    manager = new LavalinkManager({
      nodes: [{
        id: "main",
        host: c.host,
        port: c.port,
        authorization: c.password,
        secure: c.secure
      }],
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild?.shard) guild.shard.send(payload);
      },
      autoSkip: true,
      client: {
        id: process.env.CLIENT_ID,
        username: "MusicBot"
      }
    });

    client.on("raw", packet => {
      try { manager.sendRawData(packet); }
      catch (error) { console.error("Lavalink packet error:", error.message); }
    });

    client.once("ready", async () => {
      try {
        await manager.init({ ...client.user });
        console.log("Lavalink music system connected.");
      } catch (error) {
        console.error("Lavalink initialization failed:", error);
      }
    });

    manager.on("nodeConnect", node => console.log("Lavalink node connected:", node.id || "main"));
    manager.on("nodeError", (node, error) => console.error("Lavalink node error:", error?.message || error));
    manager.on("trackStart", (player, track) => console.log("Track started:", track?.info?.title || "Unknown"));
    manager.on("trackError", (player, track, error) => console.error("Track error:", error?.message || error));
  } catch (error) {
    console.error("Music configuration error:", error.message);
  }

  client.on("interactionCreate", async interaction => {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith("music_result:")) return;

    const results = searches.get(interaction.customId.slice("music_result:".length));
    const track = results?.[Number(interaction.values[0])];

    if (!track) {
      await interaction.reply({ content: "This search has expired. Search again.", ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    try {
      const { wasPlaying } = await addTrack(interaction, track);
      await interaction.message.edit({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setTitle(wasPlaying ? "Added to Queue" : "Now Playing")
            .setDescription("**" + label(track) + "**")
            .setColor(0x5865F2)
        ],
        components: []
      });
    } catch (error) {
      await interaction.message.edit({ content: "Playback failed: " + error.message, components: [] }).catch(() => {});
    }
  });

  client.on("voiceStateUpdate", async (oldState, newState) => {
    const player = manager?.getPlayer(newState.guild.id);
    if (!player?.voiceChannelId) return;

    const channel = newState.guild.channels.cache.get(player.voiceChannelId);
    if (!channel) return;

    if (!channel.members.filter(member => !member.user.bot).size) {
      await player.destroy("Voice channel became empty.").catch(() => {});
    }
  });
}

module.exports = { commands, handleInteraction, attach };
