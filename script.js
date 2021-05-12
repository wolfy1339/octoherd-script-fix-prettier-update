import prettier from 'prettier';
import yaml from 'yaml';

/**
 * Encodes given string into base64
 * @param {string} string The string to encode into base64
 * @returns {string} Encoded string in base64
 */
function base64Encode(string) {
  return Buffer.from(string).toString('base64');
}

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

  // Get the file contents
  const { data: { content, encoding } } = await octokit
      .request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path
      });

  if (!content) {
    octokit.log.info(`${path} does not exist in ${repository.html_url}`);

    return;
  }

  // Get info on repository branches
  const { data: branches } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
    owner,
    repo,
    branch: defaultBranch
  });

  // Get SHA of repository's default branch
  const sha = branches.filter(branch => branch.name === defaultBranch).map(branch => branch.commit.sha)[0];
  const branchExists = branches.some(branch => branch.name === branchName);

  const contentString = Buffer.from(content, encoding).toString();
  const YAMLFile = yaml.parse(contentString);

  // Check if file needs updating
  if (YAMLFile.on.push.branches[0] !== 'dependabot/npm_and_yarn/prettier-*') {
    octokit.log.info('Update prettier workflow already up-to-date in %s', repository.name);

    return;
  }

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

  // Create commit
  const {
    data: { commit }
  } = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner,
    repo,
    path,
    sha,
    branch: branchName,
    content: base64Encode(
        prettier.format(contentString.replace('dependabot/npm_and_yarn', 'renovate'), { parser: 'yaml' })
    ),
    message: `ci: fix branch name for "Update Prettier" workflow

The workflow broke when we switched from Dependabot to Renovate`
  });

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
