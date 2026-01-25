// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import { formatList, plural } from './utils.js';

// Scored log entries
export interface LogEntry {
    score:  number; // 0 - 100
    line:   string;
    index:  number;
}

// A pattern with associated score
interface LogPattern {
    score:  number;
    re:     RegExp;
}

// Patterns to recognise important log entries
const LOG_REGEXP: LogPattern[] = [
    // GitHub Actions workflow commands
    { score: 90,    re: /^::error/ },
    { score: 80,    re: /^::warning/ }
];

// Scores used for other log lines
const SCORE_UNMATCHED       = 0;
const SCORE_USER_PATTERN    = 50;

// Match line endings (allowing CRLF, CR, or LF)
const LINE_ENDING = /\r\n|(?<!\r)\n|\r(?!\n)/g;

// Match ANSI colour codes (including textual representation of escape code)
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /(?:\x1B|ESC)\[[0-9;]*[msuK]/g;

// Read the log file and score each line using the supplied patterns
export function getLogLines(log_file: string, log_regexps: string[]): LogEntry[] {
    // Read the log file
    const log = readFileSync(log_file, { encoding: 'utf-8'});
    const lines = log.split(LINE_ENDING);

    // Prepare the regular expressions to test against the log
    const patterns = makeRegexps(log_regexps);

    // Score each line of the log
    const scoreCounts = new Map<number, number>();
    const scored = lines.map((rawLine, index) => {
        const line = rawLine.replaceAll(ANSI_ESCAPE, '').trim();
        const score = patterns.reduce(
            (acc, { re, score }) => re.test(line) || re.test(rawLine) ? Math.max(acc, score) : acc,
            SCORE_UNMATCHED);
        scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
        return { line, score, index };
    });

    // Log a summary of the scoring
    const scoreSummary = [...scoreCounts.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([score, count]) => `${plural(count, 'line')} × ${score}`);
    core.info(`Log scoring: ${formatList(scoreSummary)}`);
    const debugScored = scored.map(({ score, line }) => `[${score}]: ${line}`);
    core.debug(`Scored log:\n${debugScored.join('\n')}`);
    return scored;
}

// Prepare the regular expressions to test against the log
function makeRegexps(log_regexps: string[]): LogPattern[] {
    const patterns = [...LOG_REGEXP];
    for (const log_regexp of log_regexps) {
        if (!log_regexp) continue; // getMultilineInput trims *after* filtering blanks
        const [, score, pattern, flags] = /^(?:(\d+)\s+)?\/((?:\\.|[^\\/])+)\/([iuv]*)$/.exec(log_regexp) ?? [];
        if (!pattern || flags === undefined) throw new Error(`Invalid log_regexps pattern: ${log_regexp}`);
        patterns.push({
            score: score !== undefined ? Number(score) : SCORE_USER_PATTERN,
            re:    new RegExp(pattern, flags)
        });
    }
    return patterns;
}