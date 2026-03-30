const core = require('@actions/core');
const github = require('@actions/github');

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

  const octokit = github.getOctokit(token);
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const pullNumber = pullRequest.number;
  const authorLogin = pullRequest.user.login;

  const members = await octokit.paginate(octokit.rest.teams.listMembersInOrg, {
    org,
    team_slug: teamSlug,
  });

  const logins = members.map((m) => m.login).filter((login) => login !== authorLogin);

  if (logins.length === 0) {
    core.setFailed(
      'No eligible team members: team is empty, or the only member is the PR author.'
    );
    return;
  }

  const reviewer = logins[Math.floor(Math.random() * logins.length)];

  await octokit.rest.pulls.requestReviewers({
    owner,
    repo,
    pull_number: pullNumber,
    reviewers: [reviewer],
  });

  core.setOutput('reviewer', reviewer);
  core.info(`Requested review from @${reviewer}`);
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
