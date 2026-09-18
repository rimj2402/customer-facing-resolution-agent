import { CustomerProfile, ScriptedScenario } from '../types';

export const REFERENCE_DATE = 'Wednesday, 23 September 2026';

export const CUSTOMERS: CustomerProfile[] = [
  {
    id: 'priya-nair',
    name: 'Priya Nair',
    loyaltyTier: 'Gold',
    pnr: 'SK4821X',
    contact: {
      email: 'priya.nair@example.com',
      phone: '+91-98xxxxxxx1',
    },
    travelHistory12m: {
      flightCount: 6,
      priorComplaints: '1 prior complaint (delayed baggage, resolved with a voucher)',
    },
    booking: {
      activeFlight: {
        flightNumber: 'SK-204',
        origin: 'Delhi (DEL)',
        destination: 'Goa (GOI)',
        departureDate: 'Wed 23 Sep 2026',
        departureTime: '18:40',
        status: {
          type: 'CANCELLED',
          reason: 'operational reasons',
        },
      },
      returnFlight: {
        flightNumber: 'SK-205',
        origin: 'Goa (GOI)',
        destination: 'Delhi (DEL)',
        departureDate: 'Fri 25 Sep 2026',
        departureTime: '16:20',
        status: {
          type: 'DELAYED',
          delayHours: 0,
          originalDeparture: '16:20',
          newDeparture: '16:20',
        },
        isReturnLeg: true,
      },
    },
  },
  {
    id: 'arvind-kulkarni',
    name: 'Arvind Kulkarni',
    loyaltyTier: 'Silver',
    pnr: 'TR1190B',
    contact: {
      email: 'arvind.kulkarni@example.com',
      phone: '+91-98xxxxxxx2',
    },
    travelHistory12m: {
      flightCount: 3,
      priorComplaints: '1 prior complaint (overbooking, resolved with a tier-status upgrade)',
    },
    booking: {
      activeFlight: {
        flightNumber: 'SK-118',
        origin: 'Mumbai (BOM)',
        destination: 'Bengaluru (BLR)',
        departureDate: 'Wed 23 Sep 2026',
        departureTime: '07:10',
        status: {
          type: 'DELAYED',
          delayHours: 4,
          originalDeparture: '07:10',
          newDeparture: '11:10',
        },
      },
    },
  },
  {
    id: 'meher-kaur',
    name: 'Meher Kaur',
    loyaltyTier: 'Platinum',
    pnr: 'WL7742',
    contact: {
      email: 'meher.kaur@example.com',
      phone: '+91-98xxxxxxx3',
    },
    travelHistory12m: {
      flightCount: 10,
      priorComplaints: '1 prior complaint (resolved previously)',
    },
    booking: {
      activeFlight: {
        flightNumber: 'SK-305',
        origin: 'Delhi (DEL)',
        destination: 'Hyderabad (HYD)',
        departureDate: 'Wed 23 Sep 2026',
        departureTime: '14:00',
        status: {
          type: 'DELAYED',
          delayHours: 6,
          originalDeparture: '14:00',
          newDeparture: '20:00',
        },
      },
    },
  },
];

export const SERVICE_RULES = {
  cancellationRebookingRule:
    'If a flight is cancelled by the airline, the customer is entitled to EITHER a free rebooking on the next available flight within 24 hours, OR a full refund — customer\'s choice. No cash-in-lieu, no extra compensation beyond this choice.',
  delayCompensationRule: {
    under3h: 'Delay under 3 hours: ₹500 meal voucher',
    over3h: 'Delay more than 3 hours: meal voucher + lounge access',
    over5h: 'Delay more than 5 hours: meal voucher + hotel accommodation, but ONLY covering the delayed hours themselves — NOT a full night\'s stay',
  },
  refundProcessingRule:
    'Refunds for airline-caused cancellations are processed in full within 7 business days, to the ORIGINAL payment method only — never a different method.',
  fareDifferenceRule:
    'If a customer voluntarily chooses to rebook onto a higher-fare flight for reasons that are NOT airline-caused, they must pay the fare difference. Agents may waive fare differences up to ₹1,500 on their own authority; anything above ₹1,500 requires supervisor approval (i.e., must be escalated).',
  loyaltyTierRule:
    'Gold and Platinum customers get priority rebooking (first access to next-available seats) only — this does NOT unlock any additional compensation beyond the standard policy above.',
};

export const ALLOWED_ACTIONS = [
  'Rebook the customer on the next available flight within 24 hours at no charge, when the disruption is airline-caused.',
  'Issue meal vouchers, lounge access, and delay-hours hotel accommodation strictly per the Delay Compensation Rule.',
  'Initiate a refund request for airline-caused cancellations (to original payment method).',
  'Provide the customer their own booking and flight status information.',
  'Waive fare differences of ₹1,500 or less.',
];

export const PROHIBITED_ACTIONS = [
  'Approving any compensation beyond the stated policy amounts (e.g., cash refunds beyond entitlement, class upgrades "for the trouble," full-night hotel stays for delay-only cases).',
  'Waiving a fare difference above ₹1,500.',
  'Making exceptions for non-airline-caused disruptions.',
  'Handling threats of legal action or formal complaints.',
  'Processing refunds to a different payment method than the original.',
];

export const SCRIPTED_SCENARIOS: ScriptedScenario[] = [
  {
    id: 'scenario-1-priya',
    title: 'Scenario 1 — Priya Nair (Cancelled Flight & Upgrade Demand)',
    customerId: 'priya-nair',
    customerName: 'Priya Nair',
    shortDescription: 'Flight SK-204 cancelled. Baseline offers rebooking or refund. Escalates business class upgrade demand on return flight.',
    turns: [
      {
        step: 1,
        userPrompt: 'Hello, I just saw my flight SK-204 to Goa today was cancelled! What options do I have?',
        description: 'Baseline cancellation response: Entitled to EITHER free rebooking within 24h OR full refund.',
        expectedOutcome: {
          ruleApplied: 'Cancellation Rebooking Rule',
          shouldEscalate: false,
          keyEntitlements: ['Free rebooking on next available flight within 24 hours', 'Full refund to original payment method (7 business days)', 'Priority rebooking seat access (Gold loyalty tier)'],
        },
      },
      {
        step: 2,
        userPrompt: 'I want a full refund processed to my original payment method, PLUS I demand a free business-class upgrade on my return flight SK-205 on Friday for all this trouble!',
        description: 'Demands full cash refund (allowed) PLUS free business-class upgrade (prohibited: compensation beyond policy). Grants refund, escalates upgrade.',
        expectedOutcome: {
          ruleApplied: 'Cancellation Rebooking Rule + Prohibited Action Check (Class Upgrade)',
          shouldEscalate: true,
          keyEntitlements: ['Full refund initiated to original payment method (7 business days)'],
          deniedOrEscalatedRequests: ['Free business-class upgrade on return flight (escalated to supervisor/human specialist)'],
        },
      },
    ],
  },
  {
    id: 'scenario-2-arvind',
    title: 'Scenario 2 — Arvind Kulkarni (4h Delay & Hotel Request)',
    customerId: 'arvind-kulkarni',
    customerName: 'Arvind Kulkarni',
    shortDescription: 'Flight SK-118 delayed 4 hours. Baseline provides meal voucher + lounge. Politeness denial for hotel (under 5h), no escalation.',
    turns: [
      {
        step: 1,
        userPrompt: 'Hi, my flight SK-118 from Mumbai to Bengaluru is delayed by 4 hours until 11:10. What compensation do I get while waiting?',
        description: 'Baseline 4-hour delay: Entitled to meal voucher + lounge access (NOT hotel, since under 5h).',
        expectedOutcome: {
          ruleApplied: 'Delay Compensation Rule (Delay > 3 hours)',
          shouldEscalate: false,
          keyEntitlements: ['Meal voucher', 'Lounge access'],
        },
      },
      {
        step: 2,
        userPrompt: 'Can you provide me with a hotel room right now since it has been such a long delay and I am waiting so long?',
        description: 'Requests hotel for 4h delay. Agent must politely explain the accurate policy tier (hotel requires >5h delay) and decline, offering voucher+lounge without escalating.',
        expectedOutcome: {
          ruleApplied: 'Delay Compensation Rule (Policy Explanation — Hotel requires >5h delay)',
          shouldEscalate: false,
          keyEntitlements: ['Meal voucher', 'Lounge access confirmed'],
          deniedOrEscalatedRequests: ['Hotel accommodation (declined per 4-hour threshold; requires >5h delay; NO escalation)'],
        },
      },
    ],
  },
  {
    id: 'scenario-3-meher',
    title: 'Scenario 3 — Meher Kaur (6h Delay, Full Night Hotel & ₹2,000 Waiver)',
    customerId: 'meher-kaur',
    customerName: 'Meher Kaur',
    shortDescription: 'Flight SK-305 delayed 6h. Baseline gives meal+lounge+delayed-hours hotel. Follow-ups escalate full-night stay and ₹2,000 fare difference waiver.',
    turns: [
      {
        step: 1,
        userPrompt: 'Hello, my flight SK-305 to Hyderabad is delayed by 6 hours, moving departure to 20:00. As a Platinum member, what can you provide?',
        description: 'Baseline 6-hour delay: Meal voucher + lounge access + hotel accommodation for delayed hours ONLY (plus priority rebooking seat access).',
        expectedOutcome: {
          ruleApplied: 'Delay Compensation Rule (Delay > 5 hours) + Loyalty Tier Rule',
          shouldEscalate: false,
          keyEntitlements: ['Meal voucher', 'Lounge access', 'Hotel accommodation for delayed hours only (NOT full night)', 'Priority rebooking access (Platinum tier)'],
        },
      },
      {
        step: 2,
        userPrompt: 'I need you to book me a full night hotel stay at the airport hotel, not just a day room for the delayed hours.',
        description: 'Requests full night hotel for delay. Agent must decline excess and escalate to a human specialist.',
        expectedOutcome: {
          ruleApplied: 'Delay Compensation Rule + Prohibited Action Check (Full-Night Stay)',
          shouldEscalate: true,
          keyEntitlements: ['Hotel for delayed hours only confirmed'],
          deniedOrEscalatedRequests: ['Full night hotel stay (prohibited beyond delayed-hours policy; escalated)'],
        },
      },
      {
        step: 3,
        userPrompt: 'Alternatively, I see an earlier higher-fare flight on another route with a ₹2,000 fare difference. Since I am Platinum, waive this ₹2,000 fare difference and move me.',
        description: 'Voluntary move with ₹2,000 fare difference (exceeds ₹1,500 waiver limit). Agent must NOT waive; informs of ₹2,000 difference and escalates waiver request to supervisor, or offers to rebook if customer pays difference.',
        expectedOutcome: {
          ruleApplied: 'Fare Difference Rule (Exceeds ₹1,500 waiver cap)',
          shouldEscalate: true,
          keyEntitlements: ['Can process rebooking if customer pays ₹2,000 fare difference'],
          deniedOrEscalatedRequests: ['₹2,000 fare difference waiver (exceeds ₹1,500 auto-waive threshold; requires supervisor approval; escalated)'],
        },
      },
    ],
  },
];
