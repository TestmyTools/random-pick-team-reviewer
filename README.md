# Random Team Reviewer GitHub Action

This action randomly selects a reviewer from a GitHub team and requests a review on a pull request.

## How it works

1. Reads team members from the org team you provide.
2. Filters out the pull request author.
3. Picks one remaining member at random.
4. Calls GitHub to request a review from that user.

## Inputs

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `github-token` | `string` | Yes | Token used to call the GitHub API (list team members and request reviewers). |
| `org` | `string` | Yes | GitHub organization login (the `org` in `https://github.com/orgs/<org>/...`). |
| `team-slug` | `string` | Yes | Team slug (the `<team-slug>` in `https://github.com/orgs/<org>/teams/<team-slug>`). |

## Outputs

| Name | Description |
| ---- | ----------- |
| `reviewer` | The selected reviewer login. |

## Example workflow

```yaml
name: Request random team review

on:
  pull_request:

permissions:
  contents: read

jobs:
  request-review:
    runs-on: ubuntu-latest
    steps:
      - name: Request random reviewer
        uses: TestmyTools/random-pick-team-reviewer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          org: TestmyTools
          team-slug: engs
```

## Token permissions

This action uses these GitHub REST endpoints:

1. `GET /orgs/{org}/teams/{team_slug}/members` (to list team members)
2. `POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers` (to request the review)

Exact required permissions depend on whether you provide `secrets.GITHUB_TOKEN` or a Personal Access Token (PAT).

- If you use `secrets.GITHUB_TOKEN` and your org/team is restricted, you may need to pass a PAT instead.
- If you use a classic PAT, you will typically need `read:org` (team/org access) and `repo` (requesting PR reviewers).
- If you use a fine-grained PAT, grant the org "Members" permission read access for the org used by `org`.

## Local testing with `act` (optional)

This repo includes an `act` workflow at `.github/workflows/act-test.yml` and example files under `act/`.

You will need:

- Docker running
- `act` installed (`brew install act`)
- `act/.secrets` filled in (token + org + team slug)

Then run:

```bash
npm run act
```

