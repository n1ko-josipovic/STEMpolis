import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'mrežna stranica', 'releases.json');
const repositorySlug = process.env.GITHUB_REPOSITORY || 'n1ko-josipovic/STEMpolis';
const [owner, repo] = repositorySlug.split('/');
const repositoryUrl = `https://github.com/${owner}/${repo}`;

function platformForAsset(name) {
    if (/\.exe$/i.test(name)) return 'windows';
    if (/\.dmg$/i.test(name) || (/mac/i.test(name) && /\.zip$/i.test(name))) return 'macos';
    if (/\.(appimage|deb|rpm)$/i.test(name)) return 'linux';
    return 'other';
}

const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'STEMpolis-release-data-generator',
    'X-GitHub-Api-Version': '2022-11-28'
};

if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, { headers });

if (!response.ok) {
    throw new Error(`GitHub Releases API vratio je ${response.status} ${response.statusText}.`);
}

const payload = await response.json();
if (!Array.isArray(payload)) {
    throw new Error('GitHub Releases API nije vratio popis izdanja.');
}

const releases = payload
    .filter((release) => !release.draft && !release.prerelease)
    .sort((left, right) => Date.parse(right.published_at) - Date.parse(left.published_at))
    .map((release) => ({
        tagName: release.tag_name,
        name: release.name || release.tag_name,
        publishedAt: release.published_at,
        htmlUrl: release.html_url,
        body: release.body || '',
        assets: release.assets.map((asset) => ({
            name: asset.name,
            browserDownloadUrl: asset.browser_download_url,
            size: asset.size,
            contentType: asset.content_type,
            downloadCount: asset.download_count,
            platform: platformForAsset(asset.name)
        }))
    }));

const output = {
    generatedAt: new Date().toISOString(),
    repository: {
        owner,
        name: repo,
        releasesUrl: `${repositoryUrl}/releases`
    },
    releases
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Spremljeno ${releases.length} izdanja u ${outputPath}.`);
