// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { LogEntry } from './get_log.js';
import { plural } from './utils.js';

// Size of the log in characters
type LogChars = (logLines: LogEntry[]) => number;

// Exclude score 0 log lines if there are higher scores
export function excludeZeroScoreLog(logLines: LogEntry[], alwaysExclude = false): LogEntry[] {
    const anyNonZero = logLines.some(line => 0 < line.score);
    if (!alwaysExclude && !anyNonZero) return logLines;
    const filteredLogLines = logLines.filter(line => 0 < line.score);
    const excludedCount = logLines.length - filteredLogLines.length;
    core.info(`${plural(filteredLogLines.length, 'log line')} after excluding ${plural(excludedCount, 'zero-score line')}`);
    return filteredLogLines;
}

// Truncate log lines to fit within the model's input context
export function truncateLog(logLines: LogEntry[], maxChars: number, getChars: LogChars): LogEntry[] {
    // Log progress fitting the log lines within the available input context
    function logProgress(description: string): void {
        const chars = getChars(logLines);
        const deltaPercent = 100 * (chars - maxChars) / maxChars;
        const underOver = 0 < deltaPercent ? 'over' : 'under';
        core.info(`Progress [${description}]: ${plural(chars, 'character')}`
                + ` ${Math.abs(deltaPercent).toFixed(1)}% ${underOver} budget`
                + ` (${plural(logLines.length, 'log line')})`);
    }
    logProgress('Initial log lines');

    // Sort log lines by priority (descending score, then descending index)
    logLines = logLines.toSorted((a, b) => b.score - a.score || b.index - a.index);

    // Drop lowest priority lines until fits or only highest score remains
    logLines = fitByOmission(logLines, maxChars, getChars);
    logProgress('Selected log lines');

    // Truncate log lines if still too long
    logLines = fitByLineTruncation(logLines, maxChars, getChars);
    logProgress('Truncated log lines');

    // Return the truncated log lines in their original (chronological) order
    return logLines.sort((a, b) => a.index - b.index);
}

// Attempt to fit log lines within budget by omitting lower priority lines
function fitByOmission(logLines: LogEntry[], maxChars: number, getChars: LogChars): LogEntry[] {
    // Minimum number of lines to keep (equal highest score)
    const highestScore = logLines[0]?.score ?? 0;
    let minLines = logLines.findIndex(line => line.score < highestScore);
    if (minLines === -1) return logLines;
    let maxLines = logLines.length;

    // Binary search to find the highest limit within available size
    while (minLines < maxLines) {
        const testLines = Math.ceil((minLines + maxLines) / 2);
        const testChars = getChars(logLines.slice(0, testLines));
        if (testChars <= maxChars)  minLines = testLines;
        else                        maxLines = testLines - 1;
    }
    return logLines.slice(0, maxLines);
}

// Fit log lines within the budget by truncating to a maximum length
function fitByLineTruncation(logLines: LogEntry[], maxChars: number, getChars: LogChars): LogEntry[] {
    let minLineChars = 1;
    let maxLineChars = Math.max(...logLines.map((l) => l.line.length), 0);

    // Binary search to find the highest limit within available size
    while (minLineChars < maxLineChars) {
        const testLineChars = Math.ceil((minLineChars + maxLineChars) / 2);
        const testChars = getChars(makeTruncatedLogLines(logLines, testLineChars));
        if (testChars <= maxChars)  minLineChars = testLineChars;
        else                        maxLineChars = testLineChars - 1;
    }
    return makeTruncatedLogLines(logLines, maxLineChars);
}

// Create truncated versions of the log lines
function makeTruncatedLogLines(logLines: LogEntry[], maxChars: number): LogEntry[] {
    return logLines.map(({ line, ...rest }) => ({
        line: line.length <= maxChars ? line : line.substring(0, maxChars - 1) + '…',
        ...rest
    }));
}
