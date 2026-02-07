import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export function StatusSelect({ value, onChange, options }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'NUEVO': return 'bg-[#FFB547]';
            case 'DISEÑO': return 'bg-[#4318FF]';
            case 'PRODUCCIÓN': return 'bg-[#FFB547]';
            case 'LISTO': return 'bg-[#05CD99]';
            case 'ENTREGADO': return 'bg-gray-400';
            default: return 'bg-gray-400';
        }
    };

    return (
        <div className="relative w-full font-sans" ref={dropdownRef}>
            {/* Trigger: White Pill with Border */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white border border-[#E0E5F2] rounded-2xl px-4 py-3 shadow-none hover:shadow-[0px_18px_40px_rgba(112,144,176,0.12)] transition-all duration-200 outline-none"
            >
                <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(value)} shadow-sm`}></span>
                    <span className="text-sm font-bold text-[#2B3674]">{value}</span>
                </div>
                <ChevronDown size={14} className="text-[#A3AED0]" />
            </button>

            {/* Dropdown List: Floating White Card */}
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-full bg-white border border-[#E0E5F2] rounded-2xl shadow-[0px_20px_50px_rgba(112,144,176,0.12)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-2">
                    {options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => {
                                onChange(option);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${value === option ? 'bg-[#F4F7FE] text-[#2B3674]' : 'text-[#A3AED0] hover:bg-[#F4F7FE] hover:text-[#2B3674]'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(option)} ${value === option ? 'opacity-100' : 'opacity-40'} transition-opacity`}></span>
                            {option}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
