import { Octokit, Repository } from '@octoherd/cli';

/**
 * Updates `.github/workflows/update-prettier.yml` with branch name for renovate.
 * Ignores forks and archived repositories
 *
 * @param {Octokit} octokit
 * @param {Repository} repository
 * @return {Promise<void>}
 */
export async function script(octokit, repository) {
  if (repository.archived) {
    octokit.log.info(`${repository.html_url} is archived, ignoring.`);

    return;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const defaultBranch = repository.default_branch;
  const path = '.github/workflows/update-prettier.yml';

  const { data: { sha, content, encoding } } = await octokit
      .request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path
      });

  if (!sha) {
    octokit.log.info(`${path} does not exist in ${repository.html_url}`);

    return;
  }

  const contentString = Buffer.from(content, encoding).toString();

  const ref = await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    owner,
    repo,
    ref: 'refs/heads/fix-update-prettier-workflow',
    sha
  }).then(response => response.data.ref, error => null);

  if (!ref) {
    octokit.log.warn(`Error creating branch in ${repository.html_url}`);

    return;
  }

  const branchName = ref.split('/').slice(-1)[0];
  const {
    data: { commit }
  } = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner,
    repo,
    path,
    sha,
    branch: branchName,
    content: Buffer.from(contentString.replace('dependabot/npm_and_yarn', 'renovate')).toString('base64'),
    message: `ci: fix branch name for "Update Prettier" workflow

The workflow broke when we switched from Dependabot to Renovate`
  });

  octokit.log.info(
      `${path} updated in ${repository.html_url} via ${commit.html_url}`
  );

  const { data: pr } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    head: branchName,
    base: defaultBranch,
    title: 'ci: fix branch name for "Update Prettier" workflow'
  });

  octokit.log.info(`Create Pull Request at ${pr.html_url}`);

  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    owner,
    repo,
    issue_number: pr.number,
    labels: ['maintenance']
  });
}
