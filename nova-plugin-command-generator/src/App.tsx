
import { useEffect, useMemo, useState } from 'react';
import { manifest } from './data/manifest';
import { Attachment, CommandDefinition, FormState, HistoryEntry, ScenarioDefinition } from './types';
import { addHistory, loadHistory, saveHistory } from './store/history';
import { renderTemplate, stageOrder, constraintLabel, constraintOrder } from './utils/render';

type Tab = 'scenes' | 'commands' | 'generator' | 'workflows' | 'workflow-run' | 'history';

const stageLabels: Record<string, string> = {
  explore: 'Explore',
  plan: 'Plan',
  review: 'Review',
  implement: 'Implement',
  finalize: 'Finalize',
};

const icons = {
  scenes: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h6l2 2h8v10H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  commands: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  generator: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12v10H6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 10h6M9 14h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  workflows: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h6v4H6zM12 13h6v4h-6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9h6M6 15h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  steps: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h10M7 12h10M7 18h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h8l4 4v6H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 13h4M10 17h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h6l2 2h8v8H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  export: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M8 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 14v5h14v-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M8 10l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11l8-4M8 13l8 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

type IconName = keyof typeof icons;

const Icon = ({ name, className }: { name: IconName; className?: string }) => (
  <span className={className ?? 'icon'}>{icons[name]}</span>
);

const initForm = (cmd: CommandDefinition): FormState =>
  cmd.fields.reduce<FormState>((acc, f) => {
    acc[f.id] = f.defaultValue ?? (f.type === 'list' ? [] : '');
    return acc;
  }, {});

const formatDate = (ts: number) => new Date(ts).toLocaleString();

const isFieldFilled = (fieldId: string, cmd: CommandDefinition, value: FormState[string]) => {
  const field = cmd.fields.find((f) => f.id === fieldId);
  if (!field) return Boolean(value);
  if (field.type === 'list') return Array.isArray(value) && value.length > 0;
  if (field.type === 'boolean') return value === true;
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
};

const getMissingVariables = (text: string) => {
  const matches = Array.from(text.matchAll(/<<MISSING:([^>]+)>>/g)).map((m) => m[1]);
  return Array.from(new Set(matches));
};

const getDefaultAttachmentTarget = (cmd: CommandDefinition) =>
  cmd.fields.find((f) => f.id === 'CONTEXT')?.id ?? cmd.fields[0]?.id ?? '';

export default function App() {
  const firstCommand = manifest.commands[0];
  const [tab, setTab] = useState<Tab>('scenes');
  const [selectedCommandId, setSelectedCommandId] = useState<string>(firstCommand?.id ?? '');
  const [formState, setFormState] = useState<FormState>(firstCommand ? initForm(firstCommand) : {});
  const [formDraft, setFormDraft] = useState<FormState | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentTarget, setAttachmentTarget] = useState<string>(firstCommand ? getDefaultAttachmentTarget(firstCommand) : '');
  const [attachmentMode, setAttachmentMode] = useState<'path' | 'snippet' | 'full'>('snippet');
  const [previewOverride, setPreviewOverride] = useState<string | null>(null);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [workflowStepIndex, setWorkflowStepIndex] = useState(0);
  const [workflowForms, setWorkflowForms] = useState<Record<string, FormState>>({});
  const [workflowAttachments, setWorkflowAttachments] = useState<Record<string, Attachment[]>>({});
  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const [workflowStepStatus, setWorkflowStepStatus] = useState<Record<string, 'pending' | 'done' | 'skipped'>>({});
  const [workflowPreviewOverrides, setWorkflowPreviewOverrides] = useState<Record<string, string>>({});
  const [workflowBindingsApplied, setWorkflowBindingsApplied] = useState<Record<string, boolean>>({});
  const [workflowVarKey, setWorkflowVarKey] = useState('');
  const [workflowVarValue, setWorkflowVarValue] = useState('');
  const [workflowAttachmentTarget, setWorkflowAttachmentTarget] = useState('');
  const [workflowAttachmentMode, setWorkflowAttachmentMode] = useState<'path' | 'snippet' | 'full'>('snippet');

  const selectedCommand = useMemo(
    () => manifest.commands.find((c) => c.id === selectedCommandId) ?? manifest.commands[0],
    [selectedCommandId],
  );

  useEffect(() => {
    if (!selectedCommand) return;
    setFormState(formDraft ?? initForm(selectedCommand));
    setFormDraft(null);
    setVariables({});
    setAttachments([]);
    setPreviewOverride(null);
    setAttachmentMode('snippet');
    setAttachmentTarget(getDefaultAttachmentTarget(selectedCommand));
  }, [selectedCommandId, selectedCommand]);

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [fieldId]: value }));
  };

  const clearFieldValue = (fieldId: string, fieldType: string) => {
    if (fieldType === 'list') {
      setFormState((prev) => ({ ...prev, [fieldId]: [] }));
      return;
    }
    handleFieldChange(fieldId, '');
  };

  const handleListChange = (fieldId: string, raw: string) => {
    const list = raw
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    setFormState((prev) => ({ ...prev, [fieldId]: list }));
  };

  const computedPreview = selectedCommand ? renderTemplate(selectedCommand, formState, variables) : '';
  const previewText = previewOverride ?? computedPreview;
  const missingVars = getMissingVariables(computedPreview);

  const canGenerate = selectedCommand
    ? selectedCommand.fields.every((f) => !f.required || isFieldFilled(f.id, selectedCommand, formState[f.id]))
    : false;

  const missingRequired = selectedCommand
    ? selectedCommand.fields.filter((f) => f.required && !isFieldFilled(f.id, selectedCommand, formState[f.id]))
    : [];

  const handleAddHistory = () => {
    if (!selectedCommand) return;
    const entry: HistoryEntry = {
      id: `${selectedCommand.id}-${Date.now()}`,
      commandId: selectedCommand.id,
      createdAt: Date.now(),
      fields: formState,
      commandText: previewText,
    };
    const list = addHistory(entry);
    setHistory(list);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      const snippet = text.slice(0, 2000);
      next.push({ name: file.name, content: snippet });
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const insertAttachmentsToField = (fieldId: string, mode: 'path' | 'snippet' | 'full') => {
    if (!selectedCommand) return;
    const fieldDef = selectedCommand.fields.find((f) => f.id === fieldId);
    if (!fieldDef) return;
    if (fieldDef.type === 'list') {
      const existing = Array.isArray(formState[fieldId]) ? (formState[fieldId] as string[]) : [];
      const items = attachments.map((a) => `File: ${a.name}`);
      setFormState((prev) => ({ ...prev, [fieldId]: [...existing, ...items] }));
      return;
    }
    const field = formState[fieldId];
    const existing = typeof field === 'string' ? field : '';
    const joined = attachments
      .map((a) => {
        if (mode === 'path') return `- File: ${a.name}`;
        if (mode === 'snippet') return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
        return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
      })
      .join('\n');
    handleFieldChange(fieldId, `${existing}\n${joined}`.trim());
  };

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  };

  const exportBlob = (content: string, filename: string, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildExportPayload = (cmd: CommandDefinition, fields: FormState, text: string, kind: 'md' | 'txt' | 'json') => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `${cmd.id}-${ts}`;
    if (kind === 'txt') {
      return { filename: `${base}.txt`, content: text, type: 'text/plain' };
    }
    if (kind === 'json') {
      return { filename: `${base}.json`, content: JSON.stringify({ commandId: cmd.id, fields }, null, 2), type: 'application/json' };
    }
    const md = `# ${cmd.displayName}\n\n生成时间：${ts}\n\n## 字段快照\n\`\`\`json\n${JSON.stringify(fields, null, 2)}\n\`\`\`\n\n## 命令文本\n\`\`\`\n${text}\n\`\`\`\n`;
    return { filename: `${base}.md`, content: md, type: 'text/markdown' };
  };

  const handleSingleExport = async (kind: 'md' | 'txt' | 'json', mode: 'download' | 'save' | 'share') => {
    if (!selectedCommand) return;
    const payload = buildExportPayload(selectedCommand, formState, previewText, kind);
    if (mode === 'download') {
      exportBlob(payload.content, payload.filename, payload.type);
      return;
    }
    if (mode === 'save') {
      const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: (options?: unknown) => Promise<any> })
        .showSaveFilePicker;
      if (!showSaveFilePicker) {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
      const handle = await showSaveFilePicker({
        suggestedName: payload.filename,
        types: [{ description: payload.type, accept: { [payload.type]: [`.${kind}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(payload.content);
      await writable.close();
      return;
    }
    if (mode === 'share' && navigator.share) {
      try {
        await navigator.share({ title: selectedCommand.displayName, text: payload.content });
        return;
      } catch {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
    }
    exportBlob(payload.content, payload.filename, payload.type);
  };

  const setCommandAndSwitch = (id: string) => {
    setSelectedCommandId(id);
    setTab('generator');
  };

  const sceneCards = (scenarios: ScenarioDefinition[]) =>
    scenarios.map((s) => (
      <div key={s.id} className="card">
        <div className="card-title">{s.title}</div>
        <div className="card-sub">{s.category}</div>
        {s.recommendCommandId && (
          <button className="btn" onClick={() => setCommandAndSwitch(s.recommendCommandId)}>
            用 {s.recommendCommandId}
          </button>
        )}
        {s.recommendWorkflowId && (
          <button className="btn ghost" onClick={() => startWorkflow(s.recommendWorkflowId)}>
            启动工作流
          </button>
        )}
      </div>
    ));

  const sortedCommands = useMemo(
    () =>
      [...manifest.commands].sort(
        (a, b) =>
          stageOrder[a.stage] - stageOrder[b.stage] ||
          constraintOrder[a.constraintLevel] - constraintOrder[b.constraintLevel] ||
          a.displayName.localeCompare(b.displayName),
      ),
    [],
  );

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandDefinition[]> = {};
    sortedCommands.forEach((c) => {
      groups[c.stage] = groups[c.stage] || [];
      groups[c.stage].push(c);
    });
    return groups;
  }, [sortedCommands]);

  const attachableFields = selectedCommand
    ? selectedCommand.fields.filter((f) => f.type !== 'select' && f.type !== 'boolean')
    : [];

  const startWorkflow = (workflowId: string) => {
    setActiveWorkflowId(workflowId);
    setWorkflowStepIndex(0);
    setWorkflowForms({});
    setWorkflowAttachments({});
    setWorkflowVariables({});
    setWorkflowStepStatus({});
    setWorkflowPreviewOverrides({});
    setWorkflowBindingsApplied({});
    setTab('workflow-run');
  };

  const activeWorkflow = useMemo(
    () => (activeWorkflowId ? manifest.workflows.find((w) => w.id === activeWorkflowId) ?? null : null),
    [activeWorkflowId],
  );

  const currentStep = activeWorkflow?.steps[workflowStepIndex];
  const workflowCommand = currentStep ? manifest.commands.find((c) => c.id === currentStep.commandId) ?? null : null;
  const workflowFormState = currentStep && workflowCommand ? workflowForms[currentStep.stepId] ?? initForm(workflowCommand) : null;
  const workflowAttachmentsList = currentStep ? workflowAttachments[currentStep.stepId] ?? [] : [];
  const workflowComputedPreview =
    currentStep && workflowCommand && workflowFormState ? renderTemplate(workflowCommand, workflowFormState, workflowVariables) : '';
  const workflowPreviewOverride = currentStep && currentStep.stepId in workflowPreviewOverrides ? workflowPreviewOverrides[currentStep.stepId] : null;
  const workflowPreviewText = workflowPreviewOverride ?? workflowComputedPreview;
  const workflowMissingVars = getMissingVariables(workflowComputedPreview);
  useEffect(() => {
    if (!currentStep || !workflowCommand) return;
    setWorkflowForms((prev) => {
      if (prev[currentStep.stepId]) return prev;
      return { ...prev, [currentStep.stepId]: initForm(workflowCommand) };
    });
    setWorkflowAttachmentTarget(getDefaultAttachmentTarget(workflowCommand));
    setWorkflowAttachmentMode('snippet');
  }, [currentStep?.stepId, workflowCommand?.id]);

  const updateWorkflowForm = (updater: (current: FormState) => FormState) => {
    if (!currentStep || !workflowCommand) return;
    setWorkflowForms((prev) => {
      const current = prev[currentStep.stepId] ?? initForm(workflowCommand);
      const next = updater(current);
      return { ...prev, [currentStep.stepId]: next };
    });
  };

  const updateWorkflowField = (fieldId: string, value: string | boolean) => {
    updateWorkflowForm((current) => ({ ...current, [fieldId]: value }));
  };

  const clearWorkflowFieldValue = (fieldId: string, fieldType: string) => {
    if (fieldType === 'list') {
      updateWorkflowForm((current) => ({ ...current, [fieldId]: [] }));
      return;
    }
    updateWorkflowField(fieldId, '');
  };

  const updateWorkflowList = (fieldId: string, raw: string) => {
    const list = raw
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    updateWorkflowForm((current) => ({ ...current, [fieldId]: list }));
  };

  const handleWorkflowFileUpload = async (files: FileList | null) => {
    if (!files || !currentStep) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      next.push({ name: file.name, content: text.slice(0, 2000) });
    }
    setWorkflowAttachments((prev) => ({
      ...prev,
      [currentStep.stepId]: [...(prev[currentStep.stepId] ?? []), ...next],
    }));
  };

  const insertWorkflowAttachments = (fieldId: string, mode: 'path' | 'snippet' | 'full') => {
    if (!currentStep || !workflowCommand || !workflowFormState) return;
    const fieldDef = workflowCommand.fields.find((f) => f.id === fieldId);
    if (!fieldDef) return;
    if (fieldDef.type === 'list') {
      const existing = Array.isArray(workflowFormState[fieldId]) ? (workflowFormState[fieldId] as string[]) : [];
      const items = workflowAttachmentsList.map((a) => `File: ${a.name}`);
      updateWorkflowForm((current) => ({ ...current, [fieldId]: [...existing, ...items] }));
      return;
    }
    const existing = typeof workflowFormState[fieldId] === 'string' ? (workflowFormState[fieldId] as string) : '';
    const joined = workflowAttachmentsList
      .map((a) => {
        if (mode === 'path') return `- File: ${a.name}`;
        if (mode === 'snippet') return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
        return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
      })
      .join('\n');
    updateWorkflowField(fieldId, `${existing}\n${joined}`.trim());
  };

  const applyBindingsForStep = () => {
    if (!currentStep || !workflowCommand) return;
    if (!currentStep.autoBindings || currentStep.autoBindings.length === 0) return;
    updateWorkflowForm((current) => {
      let next = { ...current };
      let changed = false;
      currentStep.autoBindings.forEach((binding) => {
        const value = workflowVariables[binding.fromVar];
        if (!value) return;
        const fieldDef = workflowCommand.fields.find((f) => f.id === binding.toFieldId);
        if (!fieldDef) return;
        if (fieldDef.type === 'list') {
          const list = Array.isArray(next[binding.toFieldId]) ? [...(next[binding.toFieldId] as string[])] : [];
          if (!list.includes(value)) {
            list.push(value);
            next[binding.toFieldId] = list;
            changed = true;
          }
          return;
        }
        if (binding.mode === 'set' || !String(next[binding.toFieldId] ?? '').trim()) {
          next[binding.toFieldId] = value;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  };

  useEffect(() => {
    if (!currentStep || !workflowCommand) return;
    if (workflowBindingsApplied[currentStep.stepId]) return;
    applyBindingsForStep();
    setWorkflowBindingsApplied((prev) => ({ ...prev, [currentStep.stepId]: true }));
  }, [currentStep?.stepId, workflowCommand?.id, activeWorkflowId]);

  const handleWorkflowGenerate = () => {
    if (!currentStep || !workflowCommand || !workflowFormState) return;
    const entry: HistoryEntry = {
      id: `${workflowCommand.id}-${Date.now()}`,
      commandId: workflowCommand.id,
      createdAt: Date.now(),
      fields: workflowFormState,
      commandText: workflowPreviewText,
    };
    const list = addHistory(entry);
    setHistory(list);
    if (workflowCommand.outputs) {
      const next = { ...workflowVariables };
      workflowCommand.outputs.forEach((output) => {
        const value = workflowFormState[output.sourceFieldId];
        if (typeof value === 'string' && value.trim()) next[output.id] = value.trim();
      });
      setWorkflowVariables(next);
    }
    setWorkflowStepStatus((prev) => ({ ...prev, [currentStep.stepId]: 'done' }));
  };

  const handleWorkflowSkip = () => {
    if (!currentStep) return;
    setWorkflowStepStatus((prev) => ({ ...prev, [currentStep.stepId]: 'skipped' }));
    if (activeWorkflow && workflowStepIndex < activeWorkflow.steps.length - 1) {
      setWorkflowStepIndex((prev) => prev + 1);
    }
  };

  const handleWorkflowReset = () => {
    setActiveWorkflowId(null);
    setTab('workflows');
  };

  const handleWorkflowExport = async (kind: 'md' | 'txt' | 'json', mode: 'download' | 'save' | 'share') => {
    if (!workflowCommand || !workflowFormState) return;
    const payload = buildExportPayload(workflowCommand, workflowFormState, workflowPreviewText, kind);
    if (mode === 'download') {
      exportBlob(payload.content, payload.filename, payload.type);
      return;
    }
    if (mode === 'save') {
      const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: (options?: unknown) => Promise<any> })
        .showSaveFilePicker;
      if (!showSaveFilePicker) {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
      const handle = await showSaveFilePicker({
        suggestedName: payload.filename,
        types: [{ description: payload.type, accept: { [payload.type]: [`.${kind}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(payload.content);
      await writable.close();
      return;
    }
    if (mode === 'share' && navigator.share) {
      try {
        await navigator.share({ title: workflowCommand.displayName, text: payload.content });
        return;
      } catch {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
    }
    exportBlob(payload.content, payload.filename, payload.type);
  };

  const canGenerateWorkflowStep =
    currentStep && workflowCommand && workflowFormState
      ? workflowCommand.fields.every((f) => !f.required || isFieldFilled(f.id, workflowCommand, workflowFormState[f.id]))
      : false;

  const workflowMissingRequired =
    currentStep && workflowCommand && workflowFormState
      ? workflowCommand.fields.filter((f) => f.required && !isFieldFilled(f.id, workflowCommand, workflowFormState[f.id]))
      : [];

  const supportsDirectoryPicker = Boolean((window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker);
  const supportsSave = Boolean((window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker);
  const supportsShare = Boolean(navigator.share);

  const pickDirectory = async (onPick: (value: string) => void) => {
    const showDirectoryPicker = (window as unknown as { showDirectoryPicker?: () => Promise<any> }).showDirectoryPicker;
    if (!showDirectoryPicker) return;
    const handle = await showDirectoryPicker();
    onPick(handle?.name ?? '');
  };

  const addVariable = () => {
    const key = newVarKey.trim();
    const value = newVarValue.trim();
    if (!key || !value) return;
    setVariables((prev) => ({ ...prev, [key]: value }));
    setNewVarKey('');
    setNewVarValue('');
  };

  const addWorkflowVariable = () => {
    const key = workflowVarKey.trim();
    const value = workflowVarValue.trim();
    if (!key || !value) return;
    setWorkflowVariables((prev) => ({ ...prev, [key]: value }));
    setWorkflowVarKey('');
    setWorkflowVarValue('');
  };

  const removeHistoryItem = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    saveHistory(next);
    setHistory(next);
  };

  const copyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">命令生成器 Command Generator</div>
        <div className="tabs">
          <button className={tab === 'scenes' ? 'tab active' : 'tab'} onClick={() => setTab('scenes')}>
            <Icon name="scenes" />
            场景
          </button>
          <button className={tab === 'commands' ? 'tab active' : 'tab'} onClick={() => setTab('commands')}>
            <Icon name="commands" />
            命令
          </button>
          <button className={tab === 'generator' ? 'tab active' : 'tab'} onClick={() => setTab('generator')}>
            <Icon name="generator" />
            生成
          </button>
          <button className={tab === 'workflows' ? 'tab active' : 'tab'} onClick={() => setTab('workflows')}>
            <Icon name="workflows" />
            工作流
          </button>
          {activeWorkflowId && (
            <button className={tab === 'workflow-run' ? 'tab active' : 'tab'} onClick={() => setTab('workflow-run')}>
              <Icon name="steps" />
              步骤
            </button>
          )}
          <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
            <Icon name="history" />
            历史
          </button>
        </div>
      </header>

      {tab === 'scenes' && (
        <div className="layout">
          <section>
            <h3 className="section-title">
              <Icon name="workflows" /> 工作流场景
            </h3>
            <div className="card-grid">{sceneCards(manifest.scenarios.filter((s) => s.recommendWorkflowId))}</div>
          </section>
          <section>
            <h3 className="section-title">
              <Icon name="commands" /> 命令场景
            </h3>
            <div className="card-grid">{sceneCards(manifest.scenarios.filter((s) => s.recommendCommandId))}</div>
          </section>
        </div>
      )}

      {tab === 'commands' && (
        <div className="layout">
          {Object.entries(groupedCommands).map(([stage, cmds]) => (
            <section key={stage}>
              <h3 className="section-title">
                <Icon name="commands" />
                {stageLabels[stage] ?? stage}（{cmds.length}）
              </h3>
              <div className="card-grid">
                {cmds.map((c) => (
                  <div key={c.id} className="card">
                    <div className="card-title">
                      {c.displayName}{' '}
                      <span className={`pill constraint ${c.constraintLevel}`}>{constraintLabel[c.constraintLevel]}</span>
                    </div>
                    <div className="card-sub">{c.description}</div>
                    <button className="btn" onClick={() => setCommandAndSwitch(c.id)}>
                      生成
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'generator' && selectedCommand && (
        <div className="layout columns">
          <section className="column">
            <h3>命令</h3>
            <select value={selectedCommand.id} onChange={(e) => setSelectedCommandId(e.target.value)} className="select">
              {sortedCommands.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} ({stageLabels[c.stage]})
                </option>
              ))}
            </select>

            <h3 style={{ marginTop: 12 }}>附件</h3>
            <input type="file" multiple onChange={(e) => handleFileUpload(e.target.files)} />
            <div className="muted small">仅路径/片段/全文插入；片段默认前 2000 字符。</div>
            <div className="inline-actions">
              <select value={attachmentTarget} onChange={(e) => setAttachmentTarget(e.target.value)} className="select">
                {attachableFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    插入到：{f.label}
                  </option>
                ))}
              </select>
              <select value={attachmentMode} onChange={(e) => setAttachmentMode(e.target.value as 'path' | 'snippet' | 'full')} className="select">
                <option value="path">仅路径</option>
                <option value="snippet">片段</option>
                <option value="full">全文</option>
              </select>
            </div>
            <div className="attachment-list">
              {attachments.map((a) => (
                <button key={a.name} className="pill" onClick={() => removeAttachment(a.name)}>
                  {a.name} ×
                </button>
              ))}
            </div>
            {attachments.length > 0 && (
              <button className="btn ghost" onClick={() => insertAttachmentsToField(attachmentTarget, attachmentMode)}>
                插入到字段
              </button>
            )}
          </section>

          <section className="column">
            <h3>字段</h3>
            <div className="form">
              {selectedCommand.fields.map((f) => (
                <div key={f.id} className="field">
                  <label>
                    {f.label}
                    {f.required && <span className="required">*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={String(formState[f.id] ?? '')} onChange={(e) => handleFieldChange(f.id, e.target.value)} className="input">
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'boolean' ? (
                    <input type="checkbox" checked={Boolean(formState[f.id])} onChange={(e) => handleFieldChange(f.id, e.target.checked)} />
                  ) : f.type === 'path' ? (
                    <div className="input-row">
                      <input
                        className="input"
                        value={(formState[f.id] as string) ?? ''}
                        placeholder="选择或输入路径"
                        onChange={(e) => handleFieldChange(f.id, e.target.value)}
                      />
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={!supportsDirectoryPicker}
                        onClick={() => pickDirectory((value) => handleFieldChange(f.id, value))}
                      >
                        <Icon name="folder" /> 选文件夹
                      </button>
                    </div>
                  ) : f.type === 'list' ? (
                    <>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="每行一项"
                        value={(formState[f.id] as string[] | undefined)?.join('\n') ?? ''}
                        onChange={(e) => handleListChange(f.id, e.target.value)}
                      />
                      <button className="btn subtle" type="button" onClick={() => clearFieldValue(f.id, f.type)}>
                        <Icon name="trash" /> 清空多行内容
                      </button>
                    </>
                  ) : (
                    <>
                      <textarea
                        className="input"
                        rows={f.type === 'text' ? 2 : 4}
                        value={(formState[f.id] as string) ?? ''}
                        onChange={(e) => handleFieldChange(f.id, e.target.value)}
                      />
                      {f.type === 'multiline' && (
                        <button className="btn subtle" type="button" onClick={() => clearFieldValue(f.id, f.type)}>
                          <Icon name="trash" /> 清空多行内容
                        </button>
                      )}
                    </>
                  )}
                  {f.help && <div className="muted small">{f.help}</div>}
                </div>
              ))}
            </div>
            <div className="inline-actions" style={{ marginTop: 8 }}>
              <button className="btn primary" disabled={!canGenerate} onClick={handleAddHistory}>
                生成并保存
              </button>
              <button className="btn" disabled={!canGenerate} onClick={() => copyText(previewText)}>
                复制命令
              </button>
              {previewOverride !== null && (
                <button className="btn ghost" onClick={() => setPreviewOverride(null)}>
                  重置预览
                </button>
              )}
            </div>
            {missingRequired.length > 0 && (
              <div className="muted small">缺少必填字段：{missingRequired.map((f) => f.label).join('、')}</div>
            )}
            {missingVars.length > 0 && <div className="muted small">缺少变量：{missingVars.join(', ')}</div>}
            <div className="divider" />
            <div className="inline-actions">
              <input
                className="input"
                placeholder="变量名（如 plan_output_path）"
                value={newVarKey}
                onChange={(e) => setNewVarKey(e.target.value)}
              />
              <input className="input" placeholder="变量值" value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} />
              <button className="btn ghost" onClick={addVariable}>
                添加变量
              </button>
            </div>
            {Object.keys(variables).length > 0 && (
              <div className="muted small">当前变量：{Object.entries(variables).map(([k, v]) => `${k}=${v}`).join(' | ')}</div>
            )}
          </section>

          <section className="column">
            <h3>预览</h3>
            <textarea
              className="preview"
              value={previewText}
              onChange={(e) => setPreviewOverride(e.target.value)}
              placeholder="可直接编辑预览内容（不回写表单）"
            />
            <div className="inline-actions">
              <button className="btn" onClick={() => handleSingleExport('md', supportsSave ? 'save' : 'download')}>
                <Icon name="export" /> 保存 .md
              </button>
              <button className="btn ghost" onClick={() => handleSingleExport('txt', 'download')}>
                <Icon name="download" /> 下载 .txt
              </button>
              <button className="btn ghost" onClick={() => handleSingleExport('json', 'download')}>
                <Icon name="download" /> 下载 .json
              </button>
              {supportsShare && (
                <button className="btn" onClick={() => handleSingleExport('txt', 'share')}>
                  <Icon name="share" /> 分享
                </button>
              )}
            </div>
            <div className="muted small">缺失变量将显示为 &lt;&lt;MISSING:var&gt;&gt; ，必填字段缺失会阻断“生成并保存”。</div>
          </section>
        </div>
      )}
      {tab === 'workflows' && (
        <div className="layout">
          <section>
            <h3>工作流模板</h3>
            <div className="card-grid">
              {manifest.workflows.map((w) => (
                <div key={w.id} className="card">
                  <div className="card-title">{w.title}</div>
                  <div className="card-sub">
                    {w.steps.map((s, idx) => (
                      <div key={s.stepId}>
                        {idx + 1}. {s.commandId} {s.optional ? '(可选)' : ''}
                      </div>
                    ))}
                  </div>
                  <button className="btn" onClick={() => startWorkflow(w.id)}>
                    从第 1 步开始
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'workflow-run' && activeWorkflow && currentStep && workflowCommand && workflowFormState && (
        <div className="layout columns">
          <section className="column">
            <h3>{activeWorkflow.title}</h3>
            <div className="stepper">
              {activeWorkflow.steps.map((step, idx) => {
                const status = workflowStepStatus[step.stepId];
                return (
                  <button key={step.stepId} className={`step ${idx === workflowStepIndex ? 'active' : ''}`} onClick={() => setWorkflowStepIndex(idx)}>
                    {idx + 1}. {step.commandId} {step.optional ? '(可选)' : ''} {status === 'done' ? '✓' : status === 'skipped' ? '→' : ''}
                  </button>
                );
              })}
            </div>
            <div className="inline-actions">
              <button
                className="btn ghost"
                onClick={() => setWorkflowStepIndex((prev) => (prev > 0 ? prev - 1 : prev))}
              >
                上一步
              </button>
              <button
                className="btn ghost"
                onClick={() =>
                  setWorkflowStepIndex((prev) =>
                    activeWorkflow && prev < activeWorkflow.steps.length - 1 ? prev + 1 : prev,
                  )
                }
              >
                下一步
              </button>
              <button className="btn ghost" onClick={handleWorkflowReset}>
                退出工作流
              </button>
            </div>
            <div className="divider" />
            <h3>变量</h3>
            <div className="inline-actions">
              <input className="input" placeholder="变量名" value={workflowVarKey} onChange={(e) => setWorkflowVarKey(e.target.value)} />
              <input className="input" placeholder="变量值" value={workflowVarValue} onChange={(e) => setWorkflowVarValue(e.target.value)} />
              <button className="btn ghost" onClick={addWorkflowVariable}>
                添加
              </button>
            </div>
            {Object.keys(workflowVariables).length > 0 && (
              <div className="muted small">{Object.entries(workflowVariables).map(([k, v]) => `${k}=${v}`).join(' | ')}</div>
            )}
          </section>

          <section className="column">
            <h3>步骤：{workflowCommand.displayName}</h3>
            <div className="form">
              {workflowCommand.fields.map((f) => (
                <div key={f.id} className="field">
                  <label>
                    {f.label}
                    {f.required && <span className="required">*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={String(workflowFormState[f.id] ?? '')} onChange={(e) => updateWorkflowField(f.id, e.target.value)} className="input">
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'boolean' ? (
                    <input type="checkbox" checked={Boolean(workflowFormState[f.id])} onChange={(e) => updateWorkflowField(f.id, e.target.checked)} />
                  ) : f.type === 'path' ? (
                    <div className="input-row">
                      <input
                        className="input"
                        value={(workflowFormState[f.id] as string) ?? ''}
                        placeholder="选择或输入路径"
                        onChange={(e) => updateWorkflowField(f.id, e.target.value)}
                      />
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={!supportsDirectoryPicker}
                        onClick={() => pickDirectory((value) => updateWorkflowField(f.id, value))}
                      >
                        <Icon name="folder" /> 选文件夹
                      </button>
                    </div>
                  ) : f.type === 'list' ? (
                    <>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="每行一项"
                        value={(workflowFormState[f.id] as string[] | undefined)?.join('\n') ?? ''}
                        onChange={(e) => updateWorkflowList(f.id, e.target.value)}
                      />
                      <button className="btn subtle" type="button" onClick={() => clearWorkflowFieldValue(f.id, f.type)}>
                        <Icon name="trash" /> 清空多行内容
                      </button>
                    </>
                  ) : (
                    <>
                      <textarea
                        className="input"
                        rows={f.type === 'text' ? 2 : 4}
                        value={(workflowFormState[f.id] as string) ?? ''}
                        onChange={(e) => updateWorkflowField(f.id, e.target.value)}
                      />
                      {f.type === 'multiline' && (
                        <button className="btn subtle" type="button" onClick={() => clearWorkflowFieldValue(f.id, f.type)}>
                          <Icon name="trash" /> 清空多行内容
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="inline-actions" style={{ marginTop: 8 }}>
              <button className="btn primary" disabled={!canGenerateWorkflowStep} onClick={handleWorkflowGenerate}>
                生成并保存
              </button>
              <button className="btn ghost" onClick={applyBindingsForStep}>
                应用变量绑定
              </button>
              <button className="btn" onClick={handleWorkflowSkip}>
                跳过此步
              </button>
            </div>
            {workflowMissingRequired.length > 0 && (
              <div className="muted small">缺少必填字段：{workflowMissingRequired.map((f) => f.label).join('、')}</div>
            )}
            {workflowMissingVars.length > 0 && <div className="muted small">缺少变量：{workflowMissingVars.join(', ')}</div>}
            <div className="divider" />
            <h3>附件</h3>
            <input type="file" multiple onChange={(e) => handleWorkflowFileUpload(e.target.files)} />
            <div className="inline-actions">
              <select value={workflowAttachmentTarget} onChange={(e) => setWorkflowAttachmentTarget(e.target.value)} className="select">
                {workflowCommand.fields
                  .filter((f) => f.type !== 'select' && f.type !== 'boolean')
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      插入到：{f.label}
                    </option>
                  ))}
              </select>
              <select
                value={workflowAttachmentMode}
                onChange={(e) => setWorkflowAttachmentMode(e.target.value as 'path' | 'snippet' | 'full')}
                className="select"
              >
                <option value="path">仅路径</option>
                <option value="snippet">片段</option>
                <option value="full">全文</option>
              </select>
            </div>
            <div className="attachment-list">
              {workflowAttachmentsList.map((a) => (
                <div key={a.name} className="pill">
                  {a.name}
                </div>
              ))}
            </div>
            {workflowAttachmentsList.length > 0 && (
              <button className="btn ghost" onClick={() => insertWorkflowAttachments(workflowAttachmentTarget, workflowAttachmentMode)}>
                插入到字段
              </button>
            )}
          </section>

          <section className="column">
            <h3>预览</h3>
            <textarea
              className="preview"
              value={workflowPreviewText}
              onChange={(e) => setWorkflowPreviewOverrides((prev) => ({ ...prev, [currentStep.stepId]: e.target.value }))}
              placeholder="可直接编辑预览内容（不回写表单）"
            />
            <div className="inline-actions">
              <button className="btn" onClick={() => handleWorkflowExport('md', supportsSave ? 'save' : 'download')}>
                <Icon name="export" /> 保存 .md
              </button>
              <button className="btn ghost" onClick={() => handleWorkflowExport('txt', 'download')}>
                <Icon name="download" /> 下载 .txt
              </button>
              {supportsShare && (
                <button className="btn" onClick={() => handleWorkflowExport('txt', 'share')}>
                  <Icon name="share" /> 分享
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {tab === 'history' && (
        <div className="layout">
          <section>
            <h3>历史记录</h3>
            <div className="card-grid">
              {history.length === 0 && <div className="muted">暂无历史</div>}
              {history.map((h) => (
                <div key={h.id} className="card">
                  <div className="card-title">
                    {h.commandId} <span className="card-sub">{formatDate(h.createdAt)}</span>
                  </div>
                  <pre className="small muted code">
                    {h.commandText.slice(0, 200)}
                    {h.commandText.length > 200 ? '...' : ''}
                  </pre>
                  <div className="inline-actions">
                    <button className="btn" onClick={() => copyText(h.commandText)}>
                      复制
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setFormDraft(h.fields);
                        setSelectedCommandId(h.commandId);
                        setTab('generator');
                      }}
                    >
                      复用
                    </button>
                    <button className="btn ghost" onClick={() => removeHistoryItem(h.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
