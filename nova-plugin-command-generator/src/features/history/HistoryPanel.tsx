import { useState } from 'react';
import { HistoryEntry, StageKey } from '../../types';

interface HistoryPanelProps {
  history: HistoryEntry[];
  getCommandLabel: (commandId: string) => string;
  getCommandStage?: (commandId: string) => StageKey | undefined;
  formatDate: (ts: number) => string;
  copyText: (text: string) => void;
  onReuse: (entry: HistoryEntry) => void;
  onRemove: (entryId: string) => void;
}

const stageLabels: Record<StageKey, string> = {
  explore: '探索',
  plan: '规划',
  review: '评审',
  implement: '实施',
  finalize: '交付',
};

/**
 * 生成历史记录摘要
 * 规则：命令类型 + 阶段 + 时间，超长截断
 */
const generateSummary = (
  entry: HistoryEntry,
  commandLabel: string,
  stage?: StageKey,
): string => {
  const stageText = stage ? `[${stageLabels[stage]}]` : '';
  // 从命令文本中提取意图（第一行非空内容，或前50字符）
  const intentMatch = entry.commandText.match(/INTENT[：:]\s*(.+?)(?:\n|$)/i);
  const intent = intentMatch?.[1]?.slice(0, 40) || entry.commandText.slice(0, 40);
  return `${commandLabel} ${stageText} - ${intent}${intent.length >= 40 ? '...' : ''}`;
};

export const HistoryPanel = ({
  history,
  getCommandLabel,
  getCommandStage,
  formatDate,
  copyText,
  onReuse,
  onRemove,
}: HistoryPanelProps) => {
  // 追踪当前展开详情的条目 ID（用于键盘聚焦）
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="layout">
      <section>
        <h3>历史记录</h3>
        <div className="history-list">
          {history.length === 0 && <div className="muted">暂无历史</div>}
          {history.map((entry) => {
            const commandLabel = getCommandLabel(entry.commandId);
            const stage = getCommandStage?.(entry.commandId);
            const summary = generateSummary(entry, commandLabel, stage);
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className={`history-item ${isExpanded ? 'expanded' : ''}`}
                tabIndex={0}
                onMouseEnter={() => setExpandedId(entry.id)}
                onMouseLeave={() => setExpandedId(null)}
                onFocus={() => setExpandedId(entry.id)}
                onBlur={() => setExpandedId(null)}
              >
                <div className="history-item-summary">
                  <div className="history-item-header">
                    <code className="history-command-label">{commandLabel}</code>
                    {stage && (
                      <span className={`badge history-stage-badge stage-${stage}`}>
                        {stageLabels[stage]}
                      </span>
                    )}
                    <span className="history-time">{formatDate(entry.createdAt)}</span>
                  </div>
                  <div className="history-item-preview">{summary}</div>
                  <div className="inline-actions history-actions">
                    <button
                      className="btn secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(entry.commandText);
                      }}
                    >
                      复制
                    </button>
                    <button
                      className="btn ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReuse(entry);
                      }}
                    >
                      复用
                    </button>
                    <button
                      className="btn danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(entry.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>

                {/* 详情弹出面板 - 仅在悬停/聚焦时显示 */}
                {isExpanded && (
                  <div className="history-detail-popover" role="tooltip">
                    <div className="history-detail-header">
                      <strong>完整命令详情</strong>
                      <span className="history-detail-time">{formatDate(entry.createdAt)}</span>
                    </div>
                    <div className="history-detail-section">
                      <div className="history-detail-label">命令</div>
                      <code>{commandLabel}</code>
                    </div>
                    {stage && (
                      <div className="history-detail-section">
                        <div className="history-detail-label">阶段</div>
                        <span>{stageLabels[stage]}</span>
                      </div>
                    )}
                    <div className="history-detail-section">
                      <div className="history-detail-label">字段快照</div>
                      <pre className="history-detail-fields">
                        {JSON.stringify(entry.fields, null, 2)}
                      </pre>
                    </div>
                    <div className="history-detail-section">
                      <div className="history-detail-label">完整命令文本</div>
                      <pre className="history-detail-command">{entry.commandText}</pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
