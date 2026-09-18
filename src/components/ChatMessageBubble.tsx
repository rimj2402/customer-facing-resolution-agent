import React from 'react';
import { ChatMessage } from '../types';
import { Bot, User, ShieldAlert } from 'lucide-react';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message }) => {
  const isAgent = message.sender === 'agent';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1.5 shadow-2xs">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
          <span>{message.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2.5 my-3 ${
        isAgent ? 'justify-start' : 'justify-end'
      }`}
    >
      {isAgent && (
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <Bot className="w-4 h-4" />
        </div>
      )}

      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-3.5 text-xs md:text-sm leading-relaxed ${
          isAgent
            ? 'bg-white text-slate-800 border border-slate-200/90 shadow-xs rounded-tl-xs'
            : 'bg-blue-600 text-white shadow-xs rounded-tr-xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-1 text-[11px] opacity-80 pb-1 border-b border-current/10">
          <span className="font-semibold">
            {isAgent ? 'SkyResolve Resolution Agent' : 'Customer'}
          </span>
          <span>{message.timestamp}</span>
        </div>

        <div className="whitespace-pre-wrap space-y-1.5">
          {message.text}
        </div>

        {isAgent && message.reasoning && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="truncate max-w-[200px]">
              Rule: <strong className="text-slate-700">{message.reasoning.ruleCode}</strong>
            </span>
            {message.reasoning.escalation.isEscalated ? (
              <span className="bg-rose-100 text-rose-700 font-semibold px-1.5 py-0.5 rounded">
                Escalated
              </span>
            ) : (
              <span className="bg-emerald-100 text-emerald-700 font-medium px-1.5 py-0.5 rounded">
                Autonomous
              </span>
            )}
          </div>
        )}
      </div>

      {!isAgent && (
        <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
