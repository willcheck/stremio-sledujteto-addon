const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://www.sledujteto.cz";
const builder = addonBuilder({
    id: "org.stremio.sledujteto",
    version: "1.0.0",
    name: "SledujTo.cz",
    description: "Filmy a seriály zo sledujteto.cz",
    types: ["movie", "series"],
    catalogs: [],
    resources: ["stream"],
    idPrefixes: ["tt"]
});

function sanitizeTitle(title) {
    return title.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase().trim();
}

async function searchSledujTo(query) {
    try {
        const res = await axios.get(`${BASE_URL}/search`, { params: { search: query } });
        const $ = cheerio.load(res.data);

        const results = [];
        $("a.film-title").each((_, el) => {
            const link = $(el).attr("href");
            const name = $(el).text().trim();
            if (link && name) {
                results.push({
                    name,
                    link: BASE_URL + link
                });
            }
        });

        return results;
    } catch (e) {
        console.error("Search error:", e.message);
        return [];
    }
}

async function extractStreams(detailUrl) {
    try {
        const res = await axios.get(detailUrl);
        const $ = cheerio.load(res.data);
        const sources = [];

        $("iframe").each((_, el) => {
            const src = $(el).attr("src");
            if (src && (src.includes("filemoon") || src.includes("streamtape") || src.includes("mixdrop"))) {
                sources.push({
                    title: "Sleduj.to",
                    url: src,
                    behaviorHints: { notWebReady: true }
                });
            }
        });

        return sources;
    } catch (e) {
        console.error("Stream extraction error:", e.message);
        return [];
    }
}

builder.defineStreamHandler(async ({ type, id }) => {
    const imdbId = id.split(":")[0];
    console.log(`Stream request for ${imdbId}`);

    const imdbRes = await axios.get(`https://www.imdb.com/title/${imdbId}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    const $ = cheerio.load(imdbRes.data);
    const title = $("title").text().split(" - ")[0];

    const results = await searchSledujTo(title);
    if (results.length === 0) return { streams: [] };

    const detailUrl = results[0].link;
    const streams = await extractStreams(detailUrl);

    return { streams };
});

builder.defineCatalogHandler(() => ({ metas: [] }));

console.log("📺 Sledujto addon beží na http://localhost:7000/manifest.json");
serveHTTP(builder.getInterface(), { port: 7000 });
