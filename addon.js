const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { getStreamsForSledujteto } = require("./scraper");
const manifest = require("./manifest.json");

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  const parts = id.split(":");
  const imdbId = parts[0];
  const season = parts[1] || null;
  const episode = parts[2] || null;

  console.log(`🔍 Hľadám stream pre ${type} ${imdbId}${season && episode ? ` S${season}E${episode}` : ""}`);
  const streams = await getStreamsForSledujteto(imdbId, type, season, episode);
  return { streams };
});

const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🚀 Sledujteto addon beží na http://localhost:${PORT}/manifest.json`);
