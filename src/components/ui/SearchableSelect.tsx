'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SearchableSelectProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    name?: string;
    id?: string;
}

const normalizeTr = (s: string) => s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Seçiniz veya arayınız...',
    required = false,
    disabled = false,
    name,
    id,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(value || '');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync search term when external value changes
    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                const normSearch = normalizeTr(searchTerm.trim());
                const found = options.find(
                    o => normalizeTr(o) === normSearch || o.toLocaleLowerCase('tr-TR') === searchTerm.trim().toLocaleLowerCase('tr-TR')
                );
                if (found) {
                    onChange(found);
                    setSearchTerm(found);
                } else if (!searchTerm.trim()) {
                    onChange('');
                    setSearchTerm('');
                } else {
                    // Check if value is still valid
                    if (!value) {
                        setSearchTerm('');
                    } else {
                        setSearchTerm(value);
                    }
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [options, searchTerm, value, onChange]);

    // Filter options using Turkish locale and normalized comparison
    const normSearch = normalizeTr(searchTerm.trim());
    const filteredOptions = options.filter(opt =>
        opt.toLocaleLowerCase('tr-TR').includes(searchTerm.trim().toLocaleLowerCase('tr-TR')) ||
        normalizeTr(opt).includes(normSearch)
    );

    const handleSelect = (opt: string) => {
        onChange(opt);
        setSearchTerm(opt);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (!isOpen) setIsOpen(true);
        // If exact match while typing, trigger onChange
        const exact = options.find(o => o.toLocaleLowerCase('tr-TR') === val.trim().toLocaleLowerCase('tr-TR'));
        if (exact) {
            onChange(exact);
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                    ref={inputRef}
                    id={id}
                    name={name}
                    type="text"
                    className="form-input"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (!disabled) setIsOpen(true);
                    }}
                    disabled={disabled}
                    required={required}
                    autoComplete="off"
                    style={{ paddingRight: '2rem' }}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(prev => !prev);
                            inputRef.current?.focus();
                        }
                    }}
                    style={{
                        position: 'absolute',
                        right: '0.6rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        transition: 'transform 0.2s ease',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                >
                    ▼
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 1050,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        maxHeight: '220px',
                        overflowY: 'auto',
                    }}
                >
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => {
                            const isSelected = opt === value;
                            return (
                                <div
                                    key={opt}
                                    onClick={() => handleSelect(opt)}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: 'var(--font-size-sm)',
                                        cursor: 'pointer',
                                        background: isSelected ? 'var(--brand-primary-light)' : 'transparent',
                                        color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                                        fontWeight: isSelected ? 600 : 400,
                                        borderBottom: '1px solid var(--border-primary)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <span>{opt}</span>
                                    {isSelected && <span>✓</span>}
                                </div>
                            );
                        })
                    ) : (
                        <div
                            style={{
                                padding: '10px 12px',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-tertiary)',
                                textAlign: 'center',
                            }}
                        >
                            Sonuç bulunamadı
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
