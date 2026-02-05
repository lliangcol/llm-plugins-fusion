import { Manifest } from '../types';

export const manifest: Manifest = {
  version: '0.2.0',
  commands: [
    {
      id: 'senior-explore',
      displayName: '/senior-explore',
      stage: 'explore',
      constraintLevel: 'strong',
      description: 'Deep analysis only, no design or implementation.',
      fields: [
        { id: 'INTENT', label: 'Intent', type: 'multiline', required: true },
        { id: 'CONTEXT', label: 'Context', type: 'multiline' },
        { id: 'CONSTRAINTS', label: 'Constraints', type: 'multiline' },
        {
          id: 'DEPTH',
          label: 'Depth',
          type: 'select',
          options: [
            { value: 'quick', label: 'quick' },
            { value: 'normal', label: 'normal' },
            { value: 'deep', label: 'deep' },
          ],
          defaultValue: 'normal',
        },
        { id: 'EXPORT_PATH', label: 'Export path', type: 'path' },
      ],
      template: `/senior-explore
INTENT:
{{INTENT}}
CONTEXT:
{{CONTEXT}}
CONSTRAINTS:
{{CONSTRAINTS}}
DEPTH: {{DEPTH}}
EXPORT_PATH: {{EXPORT_PATH}}`,
      outputs: [{ id: 'analysis_export_path', sourceFieldId: 'EXPORT_PATH', type: 'path' }],
    },
    {
      id: 'explore',
      displayName: '/explore',
      stage: 'explore',
      constraintLevel: 'medium',
      description: 'Quick exploration with optional perspective.',
      fields: [
        {
          id: 'PERSPECTIVE',
          label: 'Perspective',
          type: 'select',
          options: [
            { value: 'observer', label: 'observer' },
            { value: 'reviewer', label: 'reviewer' },
          ],
          defaultValue: 'observer',
        },
        { id: 'INPUT', label: 'Input', type: 'multiline', required: true },
      ],
      template: `/explore
PERSPECTIVE: {{PERSPECTIVE}}
INPUT:
{{INPUT}}`,
    },
    {
      id: 'explore-lite',
      displayName: '/explore-lite',
      stage: 'explore',
      constraintLevel: 'weak',
      description: 'Quick understanding and alignment.',
      fields: [{ id: 'INPUT', label: 'Input', type: 'multiline', required: true }],
      template: `/explore-lite
{{INPUT}}`,
    },
    {
      id: 'explore-review',
      displayName: '/explore-review',
      stage: 'explore',
      constraintLevel: 'medium',
      description: 'Review mindset without proposing solutions.',
      fields: [{ id: 'INPUT', label: 'Input', type: 'multiline', required: true }],
      template: `/explore-review
{{INPUT}}`,
    },
    {
      id: 'plan-lite',
      displayName: '/plan-lite',
      stage: 'plan',
      constraintLevel: 'medium',
      description: 'Lightweight execution planning.',
      fields: [
        { id: 'GOAL', label: 'Goal', type: 'multiline', required: true },
        { id: 'NON_GOALS', label: 'Non-goals', type: 'multiline' },
        { id: 'APPROACH', label: 'Chosen approach', type: 'multiline' },
        { id: 'TRADEOFFS', label: 'Key trade-offs', type: 'multiline' },
        { id: 'EXECUTION', label: 'Execution outline', type: 'multiline' },
        { id: 'RISKS', label: 'Key risks', type: 'multiline' },
      ],
      template: `/plan-lite
GOAL:
{{GOAL}}
NON-GOALS:
{{NON_GOALS}}
CHOSEN APPROACH:
{{APPROACH}}
KEY TRADE-OFFS:
{{TRADEOFFS}}
EXECUTION OUTLINE:
{{EXECUTION}}
KEY RISKS:
{{RISKS}}`,
    },
    {
      id: 'produce-plan',
      displayName: '/produce-plan',
      stage: 'plan',
      constraintLevel: 'strong',
      description: 'Write a formal plan/design document.',
      fields: [
        { id: 'PLAN_OUTPUT_PATH', label: 'Plan output path', type: 'path', required: true },
        {
          id: 'PLAN_PROFILE',
          label: 'Plan profile',
          type: 'select',
          options: [
            { value: 'general', label: 'general' },
            { value: 'java-backend', label: 'java-backend' },
          ],
          defaultValue: 'general',
        },
        { id: 'PLAN_INTENT', label: 'Plan intent', type: 'multiline', required: true },
        { id: 'ANALYSIS_INPUTS', label: 'Analysis inputs', type: 'list' },
        { id: 'CONSTRAINTS', label: 'Constraints', type: 'multiline' },
      ],
      template: `/produce-plan
PLAN_OUTPUT_PATH: {{PLAN_OUTPUT_PATH}}
PLAN_PROFILE: {{PLAN_PROFILE}}
PLAN_INTENT:
{{PLAN_INTENT}}
ANALYSIS_INPUTS:
{{ANALYSIS_INPUTS}}
CONSTRAINTS:
{{CONSTRAINTS}}`,
      outputs: [{ id: 'plan_output_path', sourceFieldId: 'PLAN_OUTPUT_PATH', type: 'path' }],
    },
    {
      id: 'backend-plan',
      displayName: '/backend-plan',
      stage: 'plan',
      constraintLevel: 'strong',
      description: 'Java/Spring backend design plan.',
      fields: [
        { id: 'PLAN_OUTPUT_PATH', label: 'Plan output path', type: 'path', required: true },
        { id: 'PLAN_INTENT', label: 'Plan intent', type: 'multiline', required: true },
        { id: 'CONTEXT', label: 'Context', type: 'multiline' },
        { id: 'CONSTRAINTS', label: 'Constraints', type: 'multiline' },
      ],
      template: `/backend-plan
PLAN_OUTPUT_PATH: {{PLAN_OUTPUT_PATH}}
PLAN_INTENT:
{{PLAN_INTENT}}
CONTEXT:
{{CONTEXT}}
CONSTRAINTS:
{{CONSTRAINTS}}`,
      outputs: [{ id: 'plan_output_path', sourceFieldId: 'PLAN_OUTPUT_PATH', type: 'path' }],
    },
    {
      id: 'plan-review',
      displayName: '/plan-review',
      stage: 'plan',
      constraintLevel: 'medium',
      description: 'Critical review for plan quality and execution risk.',
      fields: [{ id: 'PLAN_TEXT', label: 'Plan text', type: 'multiline', required: true }],
      template: `/plan-review
{{PLAN_TEXT}}`,
    },
    {
      id: 'review',
      displayName: '/review',
      stage: 'review',
      constraintLevel: 'medium',
      description: 'Code/content review with configurable depth.',
      fields: [
        {
          id: 'LEVEL',
          label: 'Level',
          type: 'select',
          options: [
            { value: 'standard', label: 'standard' },
            { value: 'strict', label: 'strict' },
          ],
          defaultValue: 'standard',
        },
        { id: 'INPUT', label: 'Input', type: 'multiline', required: true },
      ],
      template: `/review
LEVEL: {{LEVEL}}
INPUT:
{{INPUT}}`,
    },
    {
      id: 'review-lite',
      displayName: '/review-lite',
      stage: 'review',
      constraintLevel: 'weak',
      description: 'Lightweight review for obvious issues.',
      fields: [{ id: 'ARGUMENTS', label: 'Input', type: 'multiline', required: true }],
      template: `/review-lite
{{ARGUMENTS}}`,
    },
    {
      id: 'review-only',
      displayName: '/review-only',
      stage: 'review',
      constraintLevel: 'medium',
      description: 'Review-only mode without implementation.',
      fields: [{ id: 'ARGUMENTS', label: 'Input', type: 'multiline', required: true }],
      template: `/review-only
{{ARGUMENTS}}`,
    },
    {
      id: 'review-strict',
      displayName: '/review-strict',
      stage: 'review',
      constraintLevel: 'strong',
      description: 'Strict and exhaustive review.',
      fields: [{ id: 'ARGUMENTS', label: 'Input', type: 'multiline', required: true }],
      template: `/review-strict
{{ARGUMENTS}}`,
    },
    {
      id: 'implement-plan',
      displayName: '/implement-plan',
      stage: 'implement',
      constraintLevel: 'strong',
      description: 'Implement strictly from an approved plan.',
      fields: [
        { id: 'PLAN_INPUT_PATH', label: 'Plan input path', type: 'path', required: true },
        { id: 'PLAN_APPROVED', label: 'Plan approved', type: 'text', required: true, defaultValue: 'true' },
        { id: 'NOTES', label: 'Notes', type: 'multiline' },
      ],
      template: `/implement-plan
PLAN_INPUT_PATH: {{PLAN_INPUT_PATH}}
PLAN_APPROVED: {{PLAN_APPROVED}}
NOTES:
{{NOTES}}`,
    },
    {
      id: 'implement-standard',
      displayName: '/implement-standard',
      stage: 'implement',
      constraintLevel: 'medium',
      description: 'Controlled implementation with minor adjustments allowed.',
      fields: [
        { id: 'INSTRUCTIONS', label: 'Instructions', type: 'multiline', required: true },
        { id: 'NOTES', label: 'Notes', type: 'multiline' },
      ],
      template: `/implement-standard
INSTRUCTIONS:
{{INSTRUCTIONS}}
NOTES:
{{NOTES}}`,
    },
    {
      id: 'implement-lite',
      displayName: '/implement-lite',
      stage: 'implement',
      constraintLevel: 'weak',
      description: 'Fast, pragmatic implementation.',
      fields: [
        { id: 'INSTRUCTIONS', label: 'Instructions', type: 'multiline', required: true },
        { id: 'NOTES', label: 'Notes', type: 'multiline' },
      ],
      template: `/implement-lite
INSTRUCTIONS:
{{INSTRUCTIONS}}
NOTES:
{{NOTES}}`,
    },
    {
      id: 'finalize-work',
      displayName: '/finalize-work',
      stage: 'finalize',
      constraintLevel: 'strong',
      description: 'Package final changes for review and handoff.',
      fields: [
        { id: 'CHANGES', label: 'What changed', type: 'multiline', required: true },
        { id: 'WHY', label: 'Why', type: 'multiline', required: true },
        { id: 'LIMITATIONS', label: 'Known limitations', type: 'multiline' },
        { id: 'FOLLOW_UP', label: 'Follow-up work', type: 'multiline' },
      ],
      template: `/finalize-work
WHAT WAS CHANGED:
{{CHANGES}}
WHY:
{{WHY}}
KNOWN LIMITATIONS:
{{LIMITATIONS}}
FOLLOW-UP WORK:
{{FOLLOW_UP}}`,
    },
    {
      id: 'finalize-lite',
      displayName: '/finalize-lite',
      stage: 'finalize',
      constraintLevel: 'weak',
      description: 'Minimal close-out summary.',
      fields: [
        { id: 'CHANGES', label: 'What changed', type: 'multiline', required: true },
        { id: 'WHY', label: 'Why', type: 'multiline', required: true },
        { id: 'LIMITATIONS', label: 'Known limitations', type: 'multiline' },
      ],
      template: `/finalize-lite
WHAT:
{{CHANGES}}
WHY:
{{WHY}}
LIMITATIONS:
{{LIMITATIONS}}`,
    },
  ],
  workflows: [
    {
      id: 'workflow-a',
      title: 'New feature path',
      intendedScenario: 'New feature with unclear requirements',
      audience: 'new user',
      steps: [
        { stepId: 'wfa1', commandId: 'senior-explore' },
        { stepId: 'wfa2', commandId: 'plan-lite' },
        {
          stepId: 'wfa3',
          commandId: 'produce-plan',
          optional: true,
          autoBindings: [{ fromVar: 'analysis_export_path', toFieldId: 'ANALYSIS_INPUTS', mode: 'appendListItemIfPresent' }],
        },
        { stepId: 'wfa4', commandId: 'plan-review' },
        { stepId: 'wfa5', commandId: 'implement-standard' },
        { stepId: 'wfa6', commandId: 'finalize-work' },
      ],
    },
    {
      id: 'workflow-b',
      title: 'Production incident path',
      intendedScenario: 'Incident analysis and fix',
      audience: 'power user',
      steps: [
        { stepId: 'wfb1', commandId: 'senior-explore' },
        { stepId: 'wfb2', commandId: 'plan-lite', optional: true },
        { stepId: 'wfb3', commandId: 'implement-standard' },
        { stepId: 'wfb4', commandId: 'review-strict', optional: true },
        { stepId: 'wfb5', commandId: 'finalize-work' },
      ],
    },
    {
      id: 'workflow-c',
      title: 'PR review path',
      intendedScenario: 'Progressive review depth for pull requests',
      audience: 'new user',
      steps: [
        { stepId: 'wfc1', commandId: 'review-lite', optional: true },
        { stepId: 'wfc2', commandId: 'review', optional: true },
        { stepId: 'wfc3', commandId: 'review-strict', optional: true },
      ],
    },
    {
      id: 'workflow-d',
      title: 'Java backend end-to-end path',
      intendedScenario: 'Backend planning through delivery',
      audience: 'power user',
      steps: [
        { stepId: 'wfd1', commandId: 'senior-explore' },
        { stepId: 'wfd2', commandId: 'backend-plan' },
        { stepId: 'wfd3', commandId: 'plan-review' },
        { stepId: 'wfd4', commandId: 'implement-plan', autoBindings: [{ fromVar: 'plan_output_path', toFieldId: 'PLAN_INPUT_PATH', mode: 'set' }] },
        { stepId: 'wfd5', commandId: 'review-strict', optional: true },
        { stepId: 'wfd6', commandId: 'finalize-work' },
      ],
    },
  ],
  scenarios: [
    { id: 'req-new-feature', category: 'Analysis', title: 'Analyze new feature requirements', recommendCommandId: 'senior-explore' },
    { id: 'req-quick-align', category: 'Analysis', title: 'Quick alignment', recommendCommandId: 'explore' },
    { id: 'doc-review', category: 'Analysis', title: 'Review requirement documents', recommendCommandId: 'explore-review' },
    { id: 'incident-deep', category: 'Incident', title: 'Production issue triage', recommendWorkflowId: 'workflow-b' },
    { id: 'design-formal', category: 'Planning', title: 'Formal technical design', recommendCommandId: 'produce-plan' },
    { id: 'java-backend', category: 'Planning', title: 'Java backend design and delivery', recommendWorkflowId: 'workflow-d' },
    { id: 'plan-review-scene', category: 'Planning', title: 'Plan quality review', recommendCommandId: 'plan-review' },
    { id: 'pr-review', category: 'Code review', title: 'Pull request review', recommendWorkflowId: 'workflow-c' },
    { id: 'implement', category: 'Implementation', title: 'Implement with approved plan', recommendCommandId: 'implement-plan' },
    { id: 'handoff', category: 'Delivery', title: 'Finalize and handoff', recommendCommandId: 'finalize-work' },
  ],
};
