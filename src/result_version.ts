// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { GitVersion } from './get_git_version.js';
import { plural } from './utils.js';

// Version related outputs
export interface ResultVersion {
    description:    string;     // Concise description of the checked out code
    tag:            string;     // Most recent release tag
    unreleased:     boolean;    // Are there post-release commits
    url:            string;     // Web page to the release or diff since release
}

// Provide useful results based on the version information
export function getVersionResults(gitVersion?: GitVersion): ResultVersion {
    return {
        description:    getVersionDescription(gitVersion),
        tag:            gitVersion?.base_version ?? '',
        unreleased:     Boolean(gitVersion?.commits_since_release.length),
        url:            getVersionURL(gitVersion)
    };
}

// Generate a concise description of the checked out code
function getVersionDescription(gitVersion?: GitVersion): string {
    if (!gitVersion) return 'unknown version';
    const { base_version, commits_since_release } = gitVersion;
    if (!base_version) return 'HEAD';
    const n = commits_since_release.length;
    return n === 0 ? base_version : `${base_version} + ${plural(n, 'commit')}`;
}

// Generate a URL to the release or diff since release
function getVersionURL(gitVersion?: GitVersion): string {
    const repo = gitVersion ? `${gitVersion.repo.owner}/${gitVersion.repo.repo}`
        : process.env.GITHUB_REPOSITORY;
    const baseUrl = `https://github.com/${repo}`;
    if (!gitVersion?.base_version) return baseUrl;
    return gitVersion.commits_since_release.length
        ? `${baseUrl}/compare/${gitVersion.base_version}...HEAD`
        : `${baseUrl}/releases/tag/${gitVersion.base_version}`;
}