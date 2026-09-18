import React, { useState, useMemo } from 'react';
import { AgentReasoning, SessionReasoningLog } from '../types';
import {
  Shield,
  CheckCircle,
  AlertOctagon,
  Info,
  ChevronRight,
  ChevronLeft,
  Lock,
  Search,
  X,
  History,
  Clock,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

interface AgentReasoningPanelProps {
  reasoning: AgentReasoning | null;
  sessionLogs?: SessionReasoningLog[];
  isOpen: boolean;
  onToggle: () => void;
}

export const AgentReasoningPanel: React.FC<AgentReasoningPanelProps> = ({
  reasoning,
  sessionLogs = [],
  isOpen,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistoricalTurnId, setSelectedHistoricalTurnId] = useState<string | null>(null);
  const [expandedTurnIds, setExpandedTurnIds] = useState<Record<string, boolean>>({});

  // Helper to highlight matching text
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim() || !text) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Determine active reasoning to display in the detailed view
  const displayReasoning: AgentReasoning | null = useMemo(() => {
    if (selectedHistoricalTurnId) {
      const found = sessionLogs.find(
        (log) => log.reasoning.turnId === selectedHistoricalTurnId
      );
      if (found) return found.reasoning;
    }
    return reasoning;
  }, [selectedHistoricalTurnId, sessionLogs, reasoning]);

  const viewingHistoricalTurn = useMemo(() => {
    if (!selectedHistoricalTurnId) return null;
    return sessionLogs.find((log) => log.reasoning.turnId === selectedHistoricalTurnId) || null;
  }, [selectedHistoricalTurnId, sessionLogs]);

  // Search filtering logic
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesQuery = (text?: string): boolean => {
    if (!normalizedQuery) return true;
    if (!text) return false;
    return text.toLowerCase().includes(normalizedQuery);
  };

  // Filter history logs based on search query
  const filteredHistoryLogs = useMemo(() => {
    if (!normalizedQuery) return sessionLogs;

    return sessionLogs.filter((log) => {
      const r = log.reasoning;
      if (matchesQuery(log.userPrompt)) return true;
      if (matchesQuery(log.timestamp)) return true;
      if (matchesQuery(`turn ${log.turnNumber}`)) return true;
      if (matchesQuery(r.ruleApplied)) return true;
      if (matchesQuery(r.ruleCode)) return true;
      if (matchesQuery(r.explanation)) return true;
      if (matchesQuery(r.currentIntent)) return true;
      if (matchesQuery(r.requestType)) return true;
      if (matchesQuery(r.actualBookingFact)) return true;
      if (matchesQuery(r.policyEvaluated)) return true;
      if (matchesQuery(r.actionAttempted)) return true;
      if (matchesQuery(r.actionResult)) return true;
      if (matchesQuery(r.customerScoped.name)) return true;
      if (matchesQuery(r.customerScoped.pnr)) return true;
      if (matchesQuery(r.escalation.reason)) return true;
      if (r.escalation.isEscalated && matchesQuery('escalated')) return true;
      if (!r.escalation.isEscalated && matchesQuery('in-policy')) return true;
      if (r.allowedActionsExercised.some((act) => matchesQuery(act))) return true;
      if (r.prohibitedActionsEvaluated.some((p) => matchesQuery(p.action) || matchesQuery(p.reason)))
        return true;
      return false;
    });
  }, [sessionLogs, normalizedQuery]);

  // Search match statistics for the active detailed view
  const currentTabSearchStats = useMemo(() => {
    if (!normalizedQuery || !displayReasoning) return 0;

    let matchCount = 0;
    const check = (str?: string) => {
      if (str && str.toLowerCase().includes(normalizedQuery)) matchCount++;
    };

    check(displayReasoning.ruleApplied);
    check(displayReasoning.ruleCode);
    check(displayReasoning.explanation);
    check(displayReasoning.currentIntent);
    check(displayReasoning.requestType);
    check(displayReasoning.actualBookingFact);
    check(displayReasoning.policyEvaluated);
    check(displayReasoning.actionAttempted);
    check(displayReasoning.actionResult);
    check(displayReasoning.turnId);
    check(displayReasoning.customerScoped.name);
    check(displayReasoning.customerScoped.pnr);
    check(displayReasoning.customerScoped.tier);
    check(displayReasoning.customerScoped.flight);
    check(displayReasoning.customerScoped.statusSummary);
    check(displayReasoning.escalation.reason);
    check(displayReasoning.escalation.assignedQueue);

    displayReasoning.allowedActionsExercised.forEach((act) => check(act));
    displayReasoning.prohibitedActionsEvaluated.forEach((p) => {
      check(p.action);
      check(p.reason);
    });

    return matchCount;
  }, [displayReasoning, normalizedQuery]);

  const toggleTurnExpanded = (turnId: string) => {
    setExpandedTurnIds((prev) => ({
      ...prev,
      [turnId]: !prev[turnId],
    }));
  };

  const handleInspectTurnInDetailedView = (turnId: string) => {
    setSelectedHistoricalTurnId(turnId);
    setActiveTab('current');
  };

  if (!isOpen) {
    return (
      <button
        id="toggle-reasoning-panel-btn"
        onClick={onToggle}
        className="fixed right-4 bottom-20 z-20 flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-3.5 py-2.5 rounded-full shadow-lg hover:bg-slate-800 transition-colors"
        title="Open Agent Reasoning / Policy Audit Panel"
      >
        <Shield className="w-4 h-4 text-emerald-400" />
        <span>Policy Audit Panel</span>
        {sessionLogs.length > 0 && (
          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
            {sessionLogs.length}
          </span>
        )}
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
    );
  }

  // Determine section matches for detailed view
  const ruleSectionMatches =
    !normalizedQuery ||
    matchesQuery(displayReasoning?.ruleApplied) ||
    matchesQuery(displayReasoning?.ruleCode) ||
    matchesQuery(displayReasoning?.turnId);

  const groundingMatches =
    !normalizedQuery ||
    matchesQuery(displayReasoning?.customerScoped.name) ||
    matchesQuery(displayReasoning?.customerScoped.pnr) ||
    matchesQuery(displayReasoning?.customerScoped.tier) ||
    matchesQuery(displayReasoning?.customerScoped.flight) ||
    matchesQuery(displayReasoning?.customerScoped.statusSummary);

  const explanationMatches = !normalizedQuery || matchesQuery(displayReasoning?.explanation);

  const intentAuditMatches =
    !normalizedQuery ||
    matchesQuery(displayReasoning?.currentIntent) ||
    matchesQuery(displayReasoning?.requestType) ||
    matchesQuery(displayReasoning?.actualBookingFact) ||
    matchesQuery(displayReasoning?.policyEvaluated) ||
    matchesQuery(displayReasoning?.actionAttempted) ||
    matchesQuery(displayReasoning?.actionResult);

  const escalationMatches =
    !normalizedQuery ||
    matchesQuery('escalation') ||
    matchesQuery(displayReasoning?.escalation.reason) ||
    matchesQuery(displayReasoning?.escalation.assignedQueue) ||
    (displayReasoning?.escalation.isEscalated && matchesQuery('escalated'));

  const filteredAllowedActions = displayReasoning?.allowedActionsExercised.filter((act) =>
    matchesQuery(act)
  );

  const filteredProhibitedActions = displayReasoning?.prohibitedActionsEvaluated.filter(
    (p) => matchesQuery(p.action) || matchesQuery(p.reason)
  );

  const hasAnyCurrentMatches =
    !normalizedQuery ||
    ruleSectionMatches ||
    intentAuditMatches ||
    groundingMatches ||
    explanationMatches ||
    escalationMatches ||
    (filteredAllowedActions && filteredAllowedActions.length > 0) ||
    (filteredProhibitedActions && filteredProhibitedActions.length > 0);

  return (
    <aside
      id="agent-reasoning-panel"
      className="w-80 lg:w-96 bg-slate-900 text-slate-100 flex flex-col border-l border-slate-800 shadow-xl transition-all duration-200 shrink-0"
    >
      {/* Top Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-200">
            Policy Audit & Reasoning
          </h2>
        </div>
        <button
          id="close-reasoning-panel-btn"
          onClick={onToggle}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 px-2 pt-2">
        <button
          id="tab-current-turn-btn"
          onClick={() => setActiveTab('current')}
          className={`flex-1 py-2 px-3 text-xs font-medium border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'current'
              ? 'border-blue-500 text-blue-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>{viewingHistoricalTurn ? `Turn #${viewingHistoricalTurn.turnNumber}` : 'Active Turn'}</span>
        </button>

        <button
          id="tab-session-history-btn"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-3 text-xs font-medium border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Session History</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {sessionLogs.length}
          </span>
        </button>
      </div>

      {/* Audit Search Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="audit-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'history'
                ? 'Search turns by prompt, rule, keyword...'
                : 'Search policies, rules, keywords...'
            }
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs pl-8 pr-7 py-1.5 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
          />
          {searchQuery && (
            <button
              id="clear-audit-search-btn"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Feedback Badge */}
        {normalizedQuery && (
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 truncate max-w-[180px]">
              Query: <strong className="text-slate-200">"{searchQuery}"</strong>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activeTab === 'history'
                  ? filteredHistoryLogs.length > 0
                    ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                    : 'bg-rose-900/40 text-rose-300 border border-rose-800'
                  : currentTabSearchStats > 0
                  ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                  : 'bg-rose-900/40 text-rose-300 border border-rose-800'
              }`}
            >
              {activeTab === 'history'
                ? `${filteredHistoryLogs.length} / ${sessionLogs.length} turns`
                : `${currentTabSearchStats} matches`}
            </span>
          </div>
        )}
      </div>

      {/* Main Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* ========================================================================= */}
        {/* TAB 1: CURRENT / ACTIVE DETAILED TURN                                     */}
        {/* ========================================================================= */}
        {activeTab === 'current' && (
          <>
            {/* Historical Turn Banner (if reviewer inspected a past turn) */}
            {viewingHistoricalTurn && (
              <div className="bg-blue-950/60 border border-blue-800 rounded-lg p-2.5 flex items-center justify-between text-xs text-blue-200">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    Viewing <strong>Turn #{viewingHistoricalTurn.turnNumber}</strong> ({viewingHistoricalTurn.timestamp})
                  </span>
                </div>
                <button
                  onClick={() => setSelectedHistoricalTurnId(null)}
                  className="text-[10px] bg-blue-800 hover:bg-blue-700 text-white font-medium px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                  title="Return to latest turn"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Latest Turn</span>
                </button>
              </div>
            )}

            {!displayReasoning ? (
              <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-lg">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="font-medium text-slate-300">No agent turn yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Select a customer or send a message. The policy audit rule, prohibited triggers, and reasoning will appear here.
                </p>
              </div>
            ) : !hasAnyCurrentMatches ? (
              <div className="p-6 text-center text-slate-400 border border-slate-800 rounded-lg bg-slate-900/40">
                <Search className="w-7 h-7 mx-auto mb-2 text-slate-500" />
                <p className="font-medium text-slate-300">No matching audit records</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  No policy rules, grounding items, or evaluations match "{searchQuery}".
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-[11px] bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1 rounded font-medium transition-colors"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <>
                {/* Intent & Disruption Context Evaluation */}
                {intentAuditMatches && (displayReasoning.currentIntent || displayReasoning.actualBookingFact) && (
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-2">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-cyan-400" />
                        <span>Query Intent & Policy Audit</span>
                      </span>
                      {displayReasoning.requestType && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          displayReasoning.requestType.includes('Hypothetical')
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                            : 'bg-blue-950/60 text-blue-300 border-blue-800'
                        }`}>
                          {highlightText(displayReasoning.requestType, searchQuery)}
                        </span>
                      )}
                    </div>

                    {displayReasoning.currentIntent && (
                      <div>
                        <span className="text-[10px] text-slate-400">Current Intent: </span>
                        <span className="text-slate-200 font-medium text-[11px]">
                          {highlightText(displayReasoning.currentIntent, searchQuery)}
                        </span>
                      </div>
                    )}

                    {displayReasoning.actualBookingFact && (
                      <div className="bg-slate-900/70 rounded p-2 border border-slate-800 text-[10px] space-y-1">
                        <div className="text-slate-400 font-semibold uppercase text-[9px]">
                          Actual Grounded Booking Fact:
                        </div>
                        <div className="text-cyan-300">
                          {highlightText(displayReasoning.actualBookingFact, searchQuery)}
                        </div>
                      </div>
                    )}

                    {displayReasoning.policyEvaluated && (
                      <div className="text-[10px]">
                        <span className="text-slate-400">Policy Evaluated: </span>
                        <span className="text-slate-300">
                          {highlightText(displayReasoning.policyEvaluated, searchQuery)}
                        </span>
                      </div>
                    )}

                    {displayReasoning.actionAttempted && (
                      <div className="pt-1.5 border-t border-slate-700/50 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Action Attempted:</span>
                        <span className="text-slate-200 font-medium">
                          {highlightText(displayReasoning.actionAttempted, searchQuery)}
                        </span>
                      </div>
                    )}

                    {displayReasoning.actionResult && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Action Result:</span>
                        <span className={`font-medium ${
                          displayReasoning.actionResult.toLowerCase().includes('denied') || displayReasoning.actionResult.toLowerCase().includes('escalat')
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}>
                          {highlightText(displayReasoning.actionResult, searchQuery)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Rule Applied Badge */}
                {ruleSectionMatches && (
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Rule Applied</span>
                      <span className="font-mono text-[9px] text-slate-400">
                        {highlightText(displayReasoning.turnId, searchQuery)}
                      </span>
                    </div>
                    <div className="text-emerald-400 font-medium text-sm flex items-start gap-1.5">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{highlightText(displayReasoning.ruleApplied, searchQuery)}</span>
                    </div>
                    <div className="mt-1.5 inline-block font-mono text-[10px] bg-slate-900/90 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      Code: {highlightText(displayReasoning.ruleCode, searchQuery)}
                    </div>
                  </div>
                )}

                {/* Grounding Scoped Check */}
                {groundingMatches && (
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-cyan-400" />
                      <span>Strict Grounding Scope</span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Customer:</span>
                        <span className="text-slate-200 font-medium">
                          {highlightText(displayReasoning.customerScoped.name, searchQuery)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">PNR:</span>
                        <span className="text-slate-200 font-mono">
                          {highlightText(displayReasoning.customerScoped.pnr, searchQuery)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tier:</span>
                        <span className="text-amber-400 font-medium">
                          {highlightText(displayReasoning.customerScoped.tier, searchQuery)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Flight:</span>
                        <span className="text-slate-200">
                          {highlightText(displayReasoning.customerScoped.flight, searchQuery)}
                        </span>
                      </div>
                      <div className="pt-1 text-slate-400 border-t border-slate-700/50 text-[10px]">
                        Status: {highlightText(displayReasoning.customerScoped.statusSummary, searchQuery)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Why This Action Was Taken */}
                {explanationMatches && (
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Info className="w-3 h-3 text-blue-400" />
                      <span>Audit Explanation & Policy Justification</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      {highlightText(displayReasoning.explanation, searchQuery)}
                    </p>
                  </div>
                )}

                {/* Escalation Status */}
                {escalationMatches && (
                  <div
                    className={`rounded-lg p-3 border ${
                      displayReasoning.escalation.isEscalated
                        ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                        : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs flex items-center gap-1">
                        {displayReasoning.escalation.isEscalated ? (
                          <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        Escalation State
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          displayReasoning.escalation.isEscalated
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-600'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-600'
                        }`}
                      >
                        {displayReasoning.escalation.isEscalated ? 'ESCALATED' : 'IN-POLICY (AUTONOMOUS)'}
                      </span>
                    </div>
                    {displayReasoning.escalation.isEscalated && (
                      <div className="mt-2 text-[11px] text-rose-200 space-y-1">
                        <div>
                          <span className="text-rose-400 font-medium">Trigger Reason:</span>{' '}
                          {highlightText(displayReasoning.escalation.reason || '', searchQuery)}
                        </div>
                        {displayReasoning.escalation.assignedQueue && (
                          <div className="text-[10px] text-slate-400">
                            Assigned Queue: {highlightText(displayReasoning.escalation.assignedQueue, searchQuery)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Allowed Actions Exercised */}
                {filteredAllowedActions && filteredAllowedActions.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Allowed Actions Exercised ({filteredAllowedActions.length})
                    </div>
                    <ul className="space-y-1.5">
                      {filteredAllowedActions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{highlightText(action, searchQuery)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prohibited Actions Evaluation */}
                {filteredProhibitedActions && filteredProhibitedActions.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Prohibited Actions Evaluated ({filteredProhibitedActions.length})
                    </div>
                    <div className="space-y-2">
                      {filteredProhibitedActions.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded border text-[10px] ${
                            item.triggered
                              ? 'bg-rose-900/30 border-rose-700 text-rose-200'
                              : 'bg-slate-900/50 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[11px] text-slate-300">
                              {highlightText(item.action, searchQuery)}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                item.triggered
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.triggered ? 'TRIGGERED' : 'CLEARED'}
                            </span>
                          </div>
                          {item.reason && (
                            <p className="mt-1 text-rose-300 text-[10px] italic">
                              {highlightText(item.reason, searchQuery)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SESSION HISTORY (CHRONOLOGICAL SUMMARY OF ALL REASONING LOGS)      */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {/* Session Stats Bar */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-slate-200">
                  {sessionLogs.length} {sessionLogs.length === 1 ? 'Turn' : 'Turns'} Logged
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-medium">
                  {sessionLogs.filter((l) => !l.reasoning.escalation.isEscalated).length} In-Policy
                </span>
                <span className="bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded font-medium">
                  {sessionLogs.filter((l) => l.reasoning.escalation.isEscalated).length} Escalated
                </span>
              </div>
            </div>

            {sessionLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-lg">
                <History className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="font-medium text-slate-300">No session turns yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  As you chat with the customer, each agent reasoning turn will be saved here in chronological order so you can audit policy adherence over time.
                </p>
              </div>
            ) : filteredHistoryLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-slate-800 rounded-lg bg-slate-900/40">
                <Search className="w-7 h-7 mx-auto mb-2 text-slate-500" />
                <p className="font-medium text-slate-300">No matching turns found</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  No turns match "{searchQuery}". Try a different keyword like "refund", "hotel", or "delay".
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-[11px] bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1 rounded font-medium transition-colors"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistoryLogs.map((log) => {
                  const r = log.reasoning;
                  const isExpanded = !!expandedTurnIds[r.turnId];
                  const triggeredProhibited = r.prohibitedActionsEvaluated.filter((p) => p.triggered);

                  return (
                    <div
                      key={r.turnId}
                      id={`session-log-turn-${log.turnNumber}`}
                      className="bg-slate-800/70 border border-slate-700/80 hover:border-slate-600 rounded-xl p-3 transition-all space-y-2.5 shadow-xs"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs bg-slate-900 text-slate-200 px-2 py-0.5 rounded border border-slate-700 font-mono">
                            Turn #{log.turnNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {highlightText(log.timestamp, searchQuery)}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            r.escalation.isEscalated
                              ? 'bg-rose-500/20 text-rose-300 border-rose-700'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-700'
                          }`}
                        >
                          {r.escalation.isEscalated ? 'ESCALATED' : 'IN-POLICY'}
                        </span>
                      </div>

                      {/* User Request Snippet */}
                      <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-blue-400" />
                            <span>Customer Query</span>
                          </span>
                          {r.requestType && (
                            <span className="text-[9px] text-slate-400 font-normal">
                              {r.requestType}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200 italic line-clamp-2" title={log.userPrompt}>
                          "{highlightText(log.userPrompt, searchQuery)}"
                        </p>
                        {r.currentIntent && (
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            Intent: <strong className="text-slate-200">{highlightText(r.currentIntent, searchQuery)}</strong>
                          </div>
                        )}
                      </div>

                      {/* Applied Rule & Code */}
                      <div>
                        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Rule Applied
                        </div>
                        <div className="text-emerald-400 font-medium text-xs flex items-start gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{highlightText(r.ruleApplied, searchQuery)}</span>
                        </div>
                        <div className="mt-1 font-mono text-[9px] text-slate-400">
                          Code: {highlightText(r.ruleCode, searchQuery)}
                        </div>
                      </div>

                      {/* Brief Explanation */}
                      <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-800/40 p-2 rounded border border-slate-700/50">
                        {highlightText(r.explanation, searchQuery)}
                      </div>

                      {/* Checks Summary Line */}
                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 pt-1 border-t border-slate-700/50">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          {r.allowedActionsExercised.length} actions allowed
                        </span>
                        <span>•</span>
                        {triggeredProhibited.length > 0 ? (
                          <span className="flex items-center gap-1 text-rose-400 font-semibold">
                            <AlertOctagon className="w-3 h-3" />
                            {triggeredProhibited.length} prohibited triggered
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            All {r.prohibitedActionsEvaluated.length} checks cleared
                          </span>
                        )}
                      </div>

                      {/* Inline Expanded Audit Breakdown */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-700 space-y-2 text-[10px]">
                          {/* Grounding Info */}
                          <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1">
                            <span className="font-semibold text-slate-400 uppercase text-[9px]">
                              Grounding Scoped Record:
                            </span>
                            <div className="text-slate-300">
                              {r.customerScoped.name} ({r.customerScoped.tier} Tier) • PNR: {r.customerScoped.pnr}
                            </div>
                            <div className="text-slate-400">{r.customerScoped.statusSummary}</div>
                          </div>

                          {/* Allowed Actions */}
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-400 uppercase text-[9px]">
                              Allowed Actions Exercised:
                            </span>
                            {r.allowedActionsExercised.map((act, i) => (
                              <div key={i} className="text-slate-300 flex items-start gap-1">
                                <span className="text-emerald-400">✓</span>
                                <span>{highlightText(act, searchQuery)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Prohibited Checks */}
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-400 uppercase text-[9px]">
                              Prohibited Actions Checked:
                            </span>
                            {r.prohibitedActionsEvaluated.map((p, i) => (
                              <div
                                key={i}
                                className={`p-1.5 rounded text-[10px] ${
                                  p.triggered
                                    ? 'bg-rose-950/60 text-rose-200 border border-rose-800'
                                    : 'bg-slate-900/40 text-slate-400'
                                }`}
                              >
                                <div className="flex justify-between font-medium">
                                  <span>{highlightText(p.action, searchQuery)}</span>
                                  <span className={p.triggered ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                                    {p.triggered ? 'TRIGGERED' : 'CLEARED'}
                                  </span>
                                </div>
                                {p.reason && (
                                  <p className="mt-0.5 text-rose-300 text-[9px] italic">
                                    {highlightText(p.reason, searchQuery)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>

                          {r.escalation.isEscalated && (
                            <div className="bg-rose-950/40 border border-rose-800 rounded p-2 text-rose-200">
                              <span className="font-semibold text-[9px] uppercase text-rose-400">
                                Escalation Detail:
                              </span>
                              <p className="mt-0.5">{highlightText(r.escalation.reason || '', searchQuery)}</p>
                              {r.escalation.assignedQueue && (
                                <p className="text-slate-400 text-[9px] mt-0.5">
                                  Queue: {r.escalation.assignedQueue}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                        <button
                          onClick={() => toggleTurnExpanded(r.turnId)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 py-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              <span>Collapse</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              <span>Expand Details</span>
                            </>
                          )}
                        </button>

                        <button
                          id={`inspect-turn-${log.turnNumber}-btn`}
                          onClick={() => handleInspectTurnInDetailedView(r.turnId)}
                          className="text-[10px] bg-slate-700 hover:bg-blue-600 text-slate-200 hover:text-white font-medium px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Inspect Full Audit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[10px] text-slate-500 flex items-center justify-between">
        <span>Reviewer Audit Engine</span>
        <span className="font-mono text-[9px]">
          {activeTab === 'history' ? `${sessionLogs.length} turns in session` : 'Live Grounded View'}
        </span>
      </div>
    </aside>
  );
};
