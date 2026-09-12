
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Plus, Search, ChevronRight, User, Tag } from 'lucide-react';

interface SelectableItem {
  id: number | string;
  name: string;
}

interface SelectionModalProps {
  title: string;
  items: SelectableItem[];
  onClose: () => void;
  onSelect: (item: SelectableItem) => void;
  onNew?: () => void; // Optional callback for creating a new item
  searchPlaceholder: string;
  renderItemIcon: () => React.ReactNode;
}

const SelectionModal: React.FC<SelectionModalProps> = ({
  title,
  items,
  onClose,
  onSelect,
  onNew,
  searchPlaceholder,
  renderItemIcon,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() =>
    items.filter(item => {
      // FIX: Safe Navigation e fallbacks para evitar crash com valores nulos do banco
      const name = item?.name || '';
      const term = searchTerm || '';
      return name.toLowerCase().includes(term.toLowerCase());
    }), [items, searchTerm]);

  // Use useEffect to focus input safely after mount
  useEffect(() => {
    if (inputRef.current) {
        // Small timeout to ensure DOM is ready
        setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, []);

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col animate-in fade-in duration-200">
      <header className="flex-shrink-0 flex items-center p-4 border-b bg-white">
        <div className="flex-1"></div>
        <h2 className="flex-1 text-lg font-bold text-center">{title}</h2>
        <div className="flex-1 flex justify-end items-center gap-2">
          {onNew && (
            <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNew(); }}
                className="p-1 text-slate-600 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors"
                title="Cadastrar Novo"
            >
                <Plus size={24} />
            </button>
          )}
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="p-1 text-slate-600 hover:text-slate-900">
              <X size={24} />
          </button>
        </div>
      </header>
      
      <div className="p-4 border-b bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul>
          {filteredItems.map(item => (
            <li key={item.id}>
              <button
                type="button"
                onClick={(e) => {
                    // CRITICAL FIX: Prevent bubbling to parent containers while unmounting
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(item);
                }}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 border-b transition-colors active:bg-slate-100"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  {((item as any).duration !== undefined || (item as any).price !== undefined) && (
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                      {(item as any).duration !== undefined && (
                        <span className="text-orange-600 font-semibold">{(item as any).duration} min</span>
                      )}
                      {(item as any).duration !== undefined && (item as any).price !== undefined && (
                        <span>•</span>
                      )}
                      {(item as any).price !== undefined && (
                        <span>R$ {Number((item as any).price).toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </div>
                 <div className="flex items-center gap-2 text-orange-500">
                    {renderItemIcon()}
                    <ChevronRight size={20} />
                </div>
              </button>
            </li>
          ))}
          {filteredItems.length === 0 && (
             <li className="p-8 text-center text-slate-500">
                <p>Nenhum item encontrado.</p>
                {onNew && (
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNew(); }} 
                        className="mt-2 text-orange-600 font-bold text-sm hover:underline"
                    >
                        Cadastrar Novo
                    </button>
                )}
             </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default SelectionModal;
