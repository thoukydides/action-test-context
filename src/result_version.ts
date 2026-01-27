// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { GitVersion } from './get_git_version.js';
import { plural } from './utils.js';

// Version related outputs
export interface ResultVersion {
    description:    string;     // Concise description of the checked out code
    markdown:       string;     // Markdown formatted description with link
    tag:            string;     // Most recent release tag
    unreleased:     boolean;    // Are there post-release commits
}

// Provide useful results based on the version information
export function getVersionResults(gitVersion?: GitVersion): ResultVersion {
    const [ description, markdown ] = getVersionDescription(gitVersion);
    const tag = gitVersion?.base_version ?? '';
    const unreleased = Boolean(gitVersion?.commits_since_release.length);
    return { description, markdown, tag, unreleased };
}

// Generate a concise description of the checked out code
function getVersionDescription(gitVersion?: GitVersion): [string, string] {
    if (!gitVersion) return ['unknown version', 'unknown version'];

    // Markdown formatting with links
    const { repo, base_version, commits_since_release } = gitVersion;
    const baseURL = `https://github.com/${repo.owner}/${repo.repo}`;
    const link = (text: string, path: string) => `[${text}](${baseURL}/${path})`;

    // No version information
    if (!base_version) return ['HEAD', link('HEAD', 'commits')];

    // Checkout matches release version with no additional commits
    const baseVersionLink = link(base_version, `releases/tag/${base_version}`);
    if (!commits_since_release.length) return [base_version, baseVersionLink];

    // Commits exist beyond the release tag
    const commitCount = plural(commits_since_release.length, 'commit');
    return [
        `${base_version} + ${commitCount}`,
        `${baseVersionLink} + ${link(commitCount, `compare/${gitVersion.base_version}...HEAD`)}`
    ];
}