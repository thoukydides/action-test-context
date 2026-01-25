// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { getGitVersion, GitVersion } from './get_git_version.js';
import { plural } from './utils.js';
import { getLogLines, LogEntry } from './get_log.js';
import { makeResultContext, resultContextChars } from './result_context.js';
import { truncateCommits } from './truncate_commits.js';
import { excludeZeroScoreLog, truncateLog } from './truncate_log.js';

// GPT tokeniser: 1 token ≈ 4 prose characters or 3-3.5 for code/logs
const CHARS_PER_TOKEN = 3; // (assume worst case when truncating to fit)

// Proportion of context for commits if budget exceeded
const COMMITS_FRACTION = 0.25; // 25% commits + 75% log highlights

// Script entry point
function run(): void {
    // Action inputs
    const exit_code     = Number(core.getInput          ('exit_code',       { required: true }));
    const log_file      =        core.getInput          ('log_file',        { required: true });
    const log_regexps   =        core.getMultilineInput ('log_regexps',     { required: true });
    const checkout_path =        core.getInput          ('checkout_path',   { required: true });
    const max_tokens    = Number(core.getInput          ('max_tokens',      { required: true }));

    // Only care whether the exit code indicates success or failure
    const isSuccess = exit_code === 0;

    // Retrieve details of the latest release and post-release commits
    const gitVersion = getGitVersion(checkout_path);
    const versionSummary = getVersionSummary(gitVersion);
    core.info(`Checked out code: ${versionSummary}`);

    // Read and score the log file lines
    const logLines = getLogLines(log_file, log_regexps);

    // Exclude score 0 log lines if test successful or there are higher scores
    const filteredLogLines = excludeZeroScoreLog(logLines, isSuccess);

    // Truncate list of commits and log lines to fit within available context
    const max_chars = max_tokens * CHARS_PER_TOKEN;
    core.info(`Budget for test result context: ${plural(max_chars, 'character')} = ${plural(max_tokens, 'token')}`);

    // Truncate commit history to fit within budget
    const minCommitsChars = Math.round(max_chars * COMMITS_FRACTION);
    const nonCommitChars = resultContextChars(isSuccess, filteredLogLines);
    const maxCommitsChars = Math.max(minCommitsChars, max_chars - nonCommitChars);
    core.info(`Budget for commits context: ${plural(maxCommitsChars, 'character')}`
        + ` (${plural(nonCommitChars, 'non-commit character')})`);
    const truncatedGitVersion = gitVersion && truncateCommits(gitVersion, maxCommitsChars);

    // Truncate log lines to fit within budget
    const getLogLinesSize = (logLines: LogEntry[]) => resultContextChars(isSuccess, logLines, truncatedGitVersion);
    const truncatedLogLines = truncateLog(filteredLogLines, max_chars, getLogLinesSize);

    // Prepare the final context
    const value = makeResultContext(isSuccess, truncatedLogLines, truncatedGitVersion);

    // Action outputs
    core.setOutput('value',     value);
    core.setOutput('version',   versionSummary);
}

// Generate a concise description of the checked out code
function getVersionSummary(gitVersion?: GitVersion): string {
    if (!gitVersion) return 'unknown version';
    const { base_version, commits_since_release } = gitVersion;
    if (!base_version) return 'HEAD';
    const n = commits_since_release.length;
    return n === 0 ? base_version : `${base_version} + ${plural(n, 'commit')}`;
}

// Run the script and handle errors
try {
    run();
} catch (err) {
    core.setFailed(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    if (err instanceof Error && err.stack) core.debug(err.stack);
}