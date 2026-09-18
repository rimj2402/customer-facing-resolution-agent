import React from 'react';
import { CustomerProfile } from '../types';
import { Plane, AlertTriangle, Clock, ShieldCheck, User, Phone, Mail, CheckCircle2 } from 'lucide-react';

interface CustomerSummaryCardProps {
  customer: CustomerProfile;
  referenceDate: string;
}

export const CustomerSummaryCard: React.FC<CustomerSummaryCardProps> = ({
  customer,
  referenceDate,
}) => {
  const flight = customer.booking.activeFlight;
  const isCancelled = flight.status.type === 'CANCELLED';
  const isDelayed = flight.status.type === 'DELAYED';

  const tierBadgeColor = {
    Gold: 'bg-amber-50 text-amber-700 border-amber-200',
    Silver: 'bg-slate-100 text-slate-700 border-slate-300',
    Platinum: 'bg-purple-50 text-purple-700 border-purple-200',
  }[customer.loyaltyTier];

  return (
    <div id="customer-summary-card" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-sm">
            {customer.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-semibold text-slate-900">{customer.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tierBadgeColor}`}>
                {customer.loyaltyTier} Tier
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
              <span>PNR: <strong className="text-slate-800 font-mono">{customer.pnr}</strong></span>
              <span>•</span>
              <span>Ref Date: <strong className="text-slate-700">{referenceDate}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-600">
          <div className="flex items-center space-x-1">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>{customer.contact.email}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{customer.contact.phone}</span>
          </div>
        </div>
      </div>

      {/* Flight Disruption Banner Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 text-xs">
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Plane className="w-3.5 h-3.5 text-slate-600" />
              Disrupted Flight
            </span>
            <span className="font-mono font-bold text-slate-900">{flight.flightNumber}</span>
          </div>
          <div className="text-slate-800 font-semibold text-sm">
            {flight.origin} → {flight.destination}
          </div>
          <div className="text-slate-500 mt-0.5">
            Scheduled: {flight.departureDate} at {flight.departureTime}
          </div>
        </div>

        <div
          className={`rounded-lg p-2.5 border ${
            isCancelled
              ? 'bg-rose-50/70 border-rose-200 text-rose-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold flex items-center gap-1">
              {isCancelled ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              )}
              Disruption Status
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                isCancelled ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {isCancelled ? 'CANCELLED' : `DELAYED ${flight.status.type === 'DELAYED' ? flight.status.delayHours : ''}H`}
            </span>
          </div>
          <div className="font-medium">
            {flight.status.type === 'CANCELLED' && `Reason: ${flight.status.reason}`}
            {flight.status.type === 'DELAYED' &&
              `New Departure: ${flight.status.newDeparture} (Original: ${flight.status.originalDeparture})`}
          </div>
          {customer.booking.returnFlight && (
            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Return {customer.booking.returnFlight.flightNumber} ({customer.booking.returnFlight.departureDate}): Unaffected
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
          <div className="text-slate-500 font-medium mb-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
            12-Month Travel & History
          </div>
          <div className="text-slate-800">
            <strong>{customer.travelHistory12m.flightCount}</strong> flights flown in past 12 months
          </div>
          <div className="text-slate-500 text-[11px] mt-0.5 truncate" title={customer.travelHistory12m.priorComplaints}>
            {customer.travelHistory12m.priorComplaints}
          </div>
        </div>
      </div>
    </div>
  );
};
