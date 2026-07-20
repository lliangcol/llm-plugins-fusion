import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateTagIdentityErrors,
  nodeRuntimeContractErrors,
  npmCacheContractErrors,
  prGovernanceTrustBoundaryErrors,
  promotionHandoffModuleErrors,
  promotionPublicationStateErrors,
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

const governanceModel = () => ({
  jobs: {
    governance: {
      steps: [
        {
          uses: 'actions/checkout@0123456789012345678901234567890123456789',
          with: {
            ref: '${{ github.event.pull_request.base.sha }}',
            path: 'trusted-governance',
            'persist-credentials': false,
          },
        },
        uncachedSetup,
        {
          run: 'node scripts/validate-pr-governance.mjs',
          'working-directory': 'trusted-governance',
          env: { GITHUB_TOKEN: '${{ github.token }}' },
        },
      ],
    },
  },
});

test('PR governance executes only the base-SHA validator from its independent checkout', () => {
  const trusted = governanceModel();
  assert.deepEqual(prGovernanceTrustBoundaryErrors('pr-governance.yml', trusted), []);

  const headCheckout = structuredClone(trusted);
  headCheckout.jobs.governance.steps[0].with.ref = '${{ github.sha }}';
  assert.match(prGovernanceTrustBoundaryErrors('pr-governance.yml', headCheckout).join('\n'), /base SHA/u);

  const rootValidator = structuredClone(trusted);
  delete rootValidator.jobs.governance.steps[2]['working-directory'];
  assert.match(prGovernanceTrustBoundaryErrors('pr-governance.yml', rootValidator).join('\n'), /trusted-governance base checkout/u);

  const pullRequestNoOpCanReplaceValidator = structuredClone(trusted);
  pullRequestNoOpCanReplaceValidator.jobs.governance.steps.splice(1, 0, {
    uses: 'actions/checkout@0123456789012345678901234567890123456789',
    with: { 'persist-credentials': false },
  });
  pullRequestNoOpCanReplaceValidator.jobs.governance.steps[3]['working-directory'] = '.';
  const findings = prGovernanceTrustBoundaryErrors('pr-governance.yml', pullRequestNoOpCanReplaceValidator).join('\n');
  assert.match(findings, /exactly one checkout/u);
  assert.match(findings, /trusted-governance base checkout/u);

  const baseValidatorRewrittenByPullRequest = structuredClone(trusted);
  baseValidatorRewrittenByPullRequest.jobs.governance.steps.splice(2, 0, {
    run: "printf 'process.exit(0)' > trusted-governance/scripts/validate-pr-governance.mjs",
  });
  assert.match(
    prGovernanceTrustBoundaryErrors('pr-governance.yml', baseValidatorRewrittenByPullRequest).join('\n'),
    /no pull-request-controlled mutation step/u,
  );

  const skippedValidator = structuredClone(trusted);
  skippedValidator.jobs.governance.steps[2].if = '${{ false }}';
  assert.match(prGovernanceTrustBoundaryErrors('pr-governance.yml', skippedValidator).join('\n'), /must not be conditional/u);
});

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

  const reusableOptions = { ...options, expectedBootstrapRef: '${{ job.workflow_sha }}' };
  const reusable = structuredClone(candidate);
  reusable.jobs.preflight.steps[0].with.ref = '${{ job.workflow_sha }}';
  assert.deepEqual(releaseRefTrustBoundaryErrors('promotion.yml', reusable, reusableOptions), []);
  reusable.jobs.preflight.steps[0].with.ref = '${{ github.workflow_sha }}';
  assert.match(
    releaseRefTrustBoundaryErrors('promotion.yml', reusable, reusableOptions).join('\n'),
    /bootstrap checkout must use trusted workflow ref/u,
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

test('candidate roots reject non-canonical candidate tags before any fetch', () => {
  const trust = {
    run: `set -euo pipefail
if [[ ! "\${CANDIDATE_TAG}" =~ ^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)-rc\\.(0|[1-9][0-9]*)$ ]]; then
  echo "::error::invalid candidate release tag: \${CANDIDATE_TAG}" >&2
  exit 1
fi
git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
git verify-tag "\${CANDIDATE_TAG}"`,
  };
  const candidate = { jobs: { preflight: { steps: [trust] } } };
  assert.deepEqual(candidateTagIdentityErrors('candidate.yml', candidate, 'preflight'), []);

  const loose = structuredClone(candidate);
  loose.jobs.preflight.steps[0].run = loose.jobs.preflight.steps[0].run
    .replace('^v(0|[1-9][0-9]*)\\.', '^v[0-9]+\\.');
  assert.match(candidateTagIdentityErrors('candidate.yml', loose, 'preflight').join('\n'), /strict candidate-tag validation/u);

  const noExit = structuredClone(candidate);
  noExit.jobs.preflight.steps[0].run = noExit.jobs.preflight.steps[0].run.replace('  exit 1\n', '');
  assert.match(candidateTagIdentityErrors('candidate.yml', noExit, 'preflight').join('\n'), /must exit nonzero/u);

  const fetchFirst = structuredClone(candidate);
  fetchFirst.jobs.preflight.steps[0].run = `git fetch origin main\n${fetchFirst.jobs.preflight.steps[0].run}`;
  assert.match(candidateTagIdentityErrors('candidate.yml', fetchFirst, 'preflight').join('\n'), /before any fetch/u);
});

test('recovery roots reject malformed or mismatched stable and candidate tags before any fetch', () => {
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
git verify-tag "\${CANDIDATE_TAG}"`,
  };
  const recovery = { jobs: { recover: { steps: [trust] } } };
  assert.deepEqual(promotionTagIdentityErrors('recovery.yml', recovery, 'recover'), []);

  const looseStable = structuredClone(recovery);
  looseStable.jobs.recover.steps[0].run = looseStable.jobs.recover.steps[0].run
    .replace('^v(0|[1-9][0-9]*)\\.', '^v[0-9]+\\.');
  assert.match(promotionTagIdentityErrors('recovery.yml', looseStable, 'recover').join('\n'), /strict stable-tag validation/u);

  const noBaseGuard = structuredClone(recovery);
  noBaseGuard.jobs.recover.steps[0].run = noBaseGuard.jobs.recover.steps[0].run
    .replace('if [[ "${CANDIDATE_TAG%%-rc.*}" != "${STABLE_TAG}" ]]; then', 'if false; then');
  assert.match(promotionTagIdentityErrors('recovery.yml', noBaseGuard, 'recover').join('\n'), /candidate-base equality/u);
});

test('immutable promotion handoff contains the complete transitive module closure', () => {
  const sources = new Map([
    ['scripts/publish.mjs', "import { run } from './lib/runner.mjs';\nrun();\n"],
    ['scripts/lib/runner.mjs', "export { digest } from './digest.mjs';\nexport function run() {}\n"],
    ['scripts/lib/digest.mjs', 'export const digest = true;\n'],
  ]);
  const workflow = (copied) => ({
    jobs: {
      verify: { steps: [{ run: [
        'handoff=.metrics/handoff',
        `cp ${copied.filter((path) => !path.startsWith('scripts/lib/')).join(' ')} "\${handoff}/scripts/"`,
        `cp ${copied.filter((path) => path.startsWith('scripts/lib/')).join(' ')} "\${handoff}/scripts/lib/"`,
      ].join('\n') }] },
      publish: { steps: [{ run: 'node handoff/scripts/publish.mjs' }] },
    },
  });
  const readModule = (path) => {
    if (!sources.has(path)) throw new Error(`missing fixture ${path}`);
    return sources.get(path);
  };
  assert.deepEqual(promotionHandoffModuleErrors('promote.yml', workflow([...sources.keys()]), { readModule }), []);
  const handoffRelative = workflow([...sources.keys()]);
  handoffRelative.jobs.publish.steps[0].run = 'cd handoff\nnode scripts/publish.mjs';
  assert.deepEqual(promotionHandoffModuleErrors('promote.yml', handoffRelative, { readModule }), []);
  const wrongWorkingDirectory = workflow([...sources.keys()]);
  wrongWorkingDirectory.jobs.publish.steps[0].run = 'node scripts/publish.mjs';
  assert.deepEqual(
    promotionHandoffModuleErrors('promote.yml', wrongWorkingDirectory, { readModule }),
    ['promote.yml: publish job must execute at least one copied handoff module'],
  );
  const missing = promotionHandoffModuleErrors('promote.yml', workflow(['scripts/publish.mjs', 'scripts/lib/runner.mjs']), { readModule });
  assert.match(missing.join('\n'), /omits scripts\/lib\/digest\.mjs, imported by scripts\/lib\/runner\.mjs/u);
  assert.deepEqual(
    promotionHandoffModuleErrors('promote.yml', { jobs: { verify: { steps: [] }, publish: { steps: [] } } }, { readModule }),
    ['promote.yml: publish job must execute at least one copied handoff module'],
  );
});

test('promotion records external release states only after exact reconciliation', () => {
  const trusted = {
    jobs: {
      verify: { steps: [{ run: 'node scripts/release-orchestrator.mjs --candidate-verification-passed --mode promote --state DRAFT --target-state STABLE_TAG_VERIFIED' }] },
      publish: { steps: [{ run: [
        'node scripts/release-orchestrator.mjs --dry-run --candidate-verification-passed --protected-publication-approved --mode promote --state STABLE_TAG_VERIFIED --target-state RELEASE_PUBLISHED',
        'node scripts/reconcile-github-release.mjs --tag "${STABLE_TAG}" --assets-dir publish --notes release-notes.md',
        'node scripts/release-orchestrator.mjs --candidate-verification-passed --protected-publication-approved --mode promote --state STABLE_TAG_VERIFIED --target-state RELEASE_PUBLISHED',
      ].join('\n') }] },
    },
  };
  assert.deepEqual(promotionPublicationStateErrors('promote.yml', trusted), []);

  const premature = structuredClone(trusted);
  premature.jobs.verify.steps[0].run = premature.jobs.verify.steps[0].run.replace('STABLE_TAG_VERIFIED', 'ASSETS_RECONCILED');
  assert.match(promotionPublicationStateErrors('promote.yml', premature).join('\n'), /actually verified stable tag/u);

  const reordered = structuredClone(trusted);
  const commands = reordered.jobs.publish.steps[0].run.split('\n');
  reordered.jobs.publish.steps[0].run = [commands[0], commands[2], commands[1]].join('\n');
  assert.match(promotionPublicationStateErrors('promote.yml', reordered).join('\n'), /preflight, reconcile GitHub Release, then record/u);
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
    releaseBundleAttestationOrderErrors(
      'promote.yml',
      workflow(['set -euo pipefail', 'mkdir -p .metrics/promotion/download .metrics/promotion/bundle', generic, extract, core, exact]),
      'verify',
    ).join('\n'),
    /must not pre-create the atomic release bundle extraction target/u,
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
