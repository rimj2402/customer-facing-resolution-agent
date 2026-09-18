import React from 'react';
import { AlertCircle, Mail, Phone, Info } from 'lucide-react';
import { CustomerProfile } from '../types';

interface EscalationBannerProps {
  customer: CustomerProfile;
  escalationReason?: string;
  isCurrentTurnEscalated?: boolean;
  hasPreviousEscalation?: boolean;
  onResetConversation?: () => void;
}

export const EscalationBanner: React.FC<EscalationBannerProps> = ({
  customer,
  escalationReason,
  isCurrentTurnEscalated = true,
  hasPreviousEscalation = false,
  onResetConversation,
}) => {
  // If the current turn itself is escalated
  if (isCurrentTurnEscalated) {
    return (
      <div
        id="escalation-banner"
        className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-xs mb-3 text-slate-800"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-500 text-white rounded-full mt-0.5 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                  Escalated to Human Resolution Specialist
                </h3>
                <span className="text-[10px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                  Active Ticket
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                This request requires supervisor approval or exceeds autonomous agent policy. The automated agent has paused negotiation on this issue. A dedicated specialist will contact the customer directly to provide formal resolution.
              </p>
              {escalationReason && (
                <div className="mt-2 text-xs bg-white/70 border border-amber-200/80 rounded px-2.5 py-1.5 text-amber-950 font-medium">
                  <span className="text-amber-700 font-bold">Escalation Trigger: </span>
                  {escalationReason}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-amber-900">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-700" />
                  <span>Follow-up email: <strong>{customer.contact.email}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-700" />
                  <span>Follow-up phone: <strong>{customer.contact.phone}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {onResetConversation && (
            <button
              id="reset-from-escalation-btn"
              onClick={onResetConversation}
              className="text-xs bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded font-medium shrink-0 ml-3 transition-colors shadow-2xs"
              title="Start fresh conversation"
            >
              Reset Chat
            </button>
          )}
        </div>
      </div>
    );
  }

  // If a previous escalation occurred in this session, but current turn is being answered independently
  if (hasPreviousEscalation) {
    return (
      <div
        id="previous-escalation-banner"
        className="bg-blue-500/10 border-l-4 border-blue-500 p-3 rounded-r-lg shadow-xs mb-3 text-slate-800"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2.5">
            <div className="p-1.5 bg-blue-500 text-white rounded-full mt-0.5 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                  Previous Request Under Human Review
                </h4>
                <span className="text-[9px] font-semibold bg-blue-200/80 text-blue-900 px-2 py-0.2 rounded-full">
                  Ticket Logged
                </span>
              </div>
              <p className="text-[11px] text-blue-900 mt-0.5 leading-relaxed">
                Previous request is still under human review. Current in-policy inquiries are processed independently by the automated agent.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
