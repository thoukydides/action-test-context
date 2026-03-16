# `action-test-context`

This action post-processes the result (exit code and `stdout`/`stderr` log) of running a test and prepares it for use within an LLM's input context. It prioritises GitHub Actions workflow commands (`::error` and `::warning`) over raw log output. The local Git checkout is also used to identify any commits made since the last release.

> [!CAUTION]
> This action is provided for my own use and published in case it is useful to others. If you rely on it, fork and maintain your own copy. No support or stability guarantees are offered.

## Prerequisites

Before using this workflow, ensure:
- The Git checkout includes commit history and tags.

## Inputs

Various inputs are defined in the action to configure its operation:

| Name | Description | Default
| --- | --- | ---
| `exit_code` | The test's exit code; `0` for success | *required*
| `log_file` | Path to a file containing the test's stdout/stderr output | *required*
| `log_regexps` | Regular expressions (one per line) applied to the log to identify additional lines that should be included in the context | `''`
| `log_strip_regexps` | Regular expressions (one per line) applied to the log for content that should be removed | `''`
| `checkout_path` | Relative path under `$GITHUB_WORKSPACE` (**not** the working directory) to the Git checkout | `'.'`
| `max_tokens` | The maximum number of tokens to use (approximated by character count) | `5000`

The `log_regexps` patterns may be prefixed by a score (`0`...`100`) indicating their relative importance. Lines with lower scores are dropped if required to satisfy the `max_tokens` constraint. The action assigns the following scores itself:
- `0`: Lines not matching any pattern (always omitted if there are any lines with non-zero scores or the `exit_code` is `0`)
- `50`: Any `log_regexps` patterns that do not explicitly specify a score
- `80`: Warnings messages (`::warning` workflow command)
- `90`: Error messages (`::error` workflow command)

Each line of the log has ANSI colour codes, anything matching `log_strip_regexps`, and leading/trailing whitespace removed. Each of the `log_regexps` patterns is tested against both the original and cleaned version of each log line.

## Outputs

The action provides the following outputs:

| Name | Description
| --- | ---
| `value` | JSON object summarising the test run prepared for LLM input context
| `version` | A short description of the checkout that was tested (e.g. `v1.0.0` or `v1.0.0 + 5 commits`) suitable for inclusion in the data source name
| `version_md` | A Markdown formatted variant of `version` with links to the release and diff (where appropriate)
| `version_tag` | The most recent Git tag in the checkout's history, or empty if none found
| `version_unreleased` | Are there any unreleased commits since the most recent Git tag; `false` if no release was found

## Usage

Example workflow to generate an AI summary of a test run:

```yaml
name: Test Run
permissions:
  contents: read
  models: read

on:
  workflow_dispatch:
  schedule:
    # Runs at 09:00 UTC daily
    # Stagger different repos to avoid hitting GitHub API rate limits
    - cron: '0 9 * * *'

env:
  LOG_FILE

jobs:
  test-run:
    runs-on: ubuntu-latest

    env:
      LOG_FILE: ./test.log

    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
          fetch-tags: true

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'

      - name: Build and test
        id: run
        run: | # shell
          npm ci
          npm run build
          npm run test 2>&1 | tee "$LOG_FILE"
          echo "exit_code=${PIPESTATUS[0]}" >> "$GITHUB_OUTPUT"

      - name: Process the test result
        id: context
        uses: thoukydides/action-test-context@v1
        with:
          exit_code: ${{ steps.run.outputs.exit_code }}
          log_file: ${{ env.LOG_FILE }}
          log_regexps: |
            50 /(?<!\w)v?\d+\.\d+\.\d+/
            10 /\bcompatibility issues?\b/
    
      - name: Generate an AI summary
        uses: actions/ai-inference@v1
        with:
          prompt: |
            Generate a Markdown summary for the ${{ github.action_repository }} (${{ steps.context.outputs.version }}) test run.
            If there were errors highlight whether they were likely to be due to the code being tested or an external cause (such as a third-party API).

            ${{ steps.context.outputs.value }}
```

> [!TIP]
> The `actions/checkout`'s `fetch-depth: 0` and `fetch-tags: true` options are required to include full commit history and tags.

## ISC License (ISC)

<details>
<summary>Copyright © 2026 Alexander Thoukydides</summary>

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</details>