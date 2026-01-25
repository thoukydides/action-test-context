// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { GitVersion, GitVersionCommit } from './get_git_version.js';
import { LogEntry } from './get_log.js';

// A git version that has been truncated to fit within a constraint
export interface GitVersionCommitOmitted {
    omitted_commits:        number;
}
export type ResultGitVersionCommit = GitVersionCommit | GitVersionCommitOmitted;
export interface ResultGitVersion extends Omit<GitVersion, 'commits_since_release'> {
    commits_since_release:  ResultGitVersionCommit[];
}

// Result context
export interface ResultContext {
    test_result:            'successful' | 'failed',
    version_tested?:        ResultGitVersion;
    log_highlights:         string[];
}

// Construct the result context
export function makeResultContext(isSuccess: boolean, logLines: LogEntry[], version_tested?: ResultGitVersion): ResultContext {
    return {
        test_result:    isSuccess ? 'successful' : 'failed',
        version_tested,
        log_highlights: logLines.map(({ line }) => line)
    };
}

// Size of the result context in characters
export function resultContextChars(...params: Parameters<typeof makeResultContext>): number {
    const context = makeResultContext(...params);
    return JSON.stringify(context).length;
}
