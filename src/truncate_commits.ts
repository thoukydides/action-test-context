// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { GitVersion, GitVersionCommit } from './get_git_version.js';
import { ResultGitVersion, ResultGitVersionCommit } from './result_context.js';
import { plural } from './utils.js';

// Commit message truncation length before omitting commits
const MAX_COMMIT_CHARS = 200;

// Minimum number of commit messages
const MIN_COMMITS = 20;

// Truncate commit history to fit within the model's input context
export function truncateCommits(version: GitVersion, maxChars: number): ResultGitVersion {
    const { commits_since_release: commits, ...rest } = version;
    let maxCommits = Infinity, maxMessageChars = Infinity;

    // Log progress fitting the commit history within available input context
    function logProgress(description: string): void {
        const chars = truncatedCommitsChars(commits, maxCommits, maxMessageChars);
        const deltaPercent = 100 * (chars - maxChars) / maxChars;
        const underOver = 0 < deltaPercent ? 'over' : 'under';
        core.info(`Progress [${description}]: ${plural(chars, 'character')}`
                + ` ${Math.abs(deltaPercent).toFixed(1)}% ${underOver} budget`
                + ` (limits: ${plural(maxCommits, 'commit')} / ${plural(maxMessageChars, 'characters')})`);
    }
    logProgress('Initial commits');

    // First try truncating commit messages to a nominal maximum length
    maxMessageChars = fitByMessageTruncation(commits, maxChars, { minMessageChars: MAX_COMMIT_CHARS });
    logProgress('Truncated messages 1');

    // Omit the oldest commit messages down to a minimum size
    maxCommits = fitByOmission(commits, maxChars, { minCommits: MIN_COMMITS, maxMessageChars });
    logProgress('Omitted commits');

    // Truncate commit messages (without a minimum length) if still too long
    maxMessageChars = fitByMessageTruncation(commits, maxChars, { maxCommits });
    logProgress('Truncated messages 2');

    // Return the truncated commit history
    const commits_since_release = makeTruncatedCommits(commits, maxCommits, maxMessageChars);
    return { commits_since_release, ...rest };
}

// Attempt to fit commits within budget by omitting oldest commits
function fitByOmission(
    commits:    GitVersionCommit[],
    maxChars:   number,
    options:    { minCommits?: number, maxMessageChars?: number } = {}
): number {
    let minCommits = options.minCommits ?? 0;
    let maxCommits = commits.length;

    // Binary search to find the highest limit within available size
    while (minCommits < maxCommits) {
        const testCommits = Math.ceil((minCommits + maxCommits) / 2);
        const testChars = truncatedCommitsChars(commits, testCommits, options.maxMessageChars);
        if (testChars <= maxChars)  minCommits = testCommits;
        else                        maxCommits = testCommits - 1;
    }
    return maxCommits;
}

// Attempt to fit commits within budget by truncating messages
function fitByMessageTruncation(
    commits:    GitVersionCommit[],
    maxChars:   number,
    options:    { maxCommits?: number, minMessageChars?: number } = {}
): number {
    let minMessageChars = options.minMessageChars ?? 1;
    let maxMessageChars = Math.max(...commits.map((c) => c.message.length), 0);

    // Binary search to find the highest limit within available size
    while (minMessageChars < maxMessageChars) {
        const testMessageChars = Math.ceil((minMessageChars + maxMessageChars) / 2);
        const testChars = truncatedCommitsChars(commits, options.maxCommits, testMessageChars);
        if (testChars <= maxChars)  minMessageChars = testMessageChars;
        else                        maxMessageChars = testMessageChars - 1;
    }
    return maxMessageChars;
}

// Size of the truncated commit history in characters
function truncatedCommitsChars(...params: Parameters<typeof makeTruncatedCommits>): number {
    const truncated = makeTruncatedCommits(...params);
    return JSON.stringify(truncated).length;
}

// Create a truncated version of the commit history
function makeTruncatedCommits(commits: GitVersionCommit[], maxCommits = Infinity, maxMessageChars?: number): ResultGitVersionCommit[] {
    const truncated: ResultGitVersionCommit[] = commits
        .slice(0, maxCommits)
        .map(({ message, ...rest }) => ({
            message: truncateCommitMessage(message, maxMessageChars),
            ...rest
        }));
    if (truncated.length < commits.length) {
        const omitted_commits = commits.length - truncated.length;
        truncated.push({ omitted_commits });
    }
    return truncated;
}

// Truncate a single commit message
function truncateCommitMessage(message: string, maxChars = Infinity): string {
    return message.length <= maxChars ? message
        : message.slice(0, maxChars - 1) + '…';
}