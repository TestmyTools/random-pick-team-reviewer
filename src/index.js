const core = require('@actions/core');
const github = require('@actions/github');
const util = require('util');

function formatOctokitError(err) {
  const status =
    typeof err?.status === 'number' ? err.status : err?.response?.status;
  const documentationUrl =
    err?.response?.data?.documentation_url || err?.documentation_url;
  const responseData = err?.response?.data;

  const summary = {
    message: err instanceof Error ? err.message : String(err),
    status,
    documentationUrl,
    // Keep this small-ish; it's meant for debugging logs, not for output.
    response: responseData ? responseData : undefined,
  };

  return util.inspect(summary, { depth: 5, breakLength: 140, compact: true });
}

async function run() {
  const token = core.getInput('github-token', { required: true });
  const org = core.getInput('org', { required: true });
  const teamSlug = core.getInput('team-slug', { required: true });

  const context = github.context;
  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.setFailed(
      'This action must run in a workflow triggered by a pull_request (or pull_request_target) event so a pull request is in context.'
    );
    return;
  }

  let owner;
  let repo;
  // Prefer event payload repository when available (act can set GITHUB_REPOSITORY to something else).
  const payloadRepo = context.payload?.repository;
  if (payloadRepo?.owner?.login && payloadRepo?.name) {
    owner = payloadRepo.owner.login;
    repo = payloadRepo.name;
  } else {
    try {
      owner = context.repo.owner;
      repo = context.repo.repo;
    } catch (e) {
      core.setFailed(
        `Failed to determine repo owner/name from GitHub context. ${formatOctokitError(
          e
        )}`
      );
      return;
    }
  }

  const pullNumber = pullRequest.number;
  if (typeof pullNumber !== 'number') {
    core.setFailed(
      `Invalid pull_request.number in event payload: ${util.inspect(
        pullNumber
      )}. Check your event payload (e.g. act/pull_request.json).`
    );
    return;
  }


  
  let authorLogin = pullRequest?.user?.login;
  if (!authorLogin) {
    core.warning(
      'pull_request.user.login is missing from the event payload; the action will not be able to exclude the PR author from eligible reviewers.'
    );
  }

  core.info(
    `Inputs: org=${org}, team-slug=${teamSlug}. Target PR: ${owner}/${repo}#${pullNumber}.`
  );

  const octokit = github.getOctokit(token);

  // Preflight: make sure the PR exists and we can read it with this token.
  try {
    const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
    if (pr?.data?.user?.login) {
      authorLogin = pr.data.user.login;
    }
    core.info(`PR preflight OK. PR author: ${authorLogin || '(unknown)'}.`);
  } catch (err) {
    core.setFailed(
      [
        'Failed to fetch the pull request (pulls.get).',
        'This usually means the event payload PR number is wrong for the target repo, or the token can’t access that PR.',
        `Tried to fetch ${owner}/${repo}#${pullNumber}.`,
        `Details: ${formatOctokitError(err)}`,
      ].join('\n')
    );
    return;
  }

  let members;
  try {
    members = await octokit.paginate(
      octokit.rest.teams.listMembersInOrg,
      {
        org,
        team_slug: teamSlug,
      }
    );
  } catch (err) {
    core.setFailed(
      [
        'Failed to list team members (teams.listMembersInOrg).',
        'Check: ACT_ORG/ACT_TEAM_SLUG (or workflow inputs) and that the token has access to the org/team members.',
        `Details: ${formatOctokitError(err)}`,
      ].join('\n')
    );
    return;
  }

  const logins = members
    .map((m) => m.login)
    .filter((login) => (authorLogin ? login !== authorLogin : true));

  if (logins.length === 0) {
    core.setFailed(
      'No eligible team members: team is empty, or the only member is the PR author.'
    );
    return;
  }

  const reviewer = logins[Math.floor(Math.random() * logins.length)];

  try {
    await octokit.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pullNumber,
      reviewers: [reviewer],
    });
  } catch (err) {
    core.setFailed(
      [
        'Failed to request reviewers (pulls.requestReviewers).',
        'Check: the PR exists and is accessible to the token; verify owner/repo/pull_request.number from the event payload.',
        `Tried to request reviewer @${reviewer} for ${owner}/${repo}#${pullNumber}.`,
        `Details: ${formatOctokitError(err)}`,
      ].join('\n')
    );
    return;
  }

  core.setOutput('reviewer', reviewer);
  core.info(`Requested review from @${reviewer}`);
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
