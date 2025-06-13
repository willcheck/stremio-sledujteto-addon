const axios = require("axios");
const cheerio = require("cheerio");

// Tvoje TMDB API token (bearer)
const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9....";

async function lookupTitle(imdbId, type, season, episode) {
  const res = await axios.get(
    `https://api.themoviedb.org/3/find/${imdbId}`,
    {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
      params: { external_source: "imdb_id", language: "cs-CZ" }
    }
  );
  const obj = type === "movie" ? res.data.movie_results[0] : res.data.tv_results[0];
  if (!obj) throw new Error("Nebolo nájdené v TMDB");

  let name = obj.title || obj.name;
  if (type === "movie") {
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return { slug, urlPrefix: "film" };
  } else {
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return { slug: `${slug}-${season}x${episode}`, urlPrefix: "serial" };
  }
}

async function getStreamsForSledujteto(imdbId, type, season, episode) {
  try {
    const { slug, urlPrefix } = await lookupTitle(imdbId, type, season, episode);
    const url = `https://www.sledujteto.cz/vyhledat/${slug}.html`;
    console.log("➡️ Hľadám na URL", url);

    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    // Inicializácia JW Playera cez attribute data-ng-init
    const initScript = $("#player").attr("data-ng-init");
    const match = initScript && initScript.match(/init\((\d+),\s*'([^']+)'/);
    if (!match) throw new Error("Nezistený init JW Playera");

    const fileId = match[1];
    const apiUrl = match[2]; // napr. https://data11.sledujteto.cz/player/index/sledujteto/

    const info = await axios.get(`${apiUrl}${fileId}`);
    const fileUrl = info.data.sources?.[0]?.file;
    const label = info.data.tracks?.map(t => t.label).join(", ");
    const params = {};
    $(".parameters-wrapper table tr").each((i, tr) => {
      const k = $(tr).find("td").eq(1).text().trim();
      const v = $(tr).find("td").eq(2).text().trim();
      params[k] = v;
    });

    return [{
      name: `JW Player • ${label} • ${params["Rozlišení"] || params["Velikost"] || ""}`,
      title: label,
      url: fileUrl,
      behaviorHints: {
        videoSize: params["Velikost"] ? parseFloat(params["Velikost"]) * 1024 * 1024 : undefined,
        displayTitle: slug
      }
    }];
  } catch (e) {
    console.error("❌ Chyba pri získavaní sledujteto:", e.message);
    return [];
  }
}

module.exports = { getStreamsForSledujteto };
