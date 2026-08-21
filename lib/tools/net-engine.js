import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

export class NetEngine {
    constructor(configStore) {
        this.configStore = configStore;
    }

    /**
     * Send arbitrary HTTP/HTTPS request
     */
    async httpRequest({ url, method = 'GET', headers = {}, body = null, timeout = 30000 }) {
        if (!url || typeof url !== 'string') {
            throw new Error('URL parameter is required');
        }

        const maxBytes = this.configStore.getSecurityConfig().maxOutputSize || 512 * 1024;
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const reqHeaders = {
            'User-Agent': 'SillyTavern-ST-Toolbox/2.0',
            ...headers,
        };

        if (body && typeof body === 'object') {
            body = JSON.stringify(body);
            if (!reqHeaders['Content-Type']) {
                reqHeaders['Content-Type'] = 'application/json';
            }
        }

        if (body && typeof body === 'string') {
            reqHeaders['Content-Length'] = Buffer.byteLength(body);
        }

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: method.toUpperCase(),
            headers: reqHeaders,
            timeout: parseInt(timeout) || 30000,
        };

        return new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                const chunks = [];
                let totalBytes = 0;

                res.on('data', (chunk) => {
                    if (totalBytes < maxBytes) {
                        chunks.push(chunk);
                        totalBytes += chunk.length;
                    }
                });

                res.on('end', () => {
                    const rawBody = Buffer.concat(chunks).toString('utf-8');
                    resolve({
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        headers: res.headers,
                        body: rawBody,
                        truncated: totalBytes >= maxBytes,
                    });
                });
            });

            req.on('timeout', () => {
                req.destroy(new Error(`HTTP Request timed out after ${timeout}ms`));
            });

            req.on('error', (err) => {
                reject(err);
            });

            if (body && typeof body === 'string') {
                req.write(body);
            }
            req.end();
        });
    }

    /**
     * Fetch webpage and convert HTML to clean, compact Markdown for LLM consumption
     */
    async fetchWebpage({ url, timeout = 30000, maxLength = 30000 }) {
        const response = await this.httpRequest({
            url,
            method: 'GET',
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout,
        });

        if (response.statusCode >= 400) {
            throw new Error(`HTTP Error ${response.statusCode}: ${response.statusMessage}`);
        }

        const html = response.body;
        const markdown = this.#htmlToMarkdown(html);

        let finalContent = markdown;
        let truncated = false;
        if (finalContent.length > maxLength) {
            finalContent = finalContent.slice(0, maxLength) + '\n\n... [Webpage content truncated due to length limit]';
            truncated = true;
        }

        return {
            url,
            statusCode: response.statusCode,
            content: finalContent,
            truncated,
            length: finalContent.length,
        };
    }

    #htmlToMarkdown(html) {
        if (!html) return '';

        // 1. Remove scripts, styles, comments, metadata
        let clean = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
            .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        // 2. Extract title
        let pageTitle = '';
        const titleMatch = clean.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch) pageTitle = `# ${titleMatch[1].trim()}\n\n`;

        // 3. Convert headers
        clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
        clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
        clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
        clean = clean.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
        clean = clean.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
        clean = clean.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

        // 4. Convert code blocks & inline code
        clean = clean.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
        clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, ' `$1` ');

        // 5. Convert links and images
        clean = clean.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
        clean = clean.replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*>/gi, '![$1]($2)');

        // 6. Convert lists and paragraphs
        clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
        clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
        clean = clean.replace(/<br\s*[\/]?>/gi, '\n');
        clean = clean.replace(/<hr\s*[\/]?>/gi, '\n---\n');

        // 7. Strip all remaining HTML tags
        clean = clean.replace(/<[^>]+>/g, ' ');

        // 8. Decode HTML entities
        clean = clean
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&mdash;/g, '—')
            .replace(/&ndash;/g, '–');

        // 9. Normalize whitespace and blank lines
        clean = clean
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s+\n/g, '\n\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return (pageTitle + clean).trim();
    }
}
