#!/usr/bin/env node
/**
 * Stable CLI wrapper for documentation validation.
 *
 * The implementation lives under scripts/validate-docs/ so rule families can
 * be split without changing the public command contract.
 */

import './validate-docs/runner.mjs';
