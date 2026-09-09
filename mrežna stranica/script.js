(function () {
    'use strict';

    var releasesUrl = 'https://github.com/n1ko-josipovic/STEMpolis/releases';
    var primaryDownload = document.getElementById('primary-download');
    var downloadMeta = document.getElementById('download-meta');
    var status = document.getElementById('release-status');
    var latestContainer = document.getElementById('latest-release');
    var olderContainer = document.getElementById('older-releases');
    var olderList = document.getElementById('older-release-list');

    function formatDate(value) {
        if (!value) return 'Datum nije naveden';
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Datum nije naveden';
        return new Intl.DateTimeFormat('hr-HR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '';
        var units = ['B', 'KB', 'MB', 'GB'];
        var index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        var value = bytes / Math.pow(1024, index);
        return value.toLocaleString('hr-HR', { maximumFractionDigits: index > 1 ? 1 : 0 }) + ' ' + units[index];
    }

    function appendInline(parent, text) {
        var pattern = /(`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
        var cursor = 0;
        var match;

        while ((match = pattern.exec(text)) !== null) {
            parent.append(document.createTextNode(text.slice(cursor, match.index)));
            var token = match[0];

            if (token.charAt(0) === '`') {
                var code = document.createElement('code');
                code.textContent = token.slice(1, -1);
                parent.append(code);
            } else {
                var linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
                var link = document.createElement('a');
                link.textContent = linkMatch[1];
                link.href = linkMatch[2];
                link.rel = 'noopener noreferrer';
                parent.append(link);
            }

            cursor = pattern.lastIndex;
        }

        parent.append(document.createTextNode(text.slice(cursor)));
    }

    function renderNotes(markdown) {
        var container = document.createElement('div');
        container.className = 'release-notes';
        var lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
        var activeList = null;

        lines.forEach(function (rawLine) {
            var line = rawLine.trim();
            if (!line) {
                activeList = null;
                return;
            }

            var heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                activeList = null;
                var headingElement = document.createElement(heading[1].length === 1 ? 'h3' : 'h4');
                appendInline(headingElement, heading[2]);
                container.append(headingElement);
                return;
            }

            var unordered = line.match(/^[-*]\s+(.+)$/);
            var ordered = line.match(/^\d+[.)]\s+(.+)$/);
            if (unordered || ordered) {
                var listName = ordered ? 'OL' : 'UL';
                if (!activeList || activeList.tagName !== listName) {
                    activeList = document.createElement(listName.toLowerCase());
                    container.append(activeList);
                }
                var item = document.createElement('li');
                appendInline(item, (unordered || ordered)[1]);
                activeList.append(item);
                return;
            }

            activeList = null;
            var paragraph = document.createElement('p');
            appendInline(paragraph, line);
            container.append(paragraph);
        });

        if (!container.childElementCount) {
            var fallback = document.createElement('p');
            fallback.textContent = 'Za ovo izdanje nisu objavljene bilješke.';
            container.append(fallback);
        }

        return container;
    }

    function userFacingAssets(release) {
        return (release.assets || []).filter(function (asset) {
            return asset.platform === 'windows' || asset.platform === 'macos' || asset.platform === 'linux';
        });
    }

    function platformLabel(platform) {
        if (platform === 'windows') return 'Windows';
        if (platform === 'macos') return 'macOS';
        if (platform === 'linux') return 'Linux';
        return 'Datoteka';
    }

    function createAssetLinks(release) {
        var list = document.createElement('div');
        list.className = 'asset-list';
        var assets = userFacingAssets(release);

        assets.forEach(function (asset) {
            var link = document.createElement('a');
            link.className = 'button asset-link';
            link.href = asset.browserDownloadUrl;

            var label = document.createElement('span');
            label.textContent = 'Preuzmi za ' + platformLabel(asset.platform);
            var meta = document.createElement('span');
            meta.className = 'asset-meta';
            meta.textContent = asset.name + (formatBytes(asset.size) ? ' · ' + formatBytes(asset.size) : '');

            link.append(label, meta);
            list.append(link);
        });

        if (!assets.length) {
            var fallback = document.createElement('a');
            fallback.href = release.htmlUrl || releasesUrl;
            fallback.textContent = 'Otvori datoteke izdanja na GitHubu';
            list.append(fallback);
        }

        return list;
    }

    function releaseTitle(release) {
        return release.name && release.name !== release.tagName
            ? release.name + ' (' + release.tagName + ')'
            : release.tagName;
    }

    function renderLatest(release) {
        var header = document.createElement('div');
        header.className = 'release-header';

        var title = document.createElement('h3');
        var titleLink = document.createElement('a');
        titleLink.href = release.htmlUrl;
        titleLink.textContent = releaseTitle(release);
        title.append(titleLink);

        var date = document.createElement('span');
        date.className = 'release-date';
        date.textContent = 'Objavljeno ' + formatDate(release.publishedAt);
        header.append(title, date);

        latestContainer.replaceChildren(header, renderNotes(release.body), createAssetLinks(release));
        latestContainer.hidden = false;

        var windowsAsset = (release.assets || []).find(function (asset) {
            return asset.platform === 'windows';
        });

        if (windowsAsset) {
            primaryDownload.href = windowsAsset.browserDownloadUrl;
            var size = formatBytes(windowsAsset.size);
            downloadMeta.textContent = release.tagName + ' · Windows 10/11 · 64-bit' + (size ? ' · ' + size : '');
        }
    }

    function renderOlder(releases) {
        var previous = releases.slice(1, 6);
        if (!previous.length) return;

        previous.forEach(function (release) {
            var details = document.createElement('details');
            var summary = document.createElement('summary');
            summary.textContent = releaseTitle(release) + ' · ' + formatDate(release.publishedAt);

            var content = document.createElement('div');
            content.className = 'older-release-content';
            content.append(renderNotes(release.body), createAssetLinks(release));
            details.append(summary, content);
            olderList.append(details);
        });

        olderContainer.hidden = false;
    }

    fetch('./releases.json', { cache: 'no-cache' })
        .then(function (response) {
            if (!response.ok) throw new Error('Podaci o izdanjima nisu dostupni.');
            return response.json();
        })
        .then(function (data) {
            if (!Array.isArray(data.releases) || !data.releases.length) {
                throw new Error('Još nema objavljenih stabilnih izdanja.');
            }

            status.hidden = true;
            renderLatest(data.releases[0]);
            renderOlder(data.releases);
        })
        .catch(function (error) {
            status.replaceChildren();
            status.append(document.createTextNode(error.message + ' '));
            var link = document.createElement('a');
            link.href = releasesUrl;
            link.textContent = 'Provjeri izdanja na GitHubu.';
            status.append(link);
        });
}());
