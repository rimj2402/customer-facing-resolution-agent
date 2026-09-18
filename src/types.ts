export type LoyaltyTier = 'Gold' | 'Silver' | 'Platinum';

export type FlightStatus = 
  | { type: 'CANCELLED'; reason: string }
  | { type: 'DELAYED'; delayHours: number; originalDeparture: string; newDeparture: string };

export interface FlightLeg {
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string; // e.g., 'Wed 23 Sep 2026'
  departureTime: string; // e.g., '18:40'
  status: FlightStatus;
  isReturnLeg?: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  loyaltyTier: LoyaltyTier;
  pnr: string;
  contact: {
    email: string;
    phone: string;
  };
  travelHistory12m: {
    flightCount: number;
    priorComplaints: string; // e.g. "1 prior complaint (delayed baggage, resolved with a voucher)"
  };
  booking: {
    activeFlight: FlightLeg;
    returnFlight?: FlightLeg;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'agent' | 'system';
  text: string;
  timestamp: string;
  reasoning?: AgentReasoning;
  isEscalationNotice?: boolean;
}

export interface AgentReasoning {
  turnId: string;
  ruleApplied: string;
  ruleCode: 'CANCELLATION_REBOOKING' | 'DELAY_TIER_UNDER_3H' | 'DELAY_TIER_3H_TO_5H' | 'DELAY_TIER_OVER_5H' | 'REFUND_PROCESSING' | 'FARE_DIFFERENCE' | 'LOYALTY_PRIORITY' | 'ESCALATION';
  explanation: string;
  currentIntent?: string;
  requestType?: 'Actual Booking Query' | 'Hypothetical / Policy Inquiry';
  actualBookingFact?: string;
  hypotheticalDelayHours?: number;
  policyEvaluated?: string;
  actionAttempted?: string;
  actionResult?: string;
  bookingDataChanged?: boolean;
  hasActivePreviousEscalation?: boolean;
  previousEscalationReason?: string;
  customerScoped: {
    name: string;
    pnr: string;
    tier: LoyaltyTier;
    flight: string;
    statusSummary: string;
  };
  allowedActionsExercised: string[];
  prohibitedActionsEvaluated: {
    action: string;
    triggered: boolean;
    reason?: string;
  }[];
  escalation: {
    isEscalated: boolean;
    reason?: string;
    assignedQueue?: string;
  };
}

export interface ScriptedTurn {
  step: number;
  userPrompt: string;
  description: string;
  expectedOutcome: {
    ruleApplied: string;
    shouldEscalate: boolean;
    keyEntitlements: string[];
    deniedOrEscalatedRequests?: string[];
  };
}

export interface ScriptedScenario {
  id: string;
  title: string;
  customerId: string;
  customerName: string;
  shortDescription: string;
  turns: ScriptedTurn[];
}

export interface TestResultItem {
  scenarioId: string;
  scenarioTitle: string;
  turnStep: number;
  userPrompt: string;
  ruleChecked: string;
  expectedEscalation: boolean;
  actualEscalation: boolean;
  correctThresholdApplied: boolean;
  noFabricatedEntitlements: boolean;
  passed: boolean;
  notes: string;
}

export interface SessionReasoningLog {
  turnNumber: number;
  userPrompt: string;
  agentReplySnippet?: string;
  timestamp: string;
  reasoning: AgentReasoning;
}
