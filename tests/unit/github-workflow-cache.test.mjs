import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nodeRuntimeContractErrors,
  npmCacheContractErrors,
  promotionTagIdentityErrors,
  protectedMainDispatchErrors,
  releaseBundleAttestationOrderErrors,
  releaseCallerFailClosedErrors,
  releaseRefTrustBoundaryErrors,
} from '../../scripts/validate-github-workflows.mjs';

const checkout = {
  uses: 'actions/checkout@0123456789012345678901234567890123456789',
  with: { ref: '${{ github.workflow_sha }}' },
};
const cachedSetup = {
  uses: 'actions/setup-node@0123456789012345678901234567890123456789',
  with: { 'node-version': '22', cache: 'npm' },
};
const uncachedSetup = {
  uses: 'actions/setup-node@0123456789012345678901234567890123456789',
  with: { 'node-version': '22' },
};
const install = { run: 'npm ci --ignore-scripts' };

const model = (steps) => ({ jobs: { verify: { steps } } });

test('setup-node package-manager cache requires a preceding checkout', () => {
  const missingCheckout = npmCacheContractErrors('candidate.yml', model([cachedSetup, { run: 'npm pack example' }]));
  assert.deepEqual(missingCheckout, [
    'candidate.yml: job "verify" must checkout a lockfile before enabling setup-node npm cache',
  ]);

  assert.deepEqual(npmCacheContractErrors('candidate.yml', model([checkout, cachedSetup, install])), []);
  assert.match(
    npmCacheContractErrors('candidate.yml', model([cachedSetup, checkout, install]))[0],
    /checkout a lockfile before enabling setup-node npm cache/u,
  );
});

test('npm ci requires cached setup-node while package-only jobs may remain uncached', () => {
  assert.match(
    npmCacheContractErrors('ci.yml', model([checkout, uncachedSetup, install]))[0],
    /setup-node step before npm ci must enable the npm cache/u,
  );
  assert.deepEqual(
    npmCacheContractErrors('candidate.yml', model([uncachedSetup, { run: 'npm pack example' }])),
    [],
  );
});

test('release node and npm commands require an explicit preceding Node 22 setup', () => {
  assert.deepEqual(
    nodeRuntimeContractErrors('release.yml', model([{ run: 'node scripts/verify.mjs' }])),
    ['release.yml: job "verify" must setup Node 22 before executing node or npm'],
  );
  assert.deepEqual(
    nodeRuntimeContractErrors('release.yml', model([
      { ...uncachedSetup, with: { 'node-version': '20' } },
      { run: 'source_commit="$(node -e \'process.stdout.write("ok")\')"' },
    ])),
    ['release.yml: job "verify" must setup exact Node 22 before executing node or npm'],
  );
  assert.deepEqual(
    nodeRuntimeContractErrors('release.yml', model([{ run: 'npm pack example' }, uncachedSetup])),
    ['release.yml: job "verify" must setup Node 22 before executing node or npm'],
  );
  assert.deepEqual(
    nodeRuntimeContractErrors('release.yml', model([uncachedSetup, { run: 'npm pack example' }])),
    [],
  );
  assert.deepEqual(
    nodeRuntimeContractErrors('release.yml', model([{ run: 'sha256sum -c handoff.sha256' }])),
    [],
  );
});

test('release refs are verified from protected-main signers before repository code', () => {
  const trust = {
    run: `set -euo pipefail
git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
git show origin/main:.github/release-signers > "\${RUNNER_TEMP}/candidate-trust/release-signers"
git config gpg.ssh.allowedSignersFile "\${RUNNER_TEMP}/candidate-trust/release-signers"
git verify-tag "\${CANDIDATE_TAG}"
git merge-base --is-ancestor "\${SOURCE_COMMIT}" origin/main
git checkout --detach "\${SOURCE_COMMIT}"`,
  };
  const options = {
    jobId: 'preflight',
    expectedVerifyTags: 1,
    trustDirectory: 'candidate-trust',
    expectedBootstrapRef: '${{ github.workflow_sha }}',
  };
  const candidate = { jobs: { preflight: { steps: [checkout, trust, uncachedSetup, { run: 'node scripts/verify.mjs' }] } } };
  assert.deepEqual(releaseRefTrustBoundaryErrors('candidate.yml', candidate, options), []);

  const codeBeforeTrust = { jobs: { preflight: { steps: [checkout, uncachedSetup, { run: 'node scripts/untrusted.mjs' }, trust] } } };
  assert.match(releaseRefTrustBoundaryErrors('candidate.yml', codeBeforeTrust, options).join('\n'), /first run step/u);

  const shellBeforeTrust = { jobs: { preflight: { steps: [checkout, { run: 'bash scripts/untrusted.sh' }, trust, uncachedSetup] } } };
  assert.match(releaseRefTrustBoundaryErrors('candidate.yml', shellBeforeTrust, options).join('\n'), /first run step/u);

  const localActionBeforeTrust = { jobs: { preflight: { steps: [checkout, { uses: './.github/actions/untrusted' }, trust, uncachedSetup] } } };
  assert.match(
    releaseRefTrustBoundaryErrors('candidate.yml', localActionBeforeTrust, options).join('\n'),
    /must not execute a repository-local action before signed-ref verification/u,
  );

  const tagOwnedSigner = structuredClone(candidate);
  tagOwnedSigner.jobs.preflight.steps[1].run = tagOwnedSigner.jobs.preflight.steps[1].run
    .replace('origin/main:.github/release-signers > "${RUNNER_TEMP}/candidate-trust/release-signers"', '.github/release-signers')
    .replace('git merge-base --is-ancestor "${SOURCE_COMMIT}" origin/main', 'true');
  const findings = releaseRefTrustBoundaryErrors('candidate.yml', tagOwnedSigner, options).join('\n');
  assert.match(findings, /origin\/main:\.github\/release-signers/u);
  assert.match(findings, /git merge-base --is-ancestor/u);

  const tagBootstrap = structuredClone(candidate);
  tagBootstrap.jobs.preflight.steps[0].with.ref = '${{ github.event.client_payload.candidate_tag }}';
  assert.match(
    releaseRefTrustBoundaryErrors('candidate.yml', tagBootstrap, options).join('\n'),
    /bootstrap checkout must use trusted workflow ref/u,
  );

  const checkoutBeforeTrust = structuredClone(candidate);
  checkoutBeforeTrust.jobs.preflight.steps[1].run = checkoutBeforeTrust.jobs.preflight.steps[1].run
    .replace('git checkout --detach "${SOURCE_COMMIT}"', '')
    .replace('git verify-tag "${CANDIDATE_TAG}"', 'git checkout --detach "${SOURCE_COMMIT}"\ngit verify-tag "${CANDIDATE_TAG}"');
  assert.match(
    releaseRefTrustBoundaryErrors('candidate.yml', checkoutBeforeTrust, options).join('\n'),
    /verify every signed tag before checking out release source/u,
  );
});

test('privileged release roots run only from exact protected-main repository dispatch events', () => {
  const trusted = { on: { repository_dispatch: { types: ['release-candidate'] } } };
  assert.deepEqual(protectedMainDispatchErrors('candidate.yml', trusted, 'release-candidate'), []);

  for (const candidate of [
    { on: { push: { tags: ['v*'] } } },
    { on: { workflow_dispatch: { inputs: {} } } },
    { on: { repository_dispatch: { types: ['wrong-event'] } } },
    { on: { repository_dispatch: { types: ['release-candidate'] }, workflow_dispatch: {} } },
  ]) {
    assert.notDeepEqual(
      protectedMainDispatchErrors('candidate.yml', candidate, 'release-candidate'),
      [],
    );
  }
});

test('stable release caller cannot turn malformed dispatch payloads into a skipped green job', () => {
  const caller = { uses: './.github/workflows/promote-release.yml' };
  assert.deepEqual(releaseCallerFailClosedErrors('release.yml', caller), []);
  assert.match(
    releaseCallerFailClosedErrors('release.yml', { ...caller, if: '${{ startsWith(inputs.tag, \'v\') }}' }).join('\n'),
    /must not skip malformed repository-dispatch payloads/u,
  );
});

test('promotion rejects strict tag-shape and base mismatches before any fetch', () => {
  const trust = {
    run: `set -euo pipefail
if [[ ! "\${STABLE_TAG}" =~ ^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$ ]]; then
  echo "::error::invalid stable release tag: \${STABLE_TAG}" >&2
  exit 1
fi
if [[ ! "\${CANDIDATE_TAG}" =~ ^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)-rc\\.(0|[1-9][0-9]*)$ ]]; then
  echo "::error::invalid candidate release tag: \${CANDIDATE_TAG}" >&2
  exit 1
fi
if [[ "\${CANDIDATE_TAG%%-rc.*}" != "\${STABLE_TAG}" ]]; then
  echo "::error::candidate tag base must equal stable tag" >&2
  exit 1
fi
git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
git verify-tag "\${STABLE_TAG}"
git verify-tag "\${CANDIDATE_TAG}"`,
  };
  const promotion = { jobs: { verify: { steps: [trust] } } };
  assert.deepEqual(promotionTagIdentityErrors('promote.yml', promotion), []);

  const looseStable = structuredClone(promotion);
  looseStable.jobs.verify.steps[0].run = looseStable.jobs.verify.steps[0].run
    .replace('^v(0|[1-9][0-9]*)\\.', '^v[0-9]+\\.');
  assert.match(promotionTagIdentityErrors('promote.yml', looseStable).join('\n'), /strict stable-tag validation/u);

  const noBaseGuard = structuredClone(promotion);
  noBaseGuard.jobs.verify.steps[0].run = noBaseGuard.jobs.verify.steps[0].run
    .replace('if [[ "${CANDIDATE_TAG%%-rc.*}" != "${STABLE_TAG}" ]]; then', 'if false; then');
  assert.match(promotionTagIdentityErrors('promote.yml', noBaseGuard).join('\n'), /candidate-base equality/u);

  const fetchFirst = structuredClone(promotion);
  fetchFirst.jobs.verify.steps[0].run = `git fetch origin main\n${fetchFirst.jobs.verify.steps[0].run}`;
  assert.match(promotionTagIdentityErrors('promote.yml', fetchFirst).join('\n'), /before any fetch/u);
});

test('release bundles require generic attestation before extraction and exact digest attestation after core read', () => {
  const generic = `gh attestation verify "\${bundle}" --repo "\${GITHUB_REPOSITORY}" \\
  --signer-workflow "\${GITHUB_REPOSITORY}/.github/workflows/release-candidate.yml" \\
  --source-ref refs/heads/main --deny-self-hosted-runners`;
  const extract = 'node scripts/extract-release-bundle.mjs --archive "${bundle}" --out bundle';
  const core = 'builder_workflow_commit="$(node -e \'read candidate-core.json\')"';
  const exact = `gh attestation verify "\${bundle}" --repo "\${GITHUB_REPOSITORY}" \\
  --signer-workflow "\${GITHUB_REPOSITORY}/.github/workflows/release-candidate.yml" \\
  --source-ref refs/heads/main --source-digest "\${builder_workflow_commit}" \\
  --signer-digest "\${builder_workflow_commit}" --deny-self-hosted-runners`;
  const workflow = (parts) => ({ jobs: { verify: { steps: [{ run: parts.join('\n') }] } } });
  assert.deepEqual(
    releaseBundleAttestationOrderErrors('promote.yml', workflow(['set -euo pipefail', generic, extract, core, exact]), 'verify'),
    [],
  );
  assert.match(
    releaseBundleAttestationOrderErrors('promote.yml', workflow(['set -euo pipefail', extract, generic, core, exact]), 'verify').join('\n'),
    /must order generic attestation/u,
  );
  assert.match(
    releaseBundleAttestationOrderErrors('promote.yml', workflow(['set -euo pipefail', generic, extract, core]), 'verify').join('\n'),
    /exactly twice/u,
  );
  assert.match(
    releaseBundleAttestationOrderErrors(
      'promote.yml',
      workflow(['set -euo pipefail', `${generic} --source-digest "\${builder_workflow_commit}"`, extract, core, exact]),
      'verify',
    ).join('\n'),
    /must not trust a bundle-owned digest/u,
  );
  assert.match(
    releaseBundleAttestationOrderErrors('promote.yml', workflow([generic, extract, core, exact]), 'verify').join('\n'),
    /must fail closed before extraction/u,
  );
  assert.match(
    releaseBundleAttestationOrderErrors(
      'promote.yml',
      workflow(['set -euo pipefail', `${generic} || true`, extract, core, exact]),
      'verify',
    ).join('\n'),
    /must fail closed before extraction/u,
  );
});
