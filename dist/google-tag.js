import fs from 'fs';
import path from 'path';
/** The measurement ID, or null when GA_MEASUREMENT_ID is empty. */
export function googleMeasurementId() {
    const id = (process.env.GA_MEASUREMENT_ID ?? '').trim();
    return id || null;
}
/** Empty unless GA_MEASUREMENT_ID is set. */
export function googleTagSnippet() {
    const id = googleMeasurementId();
    if (!id)
        return '';
    const srcId = encodeURIComponent(id);
    const configId = JSON.stringify(id);
    return `<!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${srcId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', ${configId});
    </script>`;
}
export function injectGoogleTag(html) {
    const snippet = googleTagSnippet();
    if (!snippet)
        return html;
    if (html.includes('googletagmanager.com/gtag/js'))
        return html;
    const head = html.match(/<head[^>]*>/i);
    if (!head || head.index === undefined)
        return html;
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}\n    ${snippet}${html.slice(at)}`;
}
function sendIndex(publicDir, res, next) {
    fs.readFile(path.join(publicDir, 'index.html'), 'utf8', (err, html) => {
        if (err) {
            next(err);
            return;
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.type('html').send(injectGoogleTag(html));
    });
}
/** Serve / and /index.html with the Google tag inserted when GA_MEASUREMENT_ID is set. */
export function serveIndexWithGoogleTag(publicDir) {
    return function googleTagIndex(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            next();
            return;
        }
        if (req.path !== '/' && req.path !== '/index.html') {
            next();
            return;
        }
        sendIndex(publicDir, res, next);
    };
}
export function sendIndexHtml(publicDir, res, next) {
    sendIndex(publicDir, res, next);
}
//# sourceMappingURL=google-tag.js.map