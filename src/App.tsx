import React, { useState, useEffect, useRef } from 'react';
import { CUSTOMERS, SCRIPTED_SCENARIOS, REFERENCE_DATE } from './data/sourceData';
import { CustomerProfile, ChatMessage, AgentReasoning, ScriptedScenario, SessionReasoningLog } from './types';
import { CustomerSummaryCard } from './components/CustomerSummaryCard';
import { AgentReasoningPanel } from './components/AgentReasoningPanel';
import { EscalationBanner } from './components/EscalationBanner';
import { ScenarioReplayBar } from './components/ScenarioReplayBar';
import { ChatMessageBubble } from './components/ChatMessageBubble';
import { TestResultsModal } from './components/TestResultsModal';
import {
  Send,
  RotateCcw,
  ShieldCheck,
  Plane,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface CustomerSessionState {
  messages: ChatMessage[];
  isEscalated: boolean;
  escalationReason?: string;
  hasPreviousEscalation: boolean;
  previousEscalationReason?: string;
  lastReasoning: AgentReasoning | null;
  sessionLogs: SessionReasoningLog[];
  activeTurnIndex: number;
}

function createInitialSessionForCustomer(cust: CustomerProfile): CustomerSessionState {
  const flight = cust.booking.activeFlight;
  const initialStatusStr =
    flight.status.type === 'CANCELLED'
      ? `cancelled due to ${flight.status.reason}`
      : `delayed by ${flight.status.delayHours} hours (rescheduled from ${flight.status.originalDeparture} to ${flight.status.newDeparture})`;

  const welcomeMsg: ChatMessage = {
    id: `init-${cust.id}-${Date.now()}`,
    sender: 'agent',
    text: `Hello ${cust.name}, welcome to SkyResolve support.

I have your booking reference (${cust.pnr}) on file. I see that your flight ${flight.flightNumber} from ${flight.origin} to ${flight.destination} on ${flight.departureDate} has been ${initialStatusStr}.

I am here to assist you immediately with your entitlements and resolution options. How would you like to proceed?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  return {
    messages: [welcomeMsg],
    isEscalated: false,
    escalationReason: undefined,
    hasPreviousEscalation: false,
    previousEscalationReason: undefined,
    lastReasoning: null,
    sessionLogs: [],
    activeTurnIndex: 0,
  };
}

export default function App() {
  // 1. Customer Selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(CUSTOMERS[0].id);
  const currentCustomer = CUSTOMERS.find((c) => c.id === selectedCustomerId) || CUSTOMERS[0];

  // 2. Air-tight Per-Customer Session State Map
  // Prevents any message, escalation, ticket, or audit leak when switching between Priya, Arvind, and Meher
  const [customerSessions, setCustomerSessions] = useState<Record<string, CustomerSessionState>>(() => {
    const initialMap: Record<string, CustomerSessionState> = {};
    for (const cust of CUSTOMERS) {
      initialMap[cust.id] = createInitialSessionForCustomer(cust);
    }
    return initialMap;
  });

  const activeSession: CustomerSessionState =
    customerSessions[selectedCustomerId] || createInitialSessionForCustomer(currentCustomer);

  // 3. UI and Network State
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReasoningPanelOpen, setIsReasoningPanelOpen] = useState(true);

  // 4. Scenario Replay State
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SCRIPTED_SCENARIOS[0].id);

  // 5. Test Suite Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Sync scenario selector when customer changes (without wiping session state)
  useEffect(() => {
    const matchingScenario = SCRIPTED_SCENARIOS.find((s) => s.customerId === currentCustomer.id);
    if (matchingScenario) {
      setSelectedScenarioId(matchingScenario.id);
    }
  }, [selectedCustomerId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeSession.messages, isLoading]);

  // Reset chat operation: strictly resets ONLY the current customer's conversation
  const resetChatForCustomer = (cust: CustomerProfile) => {
    setErrorMessage(null);
    setCustomerSessions((prev) => ({
      ...prev,
      [cust.id]: createInitialSessionForCustomer(cust),
    }));
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    setErrorMessage(null);

    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'customer',
      text,
      timestamp: userTimestamp,
    };

    const updatedMessages = [...activeSession.messages, userMsg];

    // Optimistically update current customer's messages
    setCustomerSessions((prev) => ({
      ...prev,
      [currentCustomer.id]: {
        ...activeSession,
        messages: updatedMessages,
      },
    }));

    setIsLoading(true);

    try {
      // Build conversation history for API
      const history = updatedMessages
        .filter((m) => m.sender !== 'system')
        .map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          message: text,
          history: history.slice(0, -1), // Send past turns excluding latest prompt
          isEscalated: activeSession.isEscalated,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      const agentTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.reply,
        timestamp: agentTimestamp,
        reasoning: data.reasoning,
      };

      const finalMessages = [...updatedMessages, agentMsg];
      const newLogs = data.reasoning
        ? [
            ...activeSession.sessionLogs,
            {
              turnNumber: activeSession.sessionLogs.length + 1,
              userPrompt: text,
              agentReplySnippet: data.reply || '',
              timestamp: agentTimestamp,
              reasoning: data.reasoning,
            },
          ]
        : activeSession.sessionLogs;

      const currentTurnEscalated = Boolean(data.isEscalated);
      const updatedHasPreviousEscalation =
        currentTurnEscalated || activeSession.hasPreviousEscalation;
      const updatedPreviousReason = currentTurnEscalated
        ? data.reasoning?.escalation?.reason
        : activeSession.previousEscalationReason || activeSession.escalationReason;

      setCustomerSessions((prev) => ({
        ...prev,
        [currentCustomer.id]: {
          messages: finalMessages,
          isEscalated: currentTurnEscalated,
          escalationReason: currentTurnEscalated
            ? data.reasoning?.escalation?.reason
            : undefined,
          hasPreviousEscalation: updatedHasPreviousEscalation,
          previousEscalationReason: updatedPreviousReason,
          lastReasoning: data.reasoning,
          sessionLogs: newLogs,
          activeTurnIndex: activeSession.activeTurnIndex + 1,
        },
      }));
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMessage('Unable to connect to resolution engine. Please click retry or use manual input.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectScenario = (scenarioId: string) => {
    const scen = SCRIPTED_SCENARIOS.find((s) => s.id === scenarioId);
    if (scen) {
      setSelectedScenarioId(scenarioId);
      if (scen.customerId !== selectedCustomerId) {
        setSelectedCustomerId(scen.customerId);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  Airline Disruption Resolution Agent
                </h1>
                <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  Prototype
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Grounded Customer-Facing Agent • Deterministic Guardrail Layer • Reference Date: {REFERENCE_DATE}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Customer Selector Dropdown */}
            <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-500 mr-2 font-medium">Customer:</span>
              <select
                id="customer-selector-dropdown"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-hidden cursor-pointer"
              >
                {CUSTOMERS.map((cust) => (
                  <option key={cust.id} value={cust.id}>
                    {cust.name} ({cust.loyaltyTier} • {cust.booking.activeFlight.flightNumber} • {cust.booking.activeFlight.status.type === 'CANCELLED' ? 'Cancelled' : `Delayed ${cust.booking.activeFlight.status.delayHours}h`})
                  </option>
                ))}
              </select>
            </div>

            {/* Run Automated Test Suite */}
            <button
              id="open-test-modal-btn"
              onClick={() => setIsTestModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors shadow-2xs"
              title="Audit and verify all 3 test scenarios"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Audit Test Suite</span>
            </button>

            {/* Reset Chat Button */}
            <button
              id="reset-chat-btn"
              onClick={() => resetChatForCustomer(currentCustomer)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Reset conversation for this customer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-row overflow-hidden p-3 md:p-4 gap-4">
        {/* Left / Center Chat Column */}
        <div className="flex-1 flex flex-col space-y-3 min-w-0">
          {/* Grounding Customer Summary Card */}
          <CustomerSummaryCard customer={currentCustomer} referenceDate={REFERENCE_DATE} />

          {/* Scenario Quick Replayer */}
          <ScenarioReplayBar
            scenarios={SCRIPTED_SCENARIOS}
            selectedScenarioId={selectedScenarioId}
            activeTurnIndex={activeSession.activeTurnIndex}
            onSelectScenario={handleSelectScenario}
            onSendStepPrompt={(prompt) => handleSendMessage(prompt)}
            isLoading={isLoading}
          />

          {/* Main Chat Container */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden min-h-[420px]">
            {/* Chat Header Bar */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold text-slate-800">SkyResolve Resolution Chat</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500 font-mono text-[11px]">PNR: {currentCustomer.pnr}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Session Active • Policy Engine: Gemini + Deterministic Code Guardrails
              </div>
            </div>

            {/* Chat Scroll Area */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
              {/* Escalation Persistent Banner (shows when escalation happens or is active) */}
              {(activeSession.isEscalated || activeSession.hasPreviousEscalation) && (
                <EscalationBanner
                  customer={currentCustomer}
                  escalationReason={activeSession.escalationReason || activeSession.previousEscalationReason}
                  isCurrentTurnEscalated={activeSession.isEscalated}
                  hasPreviousEscalation={activeSession.hasPreviousEscalation}
                  onResetConversation={() => resetChatForCustomer(currentCustomer)}
                />
              )}

              {/* Message History */}
              {activeSession.messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 my-2 italic">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-.15s]"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                  <span>Evaluating policy guardrails & generating response...</span>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center justify-between my-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    onClick={() => handleSendMessage()}
                    className="underline text-rose-900 font-semibold text-xs ml-2"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Quick prompts:</span>
              <button
                disabled={isLoading}
                onClick={() => handleSendMessage('What are my rights and entitlements for this disruption?')}
                className="bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-full text-[11px] text-slate-700 transition-colors"
              >
                What are my rights?
              </button>
              {currentCustomer.booking.activeFlight.status.type === 'CANCELLED' ? (
                <>
                  <button
                    disabled={isLoading}
                    onClick={() => handleSendMessage('Can you process a full refund to my original payment method?')}
                    className="bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-full text-[11px] text-slate-700 transition-colors"
                  >
                    Full refund request
                  </button>
                  <button
                    disabled={isLoading}
                    onClick={() => handleSendMessage('What is the next available flight within 24 hours?')}
                    className="bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-full text-[11px] text-slate-700 transition-colors"
                  >
                    Rebook on next flight
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={isLoading}
                    onClick={() => handleSendMessage('Can I get a meal voucher and lounge access while I wait?')}
                    className="bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-full text-[11px] text-slate-700 transition-colors"
                  >
                    Meal voucher & lounge
                  </button>
                  <button
                    disabled={isLoading}
                    onClick={() => handleSendMessage('Can you provide hotel accommodation for this delay?')}
                    className="bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-full text-[11px] text-slate-700 transition-colors"
                  >
                    Hotel accommodation request
                  </button>
                </>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  id="chat-input-field"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    activeSession.isEscalated
                      ? 'Ticket escalated to human specialist. Type any in-policy inquiry...'
                      : `Message as ${currentCustomer.name} (e.g. ask for refund, hotel, or flight change)...`
                  }
                  disabled={isLoading}
                  className="flex-1 text-xs md:text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
                <button
                  id="chat-send-btn"
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Collapsible Reviewer Policy Audit Panel */}
        <AgentReasoningPanel
          reasoning={activeSession.lastReasoning}
          sessionLogs={activeSession.sessionLogs}
          isOpen={isReasoningPanelOpen}
          onToggle={() => setIsReasoningPanelOpen(!isReasoningPanelOpen)}
        />
      </div>

      {/* Automated Policy Test Modal */}
      <TestResultsModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </div>
  );
}
