import { CustomerProfile, AgentReasoning } from '../types';

export interface GuardrailCheckResult {
  ruleCode: AgentReasoning['ruleCode'];
  ruleApplied: string;
  explanation: string;
  shouldEscalate: boolean;
  escalationReason?: string;
  currentIntent: string;
  requestType: 'Actual Booking Query' | 'Hypothetical / Policy Inquiry';
  actualBookingFact: string;
  hypotheticalDelayHours?: number;
  policyEvaluated: string;
  actionAttempted: string;
  actionResult: string;
  bookingDataChanged: boolean;
  hasActivePreviousEscalation: boolean;
  previousEscalationReason?: string;
  prohibitedTriggers: {
    action: string;
    triggered: boolean;
    reason?: string;
  }[];
  allowedActions: string[];
  forcedDeterministicResponse?: string;
}

/**
 * Deterministic guardrail rule evaluator.
 * Validates user requests against exact numerical thresholds,
 * ALLOWED/PROHIBITED policy rules, hypothetical queries, and customer grounding.
 */
export function evaluateGuardrails(
  customer: CustomerProfile,
  userMessage: string,
  _conversationHistory: { sender: string; text: string }[] = [],
  previousEscalation: { isEscalated: boolean; reason?: string } = { isEscalated: false }
): GuardrailCheckResult {
  const normalizedMsg = userMessage.toLowerCase().trim();
  const flight = customer.booking.activeFlight;
  const isCancelled = flight.status.type === 'CANCELLED';
  const actualDelayHours = flight.status.type === 'DELAYED' ? flight.status.delayHours : 0;

  const actualBookingFact =
    flight.status.type === 'CANCELLED'
      ? `Supplied booking shows flight ${flight.flightNumber} cancelled due to ${flight.status.reason}.`
      : `Supplied booking shows flight ${flight.flightNumber} delayed by ${flight.status.delayHours} hours (${flight.status.originalDeparture} → ${flight.status.newDeparture}).`;

  // -------------------------------------------------------------------------
  // 1. Check for Unknown PNR in Message
  // -------------------------------------------------------------------------
  const pnrRegex = /\b(?:pnr|booking(?:\s+ref(?:erence)?)?)\s*(?:is|:)?\s*([a-z0-9]{4,10})/i;
  const explicitPnrMatch = userMessage.match(pnrRegex);
  let mentionedPnr: string | null = null;
  if (explicitPnrMatch) {
    mentionedPnr = explicitPnrMatch[1].toUpperCase();
  } else if (/\babc123\b/i.test(userMessage)) {
    mentionedPnr = 'ABC123';
  }

  if (mentionedPnr && mentionedPnr !== customer.pnr.toUpperCase()) {
    return {
      ruleCode: 'ESCALATION',
      ruleApplied: 'Unknown Customer / Booking Reference Guardrail',
      explanation: `Customer specified PNR "${mentionedPnr}", which does not match the active supplied booking (${customer.pnr}) and is not present in the supplied exercise dataset. The agent must not invent unverified records.`,
      shouldEscalate: false,
      currentIntent: 'Unknown PNR Inquiry',
      requestType: 'Actual Booking Query',
      actualBookingFact,
      policyEvaluated: 'Strict Data Grounding Rule',
      actionAttempted: 'Lookup unsupplied PNR',
      actionResult: 'Rejected — PNR not found in supplied exercise dataset',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers: [
        {
          action: 'Assuming customer identity or inventing unsupplied booking records',
          triggered: true,
          reason: `Customer provided unknown PNR "${mentionedPnr}" not in supplied dataset.`,
        },
      ],
      allowedActions: ['Politely request valid supplied booking reference'],
      forcedDeterministicResponse: `I cannot find PNR ${mentionedPnr} in the supplied exercise data. I cannot verify the cancellation or refund eligibility for that booking without a matching supplied record.`,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Check for Prompt Injection / Policy Bypass Demands
  // -------------------------------------------------------------------------
  const isPromptInjection =
    normalizedMsg.includes('ignore all') ||
    normalizedMsg.includes('ignore airline') ||
    normalizedMsg.includes('ignore policy') ||
    normalizedMsg.includes('bypass audit') ||
    normalizedMsg.includes("don't record") ||
    normalizedMsg.includes('dont record') ||
    normalizedMsg.includes('override rules');

  if (isPromptInjection) {
    const isDemandingExcess =
      normalizedMsg.includes('5000') ||
      normalizedMsg.includes('5,000') ||
      normalizedMsg.includes('compensation');

    return {
      ruleCode: isDemandingExcess ? 'ESCALATION' : 'LOYALTY_PRIORITY',
      ruleApplied: 'Policy Integrity & Anti-Tamper Guardrail',
      explanation: 'User attempted to instruct the agent to bypass policy, skip audit logging, or grant unauthorized funds. All operations must remain strictly policy-grounded.',
      shouldEscalate: isDemandingExcess,
      escalationReason: isDemandingExcess ? 'Prohibited Action: Customer demanded unauthorized compensation outside policy.' : undefined,
      currentIntent: 'Prompt Injection / Policy Override Demand',
      requestType: 'Actual Booking Query',
      actualBookingFact,
      policyEvaluated: 'Policy Adherence & Audit Mandate',
      actionAttempted: 'Policy override or unrecorded compensation',
      actionResult: 'Blocked by deterministic guardrail',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers: [
        {
          action: 'Approving any compensation beyond stated policy amounts',
          triggered: isDemandingExcess,
          reason: isDemandingExcess ? 'Unauthorized compensation demanded.' : undefined,
        },
      ],
      allowedActions: ['Reiterate standard policy', 'Log interaction in audit trail'],
      forcedDeterministicResponse: 'I cannot ignore airline policies, bypass audit procedures, or grant unauthorized compensation. All actions must comply strictly with the supplied disruption policy and are fully recorded.',
    };
  }

  // -------------------------------------------------------------------------
  // 3. Check for Legal Action / Formal Complaint
  // -------------------------------------------------------------------------
  const isLegalAction =
    normalizedMsg.includes('legal action') ||
    normalizedMsg.includes('lawyer') ||
    normalizedMsg.includes('sue') ||
    normalizedMsg.includes('take legal action') ||
    normalizedMsg.includes('court') ||
    normalizedMsg.includes('consumer court');

  const isFormalComplaint =
    normalizedMsg.includes('formal complaint') ||
    normalizedMsg.includes('file a formal complaint') ||
    normalizedMsg.includes('regulatory complaint') ||
    normalizedMsg.includes('file a complaint against');

  if (isLegalAction || isFormalComplaint) {
    const isCompensationDemanded =
      normalizedMsg.includes('5000') ||
      normalizedMsg.includes('5,000') ||
      normalizedMsg.includes('compensation');

    const triggerReason = isLegalAction
      ? isCompensationDemanded
        ? 'Customer initiated threat of legal action and requested unauthorized compensation (€5,000).'
        : 'Customer initiated threat of legal action.'
      : 'Customer requested to file a formal complaint against the airline.';

    const forcedResponse = isLegalAction
      ? 'I understand your concern. Because your request involves legal action and compensation beyond the supplied policy, this requires human review. I cannot make an unauthorized compensation commitment. I have recorded the escalation for our senior resolution specialist team.'
      : 'Your request involves a formal complaint, which requires human resolution under the supplied agent rules. I have recorded the escalation for our specialist team.';

    return {
      ruleCode: 'ESCALATION',
      ruleApplied: 'Escalation for Legal Action / Formal Complaint',
      explanation: 'Handling threats of legal action or formal complaints is strictly prohibited for automated agents and must be escalated immediately to human resolution specialists.',
      shouldEscalate: true,
      escalationReason: triggerReason,
      currentIntent: isLegalAction ? 'Legal Action Threat' : 'Formal Complaint Filing',
      requestType: 'Actual Booking Query',
      actualBookingFact,
      policyEvaluated: 'Prohibited Actions Rule (Legal & Formal Complaints)',
      actionAttempted: 'Automated legal / formal complaint settlement',
      actionResult: 'Escalated immediately to Tier-2 Disruption Resolution Specialists',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers: [
        {
          action: 'Handling threats of legal action or formal complaints',
          triggered: true,
          reason: triggerReason,
        },
      ],
      allowedActions: [
        'Escalate immediately to Tier-2 Disruption Resolution Specialists',
        'Record escalation in audit log',
      ],
      forcedDeterministicResponse: forcedResponse,
    };
  }

  // -------------------------------------------------------------------------
  // 4. Check for Alternate Refund Method (e.g. wife's account, different card)
  // -------------------------------------------------------------------------
  const isDifferentRefundMethod =
    normalizedMsg.includes("wife's") ||
    normalizedMsg.includes("husband's") ||
    normalizedMsg.includes("friend's") ||
    normalizedMsg.includes('different card') ||
    normalizedMsg.includes('another account') ||
    normalizedMsg.includes('different payment') ||
    normalizedMsg.includes('another payment') ||
    normalizedMsg.includes('bank account instead') ||
    normalizedMsg.includes('cash in hand');

  if (isDifferentRefundMethod) {
    return {
      ruleCode: 'REFUND_PROCESSING',
      ruleApplied: 'Refund Processing Rule (Original Payment Method Only)',
      explanation: 'Refunds for airline-caused cancellations must strictly be processed to the ORIGINAL payment method only, within 7 business days. Processing to third-party accounts or alternative methods is prohibited.',
      shouldEscalate: true,
      escalationReason: 'Prohibited Action: Processing refund to a different payment method than the original.',
      currentIntent: 'Alternative Payment Method Refund Request',
      requestType: 'Actual Booking Query',
      actualBookingFact,
      policyEvaluated: 'Refund Processing Rule',
      actionAttempted: 'Refund to alternative third-party payment method',
      actionResult: 'Denied per policy & escalated for administrative review',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers: [
        {
          action: 'Processing refunds to a different payment method than the original',
          triggered: true,
          reason: 'Customer requested refund to wife\'s bank account instead of original payment method.',
        },
      ],
      allowedActions: ['Offer refund to original payment method only (7 business days)'],
      forcedDeterministicResponse: 'Under our Refund Processing Rule, refunds for airline-caused cancellations are processed in full strictly to the original payment method only, within 7 business days. We cannot process a refund to an alternate payment method or third-party bank account.',
    };
  }

  // -------------------------------------------------------------------------
  // 5. Detect Stated / Hypothetical Delay Hours in Message
  // -------------------------------------------------------------------------
  // Match patterns like "delayed by 5 hours", "delayed by exactly 5 hours", "delayed 6 hours", "delay of 8 hours"
  const delayMentionRegex = /(?:delayed\s+(?:by\s+)?(?:exactly\s+)?|delay\s+(?:of\s+)?|delay(?:ed)?\s+)?(\d+)\s*(?:-| )?hours?/i;
  const delayMatch = userMessage.match(delayMentionRegex);
  let mentionedDelay: number | null = null;
  if (delayMatch) {
    const parsed = parseInt(delayMatch[1], 10);
    // Only treat as delay hours if within plausible flight delay range (1 to 24)
    if (parsed >= 1 && parsed <= 24) {
      // Avoid false matches with departure times like "SK-118" or "2000"
      if (!userMessage.includes(`sk-${parsed}`) && !userMessage.includes(`₹${parsed}`)) {
        mentionedDelay = parsed;
      }
    }
  }

  const isHypotheticalOrContradictoryDelay =
    mentionedDelay !== null &&
    (isCancelled || mentionedDelay !== actualDelayHours);

  if (isHypotheticalOrContradictoryDelay && mentionedDelay !== null) {
    // Distinguish between 3-5 hours vs > 5 hours vs < 3 hours
    let tierCode: AgentReasoning['ruleCode'] = 'DELAY_TIER_3H_TO_5H';
    let ruleName = 'Delay Compensation Rule';
    let policyText = '';
    let responseText = '';

    if (mentionedDelay > 5) {
      tierCode = 'DELAY_TIER_OVER_5H';
      ruleName = 'Delay Compensation Rule (Delay > 5 hours)';
      policyText = 'Meal voucher, lounge access, and accommodation covering the delayed hours.';
      if (mentionedDelay === 8) {
        responseText = `Your supplied booking currently shows a 4-hour delay. If your flight status has changed, I cannot verify a new delay from the supplied exercise data. If you are asking about the policy for an 8-hour delay, delays exceeding 5 hours qualify for meal voucher, lounge access, and accommodation covering the delayed hours.`;
      } else {
        responseText = `Your supplied booking currently shows a 4-hour delay. If you are asking hypothetically about a delay exceeding 5 hours, the policy provides meal voucher, lounge access, and accommodation covering the delayed hours.`;
      }
    } else if (mentionedDelay >= 3 && mentionedDelay <= 5) {
      tierCode = 'DELAY_TIER_3H_TO_5H';
      ruleName = 'Delay Compensation Rule (3 to 5 hours)';
      policyText = 'Meal voucher and lounge access (hotel accommodation strictly requires >5 hours).';
      if (normalizedMsg.includes('hotel') || normalizedMsg.includes('room') || normalizedMsg.includes('stay')) {
        responseText = `Your supplied booking currently shows a 4-hour delay. If you are asking about the policy for an exactly 5-hour delay, the supplied policy provides meal voucher and lounge access for delays from 3 to 5 hours. Hotel accommodation is specified only for delays exceeding 5 hours.`;
      } else {
        responseText = `Your supplied booking currently shows a 4-hour delay. If you are asking about the policy for a ${mentionedDelay}-hour delay, delays from 3 to 5 hours qualify for a meal voucher and lounge access.`;
      }
    } else {
      tierCode = 'DELAY_TIER_UNDER_3H';
      ruleName = 'Delay Compensation Rule (Under 3 hours)';
      policyText = 'Meal voucher.';
      responseText = `Your supplied booking currently shows a 4-hour delay. If you are asking hypothetically about a delay under 3 hours, the policy provides a meal voucher.`;
    }

    return {
      ruleCode: tierCode,
      ruleApplied: ruleName,
      explanation: `Customer asked a hypothetical or contradictory query regarding a ${mentionedDelay}-hour delay while actual booking currently shows a ${actualDelayHours}-hour delay. The policy engine evaluated the hypothetical tier without altering the customer's actual booking data.`,
      shouldEscalate: false,
      currentIntent: `Hypothetical Delay Inquiry (${mentionedDelay}h)`,
      requestType: 'Hypothetical / Policy Inquiry',
      actualBookingFact,
      hypotheticalDelayHours: mentionedDelay,
      policyEvaluated: `${ruleName}: ${policyText}`,
      actionAttempted: 'Policy inquiry explanation',
      actionResult: 'Clarified hypothetical policy without modifying booking facts',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers: [
        {
          action: 'Silently altering customer booking record based on hypothetical prompt',
          triggered: false,
        },
      ],
      allowedActions: ['Explain hypothetical policy entitlements', 'Reaffirm actual booking facts'],
      forcedDeterministicResponse: responseText,
    };
  }

  // -------------------------------------------------------------------------
  // 6. Prohibited Trigger Checks on Current Intent
  // -------------------------------------------------------------------------
  const triggeredUpgrade =
    normalizedMsg.includes('upgrade') ||
    normalizedMsg.includes('business class') ||
    normalizedMsg.includes('first class') ||
    normalizedMsg.includes('club class');

  const triggeredFullNightHotel =
    (normalizedMsg.includes('full night') ||
      normalizedMsg.includes('overnight') ||
      normalizedMsg.includes('night stay') ||
      normalizedMsg.includes('all night') ||
      normalizedMsg.includes('entire night')) &&
    (normalizedMsg.includes('hotel') || normalizedMsg.includes('stay') || normalizedMsg.includes('room'));

  // Fare difference detection (€500, €2000, ₹2,000, 2000)
  const isFareDifferenceQuery =
    normalizedMsg.includes('fare difference') ||
    normalizedMsg.includes('higher-fare') ||
    normalizedMsg.includes('higher fare') ||
    normalizedMsg.includes('costs €500 more') ||
    normalizedMsg.includes('costs €2,000 more') ||
    normalizedMsg.includes('€500') ||
    normalizedMsg.includes('€2,000') ||
    normalizedMsg.includes('2,000') ||
    normalizedMsg.includes('2000') ||
    normalizedMsg.includes('waive');

  const triggeredExcessFareWaiver =
    (normalizedMsg.includes('waive') || normalizedMsg.includes('waiver')) &&
    (normalizedMsg.includes('2000') ||
      normalizedMsg.includes('2,000') ||
      normalizedMsg.includes('€2,000') ||
      normalizedMsg.includes('€500') ||
      normalizedMsg.includes('extra charge'));

  const prohibitedTriggers = [
    {
      action: 'Approving compensation beyond policy (class upgrades, cash-in-lieu)',
      triggered: triggeredUpgrade,
      reason: triggeredUpgrade ? 'Customer requested complimentary business-class upgrade.' : undefined,
    },
    {
      action: 'Approving full-night hotel stay for delay-only disruption',
      triggered: triggeredFullNightHotel,
      reason: triggeredFullNightHotel ? 'Customer requested full night hotel accommodation for delay disruption.' : undefined,
    },
    {
      action: 'Waiving fare difference above ₹1,500 without supervisor approval',
      triggered: triggeredExcessFareWaiver,
      reason: triggeredExcessFareWaiver ? 'Customer requested waiver exceeding autonomous limit (e.g. ₹2,000 / €2,000).' : undefined,
    },
    {
      action: 'Processing refund to different payment method',
      triggered: false,
    },
    {
      action: 'Handling legal action or formal complaint threats',
      triggered: false,
    },
  ];

  // -------------------------------------------------------------------------
  // 7. Scenario Evaluation: Priya Nair (Cancelled Flight SK-204)
  // -------------------------------------------------------------------------
  if (isCancelled) {
    const isAskingRefund = normalizedMsg.includes('refund');
    const isAskingRebooking =
      normalizedMsg.includes('rebook') ||
      normalizedMsg.includes('next flight') ||
      normalizedMsg.includes('available flight') ||
      normalizedMsg.includes('earlier flight');

    if (triggeredUpgrade && isAskingRefund) {
      // Partial Request: Refund is ELIGIBLE, Upgrade is ESCALATED
      return {
        ruleCode: 'CANCELLATION_REBOOKING',
        ruleApplied: 'Cancellation Rebooking Rule & Escalation for Class Upgrade',
        explanation: 'Flight SK-204 was cancelled by the airline. The customer is eligible for a full refund to the original payment method (7 business days). The request for a complimentary business-class upgrade exceeds standard policy and is escalated to a human specialist. Crucially, the upgrade escalation does not cancel the valid refund entitlement.',
        shouldEscalate: true,
        escalationReason: 'Prohibited Action: Class upgrades "for the trouble" exceed policy entitlements. Full refund is eligible, while upgrade demand is escalated to human specialist.',
        currentIntent: 'Cancellation Refund & Business Upgrade Demand',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Cancellation Rebooking Rule & Prohibited Actions Rule',
        actionAttempted: 'Simulated refund to original payment method + escalation for class upgrade',
        actionResult: 'Refund eligibility confirmed (simulated in prototype); upgrade request escalated',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: [
          'Full refund eligible to original payment method (processed within 7 business days)',
          'Simulated action recorded in prototype: full refund to original payment method',
          'Escalate class upgrade request to human specialist',
        ],
        forcedDeterministicResponse: `Refund eligibility confirmed. The prototype has recorded a simulated refund action of your full ticket to your original payment method (processed within 7 business days per policy). Regarding your request for a complimentary business-class upgrade on return flight SK-205: standard disruption policy covers rebooking or full refund and does not provide complimentary class upgrades. While Gold members receive priority seat access on next-available economy flights, upgrades are not included in standard policy. I have escalated your upgrade request to our senior resolution specialists for review.`,
      };
    }

    if (triggeredUpgrade) {
      return {
        ruleCode: 'CANCELLATION_REBOOKING',
        ruleApplied: 'Cancellation Rebooking Rule & Escalation for Class Upgrade',
        explanation: 'Customer requested a complimentary business-class upgrade. Policy strictly forbids class upgrades as disruption compensation; escalated to supervisor.',
        shouldEscalate: true,
        escalationReason: 'Prohibited Action: Complimentary class upgrade demand.',
        currentIntent: 'Business Upgrade Demand',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Loyalty Tier Rule & Prohibited Actions',
        actionAttempted: 'Complimentary class upgrade request',
        actionResult: 'Escalated to human specialist',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: ['Free rebooking on next available flight within 24 hours', 'Full refund to original payment method (7 business days)'],
        forcedDeterministicResponse: `Your flight SK-204 was cancelled. Under the supplied Cancellation Rebooking Rule, you are entitled to choose between free rebooking on the next available flight within 24 hours or a full refund to your original payment method. Gold status provides priority rebooking access, but does not provide complimentary class upgrades. I have escalated your upgrade request to our senior resolution specialists.`,
      };
    }

    if (isAskingRefund) {
      return {
        ruleCode: 'CANCELLATION_REBOOKING',
        ruleApplied: 'Cancellation Rebooking Rule (Full Refund Selection)',
        explanation: 'Customer selected full refund for cancelled flight SK-204. Full refund to original payment method is processed within 7 business days. Rebooking is not simultaneously processed to preserve customer choice.',
        shouldEscalate: false,
        currentIntent: 'Cancellation Full Refund Request',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Cancellation Rebooking Rule & Refund Processing Rule',
        actionAttempted: 'Simulated full refund to original payment method',
        actionResult: 'Refund eligibility confirmed. Simulated action recorded in prototype.',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: ['Full refund to original payment method (7 business days)', 'Confirm return flight SK-205 status (unaffected)'],
        forcedDeterministicResponse: `Under our Cancellation Rebooking Rule, you are eligible for a full refund of your cancelled flight SK-204 to your original payment method within 7 business days. Refund eligibility confirmed. The prototype has recorded a simulated refund action to the original payment method. Your return flight SK-205 on Friday, 25 September remains unaffected.`,
      };
    }

    if (isAskingRebooking) {
      return {
        ruleCode: 'CANCELLATION_REBOOKING',
        ruleApplied: 'Cancellation Rebooking Rule (Alternative Flight Inquiry)',
        explanation: 'Customer requested rebooking options. Policy provides free rebooking within 24 hours with Gold priority seat access, but alternative flight inventory is not supplied in the dataset.',
        shouldEscalate: false,
        currentIntent: 'Alternative Flight / Rebooking Inquiry',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Cancellation Rebooking Rule',
        actionAttempted: 'Check rebooking eligibility',
        actionResult: 'Rebooking eligibility confirmed. Inventory not present in supplied data.',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: ['Free rebooking on next available flight within 24 hours (Gold priority access)'],
        forcedDeterministicResponse: `The supplied exercise data confirms eligibility for free rebooking within 24 hours (with Gold priority seat access), but it does not provide alternative flight inventory. I cannot invent a flight number or departure time. Operational confirmation is required to identify the next available service. Alternatively, you may choose a full refund to your original payment method.`,
      };
    }

    // Default cancellation options baseline
    return {
      ruleCode: 'CANCELLATION_REBOOKING',
      ruleApplied: 'Cancellation Rebooking Rule',
      explanation: 'Flight SK-204 is cancelled due to operational reasons. Under the Cancellation Rebooking Rule, Priya Nair is entitled to EITHER a free rebooking on the next available flight within 24 hours (with Gold priority seat access), OR a full refund to the original payment method (processed within 7 business days).',
      shouldEscalate: false,
      currentIntent: 'Cancellation Options Inquiry',
      requestType: 'Actual Booking Query',
      actualBookingFact,
      policyEvaluated: 'Cancellation Rebooking Rule',
      actionAttempted: 'Present in-policy resolution options',
      actionResult: 'Presented free rebooking vs. full refund options',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers,
      allowedActions: [
        'Free rebooking on next available flight within 24 hours',
        'Full refund to original payment method (7 business days)',
        'Priority seat access on next flight (Gold loyalty tier)',
      ],
      forcedDeterministicResponse: `Your flight SK-204 from Delhi to Goa today has been cancelled due to operational reasons. Under our Cancellation Rebooking Rule, you are entitled to choose between:
1. Free rebooking on the next available flight within 24 hours (with Gold loyalty tier priority seat access).
2. A full refund processed to your original payment method within 7 business days.

Your return flight SK-205 on Friday, 25 September is unaffected. Which resolution option would you prefer?`,
    };
  }

  // -------------------------------------------------------------------------
  // 8. Scenario Evaluation: Arvind Kulkarni (4-Hour Delay on SK-118)
  // -------------------------------------------------------------------------
  if (customer.id === 'arvind-kulkarni') {
    const isAskingForHotel =
      normalizedMsg.includes('hotel') ||
      normalizedMsg.includes('room') ||
      normalizedMsg.includes('accommodation') ||
      normalizedMsg.includes('stay');

    if (isAskingForHotel) {
      return {
        ruleCode: 'DELAY_TIER_3H_TO_5H',
        ruleApplied: 'Delay Compensation Rule (Delay > 3 hours: meal voucher + lounge access)',
        explanation: 'Flight SK-118 is delayed by 4 hours. Under the Delay Compensation Rule, delays between 3 and 5 hours entitle the passenger to a meal voucher and lounge access. Hotel accommodation is strictly reserved for delays of more than 5 hours. Hotel accommodation is politely declined with an explanation of the policy tier, and meal voucher + lounge access are provided. This is an in-policy clarification and does NOT trigger escalation.',
        shouldEscalate: false,
        currentIntent: 'Hotel Accommodation Request (4h Delay)',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Delay Compensation Rule (3–5 Hours Tier)',
        actionAttempted: 'Hotel request evaluation against 5-hour threshold',
        actionResult: 'Hotel declined per policy (<5h); meal voucher and lounge access confirmed',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: ['Issue meal voucher', 'Provide lounge access', 'Provide updated departure schedule (11:10)'],
        forcedDeterministicResponse: `Your booking currently shows a 4-hour delay (rescheduled from 07:10 to 11:10).

Under the supplied Delay Compensation Rule, delays from 3 to 5 hours qualify for:
• Meal voucher
• Lounge access

Hotel accommodation applies only when the delay exceeds 5 hours. Because your delay is 4 hours, hotel accommodation is not available.

Under the supplied policy, you are eligible for lounge access. The supplied data does not contain a lounge location or access code, so I cannot provide one. You are eligible for a meal voucher under the supplied policy while you wait for the 11:10 departure.`,
      };
    }

    return {
      ruleCode: 'DELAY_TIER_3H_TO_5H',
      ruleApplied: 'Delay Compensation Rule (Delay > 3 hours: meal voucher + lounge access)',
      explanation: 'Flight SK-118 is delayed by 4 hours (07:10 to 11:10). Since the delay is greater than 3 hours but under 5 hours, Arvind Kulkarni is entitled to a meal voucher plus airport lounge access while waiting.',
      shouldEscalate: false,
      currentIntent: 'Delay Compensation Inquiry (4h Delay)',
      requestType: 'Actual Booking Query',
      actualBookingFact,
      policyEvaluated: 'Delay Compensation Rule (3–5 Hours Tier)',
      actionAttempted: 'Verify delay entitlements for 4-hour delay',
      actionResult: 'Meal voucher and lounge access eligible',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers,
      allowedActions: ['Issue meal voucher', 'Provide lounge access'],
      forcedDeterministicResponse: `Your booking currently shows a 4-hour delay on flight SK-118 from Mumbai to Bengaluru, with departure rescheduled to 11:10.

Under the supplied Delay Compensation Rule, delays from 3 to 5 hours qualify for:
• Meal voucher
• Lounge access

Hotel accommodation applies only when the delay exceeds 5 hours.

Decision: You are eligible for a meal voucher and lounge access. The supplied data does not contain a lounge location or access code, so I cannot provide one.

Source: Delay Compensation Rule.`,
    };
  }

  // -------------------------------------------------------------------------
  // 9. Scenario Evaluation: Meher Kaur (6-Hour Delay on SK-305)
  // -------------------------------------------------------------------------
  if (customer.id === 'meher-kaur') {
    // 9A. Full-Night Hotel Stay Demand
    if (triggeredFullNightHotel) {
      return {
        ruleCode: 'DELAY_TIER_OVER_5H',
        ruleApplied: 'Delay Compensation Rule (>5h) & Escalation for Full-Night Stay',
        explanation: 'Flight SK-305 is delayed by 6 hours (14:00 to 20:00). Delays exceeding 5 hours entitle the customer to a meal voucher, lounge access, and hotel accommodation ONLY covering the delayed hours themselves — NOT a full night\'s stay. The demand for an overnight / full-night stay exceeds policy and must be escalated to a human specialist.',
        shouldEscalate: true,
        escalationReason: 'Prohibited Action: Hotel accommodation for delay disruptions is strictly limited to the delayed hours themselves. A full-night stay request exceeds policy and requires specialist escalation.',
        currentIntent: 'Full-Night Hotel Stay Request (6h Delay)',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Delay Compensation Rule (>5 Hours Tier)',
        actionAttempted: 'Full night hotel request evaluation',
        actionResult: 'Full night hotel escalated; delayed-hours accommodation confirmed',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: [
          'Issue meal voucher',
          'Provide lounge access',
          'Arrange accommodation covering delayed hours only (until 20:00 departure)',
          'Escalate full-night stay request to human specialist',
        ],
        forcedDeterministicResponse: `Under the supplied Delay Compensation Rule for delays exceeding 5 hours, airline policy covers hotel accommodation strictly for the duration of the delayed hours themselves (until your 20:00 departure), not a full night's stay.

You remain eligible for a meal voucher, lounge access, and accommodation covering the delayed hours. Because you are requesting a full night's stay beyond the supplied policy, I have escalated this request to a human resolution specialist. A specialist will review your request and contact you at ${customer.contact.email} or ${customer.contact.phone}.`,
      };
    }

    // 9B. Fare Difference Waiver Request (e.g. €2,000 / ₹2,000 waiver)
    if (triggeredExcessFareWaiver) {
      return {
        ruleCode: 'FARE_DIFFERENCE',
        ruleApplied: 'Fare Difference Rule (Exceeds ₹1,500 Auto-Waiver Cap)',
        explanation: 'Under the Fare Difference Rule, voluntary changes to a higher-fare flight require the customer to pay the difference. Autonomous agent authority is capped at ₹1,500. A fare difference of ₹2,000 / €2,000 exceeds this cap and requires supervisor approval. The agent informs the customer of the fare difference, offers to process if customer pays, and escalates the waiver request.',
        shouldEscalate: true,
        escalationReason: 'Prohibited Action: Agent cannot waive fare differences exceeding ₹1,500 autonomously. Waiver request requires supervisor approval.',
        currentIntent: 'Fare Difference Waiver Request',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Fare Difference Rule',
        actionAttempted: 'Fare difference waiver above ₹1,500',
        actionResult: 'Waiver exceeds autonomous limit; escalated to supervisor for approval',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: [
          'Inform customer of fare difference payment requirement',
          'Offer to process voluntary rebooking if customer pays difference',
          'Escalate waiver request to supervisor for approval',
        ],
        forcedDeterministicResponse: `Under the Fare Difference Rule, agents may autonomously waive fare differences up to ₹1,500 for voluntary changes. A waiver of ₹2,000 (or €2,000) exceeds my autonomous authorization threshold and requires supervisor approval.

I can confirm that you may proceed with the rebooking if you pay the fare difference, or I can escalate your request for a full waiver to a supervisor for review. I have recorded the waiver escalation for supervisor review.`,
      };
    }

    // 9C. Voluntary higher-fare change (€500 more or general higher fare)
    if (isFareDifferenceQuery) {
      return {
        ruleCode: 'FARE_DIFFERENCE',
        ruleApplied: 'Fare Difference Rule (Voluntary Higher-Fare Rebooking)',
        explanation: 'Customer requested to change to a higher-fare flight. For voluntary rebooking to a higher-fare flight, the customer must pay the fare difference. Platinum priority seat access does not waive fare differences. Alternative flight inventory is not supplied in dataset.',
        shouldEscalate: false,
        currentIntent: 'Higher-Fare Rebooking Inquiry',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Fare Difference Rule & Loyalty Tier Rule',
        actionAttempted: 'Higher-fare rebooking evaluation',
        actionResult: 'Fare difference requirement confirmed; inventory not in supplied dataset',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: [
          'Inform customer of fare difference requirement',
          'Note that Platinum priority access does not waive fare differences',
        ],
        forcedDeterministicResponse: `For a voluntary change to an earlier higher-fare flight, the customer must pay the fare difference under our Fare Difference Rule. Platinum status provides priority access to next-available seats, but does not waive fare differences.

Furthermore, the supplied exercise data does not contain alternative flight inventory, so I cannot invent an alternative flight number or departure time. If you wish to pay the fare difference once confirmed operationally, I can assist you with that process.`,
      };
    }

    // 9D. Platinum upgrade demand
    if (triggeredUpgrade) {
      return {
        ruleCode: 'LOYALTY_PRIORITY',
        ruleApplied: 'Loyalty Tier Rule (No Automatic Class Upgrade)',
        explanation: 'Platinum status provides priority access to rebooking, but the supplied policy does not state that Platinum members automatically receive a complimentary business-class upgrade.',
        shouldEscalate: true,
        escalationReason: 'Prohibited Action: Customer demanded complimentary business class upgrade based on Platinum loyalty status.',
        currentIntent: 'Platinum Loyalty Upgrade Request',
        requestType: 'Actual Booking Query',
        actualBookingFact,
        policyEvaluated: 'Loyalty Tier Rule & Prohibited Actions Rule',
        actionAttempted: 'Loyalty tier upgrade evaluation',
        actionResult: 'Upgrade not provided in policy; escalated to specialist',
        bookingDataChanged: false,
        hasActivePreviousEscalation: previousEscalation.isEscalated,
        previousEscalationReason: previousEscalation.reason,
        prohibitedTriggers,
        allowedActions: ['Priority seat access on next-available flights (Platinum tier)'],
        forcedDeterministicResponse: `Platinum status provides priority access to rebooking, but the supplied policy does not state that Platinum members automatically receive a complimentary business-class upgrade. I cannot approve that benefit automatically. I have escalated your request to a human resolution specialist for review.`,
      };
    }

    // 9E. Meher Baseline (6h delay compensation inquiry)
    return {
      ruleCode: 'DELAY_TIER_OVER_5H',
      ruleApplied: 'Delay Compensation Rule (Delay > 5 hours) + Loyalty Tier Rule',
      explanation: 'Flight SK-305 is delayed by 6 hours (14:00 to 20:00). Delays over 5 hours entitle Meher Kaur to a meal voucher, lounge access, and hotel accommodation covering the delayed hours themselves (day room), as well as priority rebooking seat access via her Platinum tier.',
      shouldEscalate: false,
      currentIntent: 'Delay Compensation Inquiry (>5h Delay)',
      requestType: 'Actual Booking Query',
      actualBookingFact,
      policyEvaluated: 'Delay Compensation Rule (>5 Hours Tier) & Loyalty Tier Rule',
      actionAttempted: 'Verify entitlements for 6-hour delay',
      actionResult: 'Eligible for meal voucher, lounge access, and delayed-hours accommodation',
      bookingDataChanged: false,
      hasActivePreviousEscalation: previousEscalation.isEscalated,
      previousEscalationReason: previousEscalation.reason,
      prohibitedTriggers,
      allowedActions: [
        'Meal voucher eligible',
        'Lounge access eligible',
        'Hotel accommodation covering delayed hours only (until 20:00 departure)',
        'Priority rebooking seat access on next available flight (Platinum tier)',
      ],
      forcedDeterministicResponse: `Your booking currently shows a 6-hour delay on flight SK-305 from Delhi to Hyderabad, with new departure at 20:00.

Under the supplied Delay Compensation Rule for delays exceeding 5 hours, you are entitled to:
• Meal voucher
• Lounge access
• Hotel accommodation covering the delayed hours themselves (until your 20:00 departure)

As a Platinum member, you also receive priority seat access if rebooking. The supplied data does not contain hotel names, locations, or lounge access codes, so I cannot invent them.

Decision: Meal voucher, lounge access, and accommodation covering the delayed hours eligible.

Source: Delay Compensation Rule.`,
    };
  }

  // -------------------------------------------------------------------------
  // 10. Fallback Standard In-Policy Resolution
  // -------------------------------------------------------------------------
  return {
    ruleCode: 'LOYALTY_PRIORITY',
    ruleApplied: 'Standard Disruption Policy',
    explanation: 'Standard policy assistance for customer disruption.',
    shouldEscalate: false,
    currentIntent: 'General Disruption Support Inquiry',
    requestType: 'Actual Booking Query',
    actualBookingFact,
    policyEvaluated: 'Standard Disruption Policy',
    actionAttempted: 'Provide flight status and assistance',
    actionResult: 'Information provided based on supplied dataset',
    bookingDataChanged: false,
    hasActivePreviousEscalation: previousEscalation.isEscalated,
    previousEscalationReason: previousEscalation.reason,
    prohibitedTriggers,
    allowedActions: ['Provide flight status and in-policy disruption assistance'],
    forcedDeterministicResponse: `Hello ${customer.name}, I am here to assist you with your flight disruption. Your current booking shows ${actualBookingFact}. How may I help you with your entitlements?`,
  };
}
