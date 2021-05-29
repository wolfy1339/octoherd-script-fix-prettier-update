import {
  composeCreateOrUpdateTextFile
} from '@octokit/plugin-create-or-update-text-file';
import prettier from 'prettier';

/**
 * Updates `.github/workflows/update-prettier.yml` with branch name for renovate.
 * Ignores forks and archived repositories
 *
 * @param {import("@octoherd/cli").Octokit} octokit
 * @param {import("@octoherd/cli").Repository} repository
 * @return {Promise<void>}
 */
export async function script(octokit, repository) {
  if (repository.archived) {
    octokit.log.info(`${repository.html_url} is archived, ignoring.`);

    return;
  }

  // Global variables used throughout the code
  const owner = repository.owner.login;
  const repo = repository.name;
  const defaultBranch = repository.default_branch;
  const branchName = 'fix-update-prettier-workflow';
  const path = '.github/workflows/update-prettier.yml';

  // Get info on repository branches
  const { data: branches } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
    owner,
    repo,
    branch: defaultBranch
  });

  // Get SHA of repository's default branch
  const sha = branches.filter(branch => branch.name === defaultBranch).map(branch => branch.commit.sha)[0];
  const branchExists = branches.some(branch => branch.name === branchName);

  // Create branch if not present
  if (!branchExists) {
    const ref = await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner,
      repo,
      ref: 'refs/heads/fix-update-prettier-workflow',
      sha
    }).then(response => response.data.ref);

    if (!ref) {
      octokit.log.warn(`Error creating branch in ${repository.html_url}`);

      return;
    }
  }

  const { data: { commit }, updated } = await composeCreateOrUpdateTextFile(octokit, {
    owner,
    repo,
    path,
    branch: branchName,
    message: `ci: fix branch name for "Update Prettier" workflow

The workflow broke when we switched from Dependabot to Renovate`,
    content: ({ exists, content }) => {
      if (!exists) return null;

      return prettier.format(content.replace('dependabot/npm_and_yarn', 'renovate'), { parser: 'yaml' });
    }
  });

  if (updated) {
    octokit.log.info(
        `${path} updated in ${repository.html_url} via ${commit.html_url}`
    );

    //
    // Pull Request
    //

    // Create pull request
    const { data: pr } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      head: branchName,
      base: defaultBranch,
      title: 'ci: fix branch name for "Update Prettier" workflow'
    });

    octokit.log.info(`Create Pull Request at ${pr.html_url}`);

    // Add the "maintenance" label to the pull request
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
      owner,
      repo,
      issue_number: pr.number,
      labels: ['maintenance']
    });
  }
}
