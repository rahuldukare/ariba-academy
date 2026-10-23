// Netlify build plugin: after each production deploy, tell Bing and other IndexNow search engines
// which pages are new or changed. It reads the live sitemap and hashes every listed page before the
// deploy (onPreBuild) and again after it is live (onSuccess), then submits only the differences.
// It also publishes the IndexNow key file at the site root. It never fails the build.
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_URLS = 5000;
let before = null;

const siteUrl = (inputs) => (inputs.siteUrl || process.env.URL || "").replace(/\/$/, "");

async function get(url) {
  const res = await fetch(url, {
    headers: { "Cache-Control": "no-cache", "User-Agent": "indexnow-netlify-plugin" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function sitemapUrls(site) {
  const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const xml = await get(`${site}/sitemap.xml`);
  let urls = locs(xml);
  if (/<sitemapindex/i.test(xml)) {
    const nested = await Promise.all(urls.map((u) => get(u).then(locs).catch(() => [])));
    urls = nested.flat();
  }
  const host = new URL(site).host;
  return [...new Set(urls)].filter((u) => { try { return new URL(u).host === host; } catch { return false; } }).slice(0, MAX_URLS);
}

async function snapshot(site) {
  const urls = await sitemapUrls(site);
  const hashes = {};
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(urls.slice(i, i + 6).map(async (u) => {
      try {
        const html = await get(u);
        hashes[u] = createHash("sha1").update(html.replace(/\s+/g, " ")).digest("hex");
      } catch { hashes[u] = null; }
    }));
  }
  return hashes;
}

export const onPreBuild = async ({ inputs }) => {
  if (process.env.CONTEXT && process.env.CONTEXT !== "production") return;
  try {
    before = await snapshot(siteUrl(inputs));
    console.log(`IndexNow: recorded ${Object.keys(before).length} live page(s) before deploy.`);
  } catch (err) {
    before = null;
    console.log("IndexNow: could not read the live sitemap before deploy:", err.message);
  }
};

export const onPostBuild = async ({ inputs, constants }) => {
  try {
    await writeFile(join(constants.PUBLISH_DIR, `${inputs.key}.txt`), inputs.key);
  } catch (err) {
    console.log("IndexNow: could not write key file:", err.message);
  }
};

export const onSuccess = async ({ inputs }) => {
  if (process.env.CONTEXT && process.env.CONTEXT !== "production") return;
  const site = siteUrl(inputs);
  try {
    const after = await snapshot(site);
    const changed = Object.keys(after).filter((u) => after[u] && (!before || before[u] !== after[u]));
    console.log(`IndexNow: ${changed.length} new or changed page(s) after deploy.`);
    if (!changed.length) return;
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(site).host,
        key: inputs.key,
        keyLocation: `${site}/${inputs.key}.txt`,
        urlList: changed,
      }),
      signal: AbortSignal.timeout(20000),
    });
    console.log(`IndexNow: submitted ${changed.length} URL(s), response ${res.status}`);
  } catch (err) {
    console.log("IndexNow: submission skipped (deploy is unaffected):", err.message);
  }
};
