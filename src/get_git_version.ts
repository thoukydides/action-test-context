// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import child_process from 'child_process';

// Details of the checked out repo relative to the latest release
export interface GitVersionRepo {
    owner:                  string;
    repo:                   string;
}
export interface GitVersionCommit {
    commit_at:              string;
    message:                string;
}
export interface GitVersion {
    repo:                   GitVersionRepo;
    base_version:           string;
    commits_since_release:  GitVersionCommit[];
}

// Timeout for Git commands
const GIT_TIMEOUT = 10_000; // (10 seconds)

// Glob-style pattern for Git release tags
const RELEASE_TAG_GLOB = 'v[0-9]*.[0-9]*.[0-9]*';

// Retrieve details of the latest release and post-release commits
export function getGitVersion(checkout_path: string): GitVersion | undefined {
    const repo = getRepo(checkout_path);
    if (!repo) {
        core.warning('Unable to determine repository owner and name');
        return;
    }

    // Try to retrieve the tag for the latest release
    const base_version = getReleaseTag(checkout_path);
    if (!base_version) {
        core.warning('No release tag found');
        return;
    }

    // Try to retrieve the commit log since the latest release
    const commits = getReleaseLog(checkout_path, base_version);
    if (commits === undefined) {
        core.warning('Failed to retrieve commits since release tag');
    }
    return { repo, base_version, commits_since_release: commits ?? [] };
}

// Retrieve the repo owner and name
function getRepo(cwd: string): GitVersionRepo | undefined {
    // Find the remote origin
    const url = git(cwd, 'remote', 'get-url', 'origin');
    if (!url?.length) return;

    // Parse the origin URL to extract the owner and repo
    //   https://github.com/user/repo.git
    //   https://github.com/user/repo
    //   git@github.com:user/repo.git
    //   git@github.com:user/repo
    const [, owner, repo] = /[:/]([\w-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url) ?? [];
    if (!owner || !repo) {
        core.warning(url, { title: 'Unable to parse origin URL' });
        return;
    }
    return { owner, repo };
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
    if (log === undefined) return;

    // Parse the commit log
    const lines = log.split('\n');
    return lines.flatMap(line => {
        const spaceIndex = line.indexOf(' ');
        if (spaceIndex === -1) {
            core.warning(line, { title: 'Unexpected git log format' });
            return [];
        }
        const commit_at = line.substring(0, spaceIndex);
        const message = line.substring(spaceIndex + 1).trim();
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