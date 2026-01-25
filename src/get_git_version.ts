// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import child_process from 'child_process';

// Details of the checked out repo relative to the latest release
export interface GitVersionCommit {
    commit_at:              string;
    message:                string;
}
export interface GitVersion {
    base_version:           string;
    commits_since_release:  GitVersionCommit[];
}

// Timeout for Git commands
const GIT_TIMEOUT = 10_000; // (10 seconds)

// Glob-style pattern for Git release tags
const RELEASE_TAG_GLOB = 'v[0-9]*.[0-9]*.[0-9]*';

// Retrieve details of the latest release and post-release commits
export function getGitVersion(checkout_path: string): GitVersion | undefined {
    // Try to retrieve the tag for the latest release
    const releaseTag = getReleaseTag(checkout_path);
    if (!releaseTag) {
        core.warning('No release tag found');
        return;
    }

    // Try to retrieve the commit log since the latest release
    const commits = getReleaseLog(checkout_path, releaseTag);
    if (commits === undefined) {
        core.warning('Failed to retrieve commits since release tag');
    }
    return {
        base_version:           releaseTag,
        commits_since_release:  commits ?? []
    };
}

// Retrieve the tag for the latest release
function getReleaseTag(cwd: string): string | undefined {
    // Find the most recent release tag
    const tag = git(cwd, 'describe', '--tags', '--abbrev=0', '--match', RELEASE_TAG_GLOB);
    if (!tag?.length) return;
    core.info(`Latest release tag: ${tag}`);
    return tag;
}

// Retrieve the commit log since the specified tag
function getReleaseLog(cwd: string, baseTag: string): GitVersionCommit[] | undefined {
    // Retrieve the log of commits since the base tag, including:
    //   %aI = author date, strict ISO 8601 format
    //   %s  = subject (commit message)
    const log = git(cwd, 'log', `${baseTag}..HEAD`, "--pretty=format:'%aI %s'");
    if (!log) return;

    // Parse the commit log
    const lines = log.split('\n');
    return lines.flatMap(line => {
        const [commit_at, message] = line.split(' ', 2);
        if (!commit_at || !message) {
            core.warning(line, { title: 'Unexpected git log format' });
            return [];
        }
        return [{ commit_at, message }];
    });
}

// Run a Git command in a specific working directory and capture its output
function git(cwd: string, ...args: string[]): string | undefined {
    try {
        core.debug(`execFileSync: git ${args.join(' ')}`);
        const output = child_process.execFileSync('git', args, { cwd, timeout: GIT_TIMEOUT, encoding: 'utf-8' });
        core.debug(`execFileSync stdout:\n${output}`);
        return output.trim();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        core.error(message, { title: 'Git command failed' });
    }
}