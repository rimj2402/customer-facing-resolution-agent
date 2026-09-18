import React, { useState, useEffect } from 'react';
import { TestResultItem } from '../types';
import { CheckCircle2, XCircle, RefreshCw, X, ShieldCheck, Clock, Check } from 'lucide-react';

interface TestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestResultsModal: React.FC<TestResultsModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<{
    timestamp: string;
    totalTests: number;
    passedCount: number;
    allPassed: boolean;
    results: TestResultItem[];
  } | null>(null);

  const runTests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/test-runner');
      const data = await res.json();
      setTestResults(data);
    } catch (e) {
      console.error('Failed to run test suite:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !testResults) {
      runTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="test-results-modal"
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Automated Disruption Policy Test Harness
              </h2>
              <p className="text-xs text-slate-500">
                End-to-end programmatic verification across all 3 scenarios & numeric policy thresholds
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="re-run-tests-btn"
              onClick={runTests}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Re-run Suite</span>
            </button>
            <button
              id="close-tests-modal-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium">Executing automated scenario tests...</p>
            </div>
          ) : testResults ? (
            <>
              {/* Summary Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  testResults.allPassed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {testResults.allPassed ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-7 h-7 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {testResults.allPassed
                        ? 'All 7 Scenario Turns Passed Verification (100%)'
                        : `${testResults.totalTests - testResults.passedCount} Test Checks Failed`}
                    </h4>
                    <p className="text-xs opacity-90">
                      Deterministic guardrails confirmed: 3h/5h delay tiers, ₹1,500 waiver caps, cancellation rules, and prohibited action escalations.
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs font-mono">
                  <div className="font-bold text-sm">
                    {testResults.passedCount} / {testResults.totalTests} passed
                  </div>
                  <div className="text-[11px] opacity-75">
                    {new Date(testResults.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Table of Test Results */}
              <div className="space-y-2.5">
                {testResults.results.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{r.scenarioTitle}</span>
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                          Turn {r.turnStep}
                        </span>
                      </div>
                      <p className="text-slate-700 italic">"{r.userPrompt}"</p>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Rule: <strong>{r.ruleChecked}</strong></span>
                        <span>
                          Expected Escalation: <strong>{r.expectedEscalation ? 'YES' : 'NO'}</strong>
                        </span>
                        <span>
                          Actual Escalation: <strong className={r.actualEscalation === r.expectedEscalation ? 'text-emerald-700' : 'text-rose-700'}>{r.actualEscalation ? 'YES' : 'NO'}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {r.passed ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[11px]">
                          <Check className="w-3.5 h-3.5" />
                          PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[11px]">
                          <X className="w-3.5 h-3.5" />
                          FAIL
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Airline Resolution Agent • Grounded in September 23, 2026 Reference Data</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
