import { useEffect, useMemo, useState } from 'react';
import { CommandDefinition, StageKey } from '../../types';
import { Icon } from '../../components/Icon';
import { constraintLabel, constraintOrder, stageOrder } from '../../utils/render';
import { stageFlow } from '../../utils/guidance';
import { manifest } from '../../data/manifest';

const stageLabels: Record<string, string> = {
  explore: '探索',
  plan: '规划',
  review: '评审',
  implement: '实施',
  finalize: '交付',
};

interface CommandsPanelProps {
  onSelectCommand: (id: string) => void;
  onGoToHistory: () => void;
}

const isSpecializedCommand = (command: CommandDefinition) =>
  /backend|frontend|ios|android|java|spring|database|db|infra|security|ml|data/i.test(
    `${command.id} ${command.displayName} ${command.description}`,
  );

const getCommandPrerequisites = (command: CommandDefinition) => {
  const requiredFields = command.fields.filter((field) => field.required);
  const prereqLabels = requiredFields.map((field) => field.label);
  const hasStrongPrereq =
    command.constraintLevel === 'strong' ||
    requiredFields.length >= 2 ||
    requiredFields.some((field) => /APPROV|PLAN|REVIEW|SPEC|DESIGN/i.test(`${field.id} ${field.label}`));
  const hasArtifactHint = requiredFields.some((field) => /APPROV|PLAN|REVIEW|SPEC|DESIGN/i.test(`${field.id} ${field.label}`));
  return { requiredFields, prereqLabels, hasStrongPrereq, hasArtifactHint };
};

export function CommandsPanel({ onSelectCommand, onGoToHistory }: CommandsPanelProps) {
  const [commandStageFilter, setCommandStageFilter] = useState<'all' | StageKey>('all');
  const [commandRigorFilter, setCommandRigorFilter] = useState<'all' | 'weak' | 'medium' | 'strong'>('all');
  const [commandDomainFilter, setCommandDomainFilter] = useState<'all' | 'general' | 'specialized'>('all');
  const [showSpecializedCommands, setShowSpecializedCommands] = useState(false);

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

  const filteredCommands = useMemo(() => {
    return sortedCommands.filter((command) => {
      const stageOk = commandStageFilter === 'all' || command.stage === commandStageFilter;
      const rigorOk = commandRigorFilter === 'all' || command.constraintLevel === commandRigorFilter;
      return stageOk && rigorOk;
    });
  }, [sortedCommands, commandStageFilter, commandRigorFilter]);

  const filteredGeneralCommands = useMemo(
    () => filteredCommands.filter((command) => !isSpecializedCommand(command)),
    [filteredCommands],
  );

  const filteredSpecializedCommands = useMemo(
    () => filteredCommands.filter((command) => isSpecializedCommand(command)),
    [filteredCommands],
  );

  const groupedGeneralCommands = useMemo(() => {
    const groups: Record<string, CommandDefinition[]> = {};
    filteredGeneralCommands.forEach((command) => {
      groups[command.stage] = groups[command.stage] || [];
      groups[command.stage].push(command);
    });
    return groups;
  }, [filteredGeneralCommands]);

  const groupedSpecializedCommands = useMemo(() => {
    const groups: Record<string, CommandDefinition[]> = {};
    filteredSpecializedCommands.forEach((command) => {
      groups[command.stage] = groups[command.stage] || [];
      groups[command.stage].push(command);
    });
    return groups;
  }, [filteredSpecializedCommands]);

  useEffect(() => {
    if (commandDomainFilter === 'specialized') {
      setShowSpecializedCommands(true);
    }
  }, [commandDomainFilter]);

  const renderCommandCard = (command: CommandDefinition) => {
    const prereq = getCommandPrerequisites(command);
    return (
      <div key={command.id} className="card">
        <div className="card-title">{command.displayName}</div>
        <div className="command-id">
          命令标识 <code>{command.id}</code>
        </div>
        <div className="command-meta">
          <span className="badge">{stageLabels[command.stage]}</span>
          <span
            className={`badge ${
              command.constraintLevel === 'strong'
                ? 'rigor-strict'
                : command.constraintLevel === 'medium'
                  ? 'rigor-standard'
                  : 'rigor-lite'
            }`}
          >
            {constraintLabel[command.constraintLevel]}
          </span>
          {command.constraintLevel === 'strong' && <span className="badge severity-high">高影响</span>}
        </div>
        <div className="card-sub">{command.description}</div>
        {prereq.requiredFields.length > 0 && prereq.hasStrongPrereq ? (
          <div className="command-warning" title={prereq.prereqLabels.join(' + ')}>
            使用前需提供：{prereq.prereqLabels.join(' + ')}
            {prereq.hasArtifactHint && (
              <button className="link-inline" type="button" onClick={onGoToHistory}>
                查看产出
              </button>
            )}
          </div>
        ) : prereq.requiredFields.length > 0 ? (
          <div className="command-prereq">必填：{prereq.prereqLabels.join(' + ')}</div>
        ) : null}
        <div className="card-actions">
          <button className="btn primary" onClick={() => onSelectCommand(command.id)}>
            进入生成器
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="layout">
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">阶段</span>
          <select
            className="select"
            value={commandStageFilter}
            onChange={(e) => setCommandStageFilter(e.target.value as 'all' | StageKey)}
          >
            <option value="all">全部阶段</option>
            {stageFlow.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage]}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">严格度</span>
          <select
            className="select"
            value={commandRigorFilter}
            onChange={(e) => setCommandRigorFilter(e.target.value as 'all' | 'weak' | 'medium' | 'strong')}
          >
            <option value="all">全部</option>
            <option value="weak">轻量</option>
            <option value="medium">标准</option>
            <option value="strong">严格</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">领域</span>
          <select
            className="select"
            value={commandDomainFilter}
            onChange={(e) => setCommandDomainFilter(e.target.value as 'all' | 'general' | 'specialized')}
          >
            <option value="all">通用 + 专项</option>
            <option value="general">通用</option>
            <option value="specialized">专项</option>
          </select>
        </div>
      </div>

      {commandDomainFilter !== 'specialized' &&
        stageFlow.map((stage) => {
          const cmds = groupedGeneralCommands[stage] ?? [];
          if (cmds.length === 0) return null;
          return (
            <section key={stage} className="section-shell">
              <h3 className="section-title">
                <Icon name="commands" />
                {stageLabels[stage]}（{cmds.length}）
              </h3>
              <div className="card-grid">{cmds.map(renderCommandCard)}</div>
            </section>
          );
        })}

      {commandDomainFilter !== 'general' && (
        <section className="section-shell specialized-shell">
          <button
            className={`section-toggle ${filteredSpecializedCommands.length === 0 ? 'is-muted' : ''}`}
            onClick={() => setShowSpecializedCommands((prev) => !prev)}
            disabled={filteredSpecializedCommands.length === 0}
          >
            专项命令（{filteredSpecializedCommands.length}）
          </button>
          {showSpecializedCommands && filteredSpecializedCommands.length > 0 && (
            <div className="specialized-group">
              {stageFlow.map((stage) => {
                const cmds = groupedSpecializedCommands[stage] ?? [];
                if (cmds.length === 0) return null;
                return (
                  <div key={stage} className="specialized-stage">
                    <div className="specialized-stage-title">
                      {stageLabels[stage]}（{cmds.length}）
                    </div>
                    <div className="card-grid">{cmds.map(renderCommandCard)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
