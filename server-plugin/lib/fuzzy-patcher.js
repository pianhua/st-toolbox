/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(s1, s2) {
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const v0 = new Array(s2.length + 1);
    const v1 = new Array(s2.length + 1);

    for (let i = 0; i <= s2.length; i++) v0[i] = i;

    for (let i = 0; i < s1.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < s2.length; j++) {
            const cost = s1[i] === s2[j] ? 0 : 1;
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= s2.length; j++) v0[j] = v1[j];
    }

    return v1[s2.length];
}

/**
 * Similarity ratio (0.0 to 1.0)
 */
function similarity(s1, s2) {
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    return 1.0 - levenshteinDistance(s1, s2) / maxLen;
}

export class FuzzyPatcher {
    /**
     * Apply single replacement with multi-tier fallback (Exact -> Normalized -> Fuzzy)
     */
    static replace(originalContent, oldText, newText, expectedCount = 1) {
        if (!oldText) {
            throw new Error('oldText is required for replacement');
        }

        // Normalize line endings for reliable comparison
        const normOriginal = originalContent.replace(/\r\n/g, '\n');
        const normOldText = oldText.replace(/\r\n/g, '\n');
        const normNewText = (newText ?? '').replace(/\r\n/g, '\n');

        // 1. Exact Match
        if (normOriginal.includes(normOldText)) {
            const occurrences = normOriginal.split(normOldText).length - 1;
            if (expectedCount > 0 && occurrences !== expectedCount) {
                throw new Error(
                    `Safety Check Failed: Expected ${expectedCount} occurrence(s) of target text, but found ${occurrences}. Please provide more surrounding context lines to make it unique.`,
                );
            }
            return {
                success: true,
                content: normOriginal.replaceAll(normOldText, normNewText),
                strategy: 'exact',
                replacedCount: occurrences,
            };
        }

        // 2. Line-Trimmed & Whitespace-Tolerant Match
        const origLines = normOriginal.split('\n');
        const oldLines = normOldText.split('\n');

        const trimmedOldLines = oldLines.map(l => l.trimEnd());
        const matchStarts = [];

        for (let i = 0; i <= origLines.length - oldLines.length; i++) {
            let matches = true;
            for (let j = 0; j < oldLines.length; j++) {
                if (origLines[i + j].trimEnd() !== trimmedOldLines[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                matchStarts.push(i);
            }
        }

        if (matchStarts.length > 0) {
            if (expectedCount > 0 && matchStarts.length !== expectedCount) {
                throw new Error(
                    `Safety Check Failed: Found ${matchStarts.length} whitespace-tolerant match(es), expected ${expectedCount}. Provide more unique context.`,
                );
            }

            // Apply replacement at matched line index
            const startLineIdx = matchStarts[0];
            const newLines = normNewText.split('\n');
            const resultLines = [
                ...origLines.slice(0, startLineIdx),
                ...newLines,
                ...origLines.slice(startLineIdx + oldLines.length),
            ];

            return {
                success: true,
                content: resultLines.join('\n'),
                strategy: 'line-trimmed',
                replacedCount: matchStarts.length,
                matchedLine: startLineIdx + 1,
            };
        }

        // 3. Fuzzy Context Search (> 0.85 similarity)
        let bestSim = 0;
        let bestIdx = -1;

        for (let i = 0; i <= origLines.length - oldLines.length; i++) {
            const candidateWindow = origLines.slice(i, i + oldLines.length).join('\n');
            const sim = similarity(candidateWindow, normOldText);
            if (sim > bestSim) {
                bestSim = sim;
                bestIdx = i;
            }
        }

        if (bestSim >= 0.85 && bestIdx !== -1) {
            const newLines = normNewText.split('\n');
            const resultLines = [
                ...origLines.slice(0, bestIdx),
                ...newLines,
                ...origLines.slice(bestIdx + oldLines.length),
            ];

            return {
                success: true,
                content: resultLines.join('\n'),
                strategy: 'fuzzy',
                confidence: Math.round(bestSim * 100) + '%',
                matchedLine: bestIdx + 1,
                replacedCount: 1,
            };
        }

        // 4. Match Failed: Generate Self-Correction Diagnostics
        const diagnostics = this.#generateDiagnostics(origLines, oldLines, bestIdx, bestSim);
        throw new Error(`Target text (oldText) could not be matched in file.\n\n${diagnostics}`);
    }

    /**
     * Apply Unified Diff format
     */
    static applyUnifiedDiff(originalContent, diffString) {
        const lines = originalContent.replace(/\r\n/g, '\n').split('\n');
        const diffLines = diffString.replace(/\r\n/g, '\n').split('\n');

        let currentLine = 0;
        const result = [];
        let inHunk = false;

        for (const dLine of diffLines) {
            if (dLine.startsWith('@@')) {
                // Parse @@ -start,count +start,count @@
                const match = dLine.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
                if (match) {
                    const startOrig = parseInt(match[1]) - 1;
                    // Catch up lines
                    while (currentLine < startOrig && currentLine < lines.length) {
                        result.push(lines[currentLine++]);
                    }
                    inHunk = true;
                    continue;
                }
            }

            if (!inHunk) continue;

            if (dLine.startsWith('-')) {
                // Remove line from original
                currentLine++;
            } else if (dLine.startsWith('+')) {
                // Add new line
                result.push(dLine.slice(1));
            } else if (dLine.startsWith(' ')) {
                // Context line
                result.push(lines[currentLine++]);
            }
        }

        // Append remaining lines
        while (currentLine < lines.length) {
            result.push(lines[currentLine++]);
        }

        return result.join('\n');
    }

    static #generateDiagnostics(origLines, oldLines, bestIdx, bestSim) {
        let out = '--- Diagnostic Hint for LLM Self-Correction ---\n';
        if (bestIdx !== -1 && bestSim > 0.4) {
            const contextStart = Math.max(0, bestIdx - 2);
            const contextEnd = Math.min(origLines.length, bestIdx + oldLines.length + 2);
            out += `Closest match found around line ${bestIdx + 1} (similarity: ${Math.round(bestSim * 100)}%):\n`;
            out += '```\n';
            for (let i = contextStart; i < contextEnd; i++) {
                const marker = (i >= bestIdx && i < bestIdx + oldLines.length) ? '>>>' : '   ';
                out += `${marker} ${i + 1}: ${origLines[i]}\n`;
            }
            out += '```\n';
            out += 'Please check line indentation, spacing, or surrounding context and retry.';
        } else {
            out += `No similar text found across all ${origLines.length} lines. Use read_file to check the current file contents first.`;
        }
        return out;
    }
}
