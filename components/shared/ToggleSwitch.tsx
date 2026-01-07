import React from 'react';

interface ToggleSwitchProps {
  on: boolean;
  // FIX: Updated onClick to accept MouseEvent to resolve type mismatch in components using event methods like stopPropagation.
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ on, onClick, className = '' }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-50 focus:ring-offset-2
        ${on ? 'bg-orange-500' : 'bg-slate-200'}
        ${className}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
          transition duration-200 ease-in-out
          ${on ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
};

export default ToggleSwitch;