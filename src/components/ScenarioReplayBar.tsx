import React from 'react';
import { ScriptedScenario, CustomerProfile } from '../types';
import { PlayCircle, CheckCircle2, ChevronRight, HelpCircle, ArrowRight } from 'lucide-react';

interface ScenarioReplayBarProps {
  scenarios: ScriptedScenario[];
  selectedScenarioId: string;
  activeTurnIndex: number;
  onSelectScenario: (scenarioId: string) => void;
  onSendStepPrompt: (promptText: string) => void;
  isLoading: boolean;
}

export const ScenarioReplayBar: React.FC<ScenarioReplayBarProps> = ({
  scenarios,
  selectedScenarioId,
  activeTurnIndex,
  onSelectScenario,
  onSendStepPrompt,
  isLoading,
}) => {
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  return (
    <div id="scenario-replay-bar" className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center space-x-2">
          <PlayCircle className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Scenario Replayer & Test Turns
          </h3>
        </div>
        <span className="text-[11px] text-slate-500">
          Click any step to auto-send the scripted message into the agent
        </span>
      </div>

      {/* Scenario Selector Pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {scenarios.map((scen) => {
          const isSelected = scen.id === selectedScenarioId;
          return (
            <button
              key={scen.id}
              id={`scenario-pill-${scen.id}`}
              onClick={() => onSelectScenario(scen.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {scen.customerName}: {scen.id.includes('priya') ? 'Cancelled + Upgrade' : scen.id.includes('arvind') ? '4h Delay + Hotel' : '6h Delay + 2k Waiver'}
            </button>
          );
        })}
      </div>

      {/* Step Actions for the current scenario */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {activeScenario.turns.map((turn, idx) => {
          const isCompleted = activeTurnIndex > idx;
          const isCurrent = activeTurnIndex === idx;

          return (
            <div
              key={turn.step}
              className={`border rounded-lg p-2.5 flex flex-col justify-between transition-all ${
                isCompleted
                  ? 'bg-slate-100/70 border-slate-200 text-slate-600'
                  : isCurrent
                  ? 'bg-white border-blue-300 ring-2 ring-blue-100 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Step {turn.step} of {activeScenario.turns.length}
                  </span>
                  {turn.expectedOutcome.shouldEscalate ? (
                    <span className="bg-rose-100 text-rose-700 text-[9px] font-semibold px-1.5 py-0.2 rounded">
                      Triggers Escalation
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] font-semibold px-1.5 py-0.2 rounded">
                      In-Policy
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium mb-1 line-clamp-2" title={turn.userPrompt}>
                  "{turn.userPrompt}"
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  {turn.description}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  {turn.expectedOutcome.ruleApplied}
                </span>
                <button
                  id={`send-step-${turn.step}-btn`}
                  disabled={isLoading}
                  onClick={() => onSendStepPrompt(turn.userPrompt)}
                  className={`text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                    isLoading
                      ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500'
                      : isCurrent
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <span>Send Step {turn.step}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
