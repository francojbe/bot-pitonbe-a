import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { ORDER_STATUS, ORDER_STATUS_LIST } from '../constants'

export function StatusSelect({ value, onChange, options = ORDER_STATUS_LIST }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const styles = {
        [ORDER_STATUS.NEW]: 'bg-[#3b82f6] text-white', // blue-500
        [ORDER_STATUS.DESIGN]: 'bg-[#8b5cf6] text-white', // violet-500
        [ORDER_STATUS.PRODUCTION]: 'bg-[#f97316] text-white', // orange-500
        [ORDER_STATUS.READY]: 'bg-[#10b981] text-white', // emerald-500
        [ORDER_STATUS.DELIVERED]: 'bg-[#6b7280] text-white', // gray-500
    }

    const getStatusColor = (status) => {
        return styles[status] || 'bg-gray-400 text-white';
    }

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full font-sans" ref={dropdownRef}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-[#242424] border border-[#E0E5F2] dark:border-white/10 rounded-2xl px-4 py-3 shadow-none hover:shadow-sm transition-all duration-200 outline-none"
            >
                <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(value).split(' ')[0]} shadow-sm ring-1 ring-white dark:ring-white/10`}></span>
                    <span className="text-sm font-bold text-[var(--text-main)]">{value}</span>
                </div>
                <ChevronDown size={14} className="text-[#A3AED0]" />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-full bg-white dark:bg-[#242424] border border-[#E0E5F2] dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1">
                    {options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => {
                                onChange(option);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${value === option ? 'bg-[var(--bg-subtle)] dark:bg-white/5 text-[var(--text-main)]' : 'text-[#A3AED0] hover:bg-[var(--bg-subtle)] dark:hover:bg-white/5 hover:text-[var(--text-main)]'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(option).split(' ')[0]} ${value === option ? 'opacity-100' : 'opacity-40'} transition-opacity`}></span>
                            {option}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
