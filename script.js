/**
 * Create a CODE_OF_CONDUCT.md file unless it already exists.
 * Ignores forks and archived repositories
 *
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {import('@octoherd/cli').Repository} repository
 */
 export async function script(octokit, repository) {
  if (repository.archived) {
    octokit.log.info(`${repository.html_url} is archived, ignoring.`);
    return;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const path = ".github/workflows/update-prettier.yml";

  const sha = await octokit
    .request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path,
    })
    .then(
      (response) => response.data.sha,
      (error) => null
    );

  if (!sha) {
    octokit.log.info(`${path} does not exist in ${repository.html_url}`);
    return;
  }

  const { data: { content, encoding } } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path,
    ref: sha
  });
  
  const contentString = Buffer.from(content, encoding).toString();

  const {
    data: { commit },
  } = await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path,
    sha,
    content: Buffer.from(contentString.replace("dependabot/npm_and_yarn", "renovate")).toString("base64"),
    message: `ci: fix branch name for "Update Prettier" workflow

The workflow broke when we switched from Dependabot to Renovate`,
  });

  octokit.log.info(
    `${path} updated in ${repository.html_url} via ${commit.html_url}`
  );
}