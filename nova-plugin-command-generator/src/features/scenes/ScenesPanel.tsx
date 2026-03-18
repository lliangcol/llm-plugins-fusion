import { ScenarioDefinition } from '../../types';
import { Icon } from '../../components/Icon';

interface ScenesPanelProps {
  scenarios: ScenarioDefinition[];
  onSelectCommand: (id: string) => void;
  onStartWorkflow: (id: string) => void;
  onGoToCommands: () => void;
  onGoToWorkflows: () => void;
}

const getSceneRecommendation = (scenario: ScenarioDefinition) => {
  if (scenario.recommendWorkflowId) {
    return {
      type: 'workflow' as const,
      label: '工作流',
      cta: '开始引导',
      note: '该场景包含多步骤，建议用工作流保持节奏一致。',
    };
  }
  return {
    type: 'command' as const,
    label: '单命令',
    cta: '直接开始',
    note: '该场景只需单条命令即可完成。',
  };
};

export function ScenesPanel({ scenarios, onSelectCommand, onStartWorkflow, onGoToCommands, onGoToWorkflows }: ScenesPanelProps) {
  const renderSceneCards = (sceneList: ScenarioDefinition[]) =>
    sceneList.map((s) => {
      const recommendation = getSceneRecommendation(s);
      const hasWorkflow = Boolean(s.recommendWorkflowId);
      const hasCommand = Boolean(s.recommendCommandId);
      const primaryCta = recommendation.cta;
      const categoryTags = Array.from(
        new Set(
          s.category
            .split(/[,/|·]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ).slice(0, 2);
      const secondaryLabel =
        recommendation.type === 'workflow'
          ? hasCommand
            ? '转为单命令'
            : '查看命令'
          : hasWorkflow
            ? '进入工作流'
            : '查看工作流';
      return (
        <div
          key={s.id}
          className={`card scene-card ${s.recommendCommandId || s.recommendWorkflowId ? 'recommended' : ''}`.trim()}
        >
          <div className="scene-card-header">
            <div className="card-title">{s.title}</div>
            <div className="scene-tags">
              {categoryTags.map((tag) => (
                <span key={tag} className="scene-tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="scene-problem-label">问题类型</div>
            <div className="scene-problem">{s.category}</div>
          </div>
          <div className={`scene-path scene-path-${recommendation.type}`}>
            <div className="scene-path-label">
              <Icon name={recommendation.type === 'workflow' ? 'workflows' : 'commands'} />
              推荐路径
            </div>
            <div className="scene-path-value">{recommendation.label}</div>
            <div className="scene-path-why">{recommendation.note}</div>
          </div>
          <div className="card-actions">
            {recommendation.type === 'workflow' && s.recommendWorkflowId ? (
              <button className="btn primary" onClick={() => onStartWorkflow(s.recommendWorkflowId!)}>
                {primaryCta}
              </button>
            ) : s.recommendCommandId ? (
              <button className="btn primary" onClick={() => onSelectCommand(s.recommendCommandId!)}>
                {primaryCta}
              </button>
            ) : (
              <button className="btn primary" onClick={onGoToCommands}>
                {primaryCta}
              </button>
            )}
            <button
              className="btn ghost"
              onClick={() => {
                if (recommendation.type === 'workflow') {
                  if (s.recommendCommandId) {
                    onSelectCommand(s.recommendCommandId);
                    return;
                  }
                  onGoToCommands();
                  return;
                }
                if (s.recommendWorkflowId) {
                  onStartWorkflow(s.recommendWorkflowId);
                  return;
                }
                onGoToWorkflows();
              }}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      );
    });

  return (
    <div className="layout">
      <div className="panel-card scene-intro">
        <div className="panel-title">如何开始</div>
        <div className="scene-intro-text">从场景开始，获得引导路径。</div>
        <button className="btn ghost" onClick={onGoToCommands}>
          想手动？查看命令
        </button>
      </div>
      <section>
        <h3 className="section-title">
          <Icon name="workflows" /> 工作流场景
        </h3>
        <div className="card-grid">{renderSceneCards(scenarios.filter((s) => s.recommendWorkflowId))}</div>
      </section>
      <section>
        <h3 className="section-title">
          <Icon name="commands" /> 命令场景
        </h3>
        <div className="card-grid">{renderSceneCards(scenarios.filter((s) => s.recommendCommandId))}</div>
      </section>
    </div>
  );
}
