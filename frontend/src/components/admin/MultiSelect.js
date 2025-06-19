import React, { useState, useRef, useEffect } from 'react';
import styles from './MultiSelect.module.css';

const MultiSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  maxDisplay = 3
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (value.length === filteredOptions.length) {
      onChange([]);
    } else {
      onChange(filteredOptions);
    }
  };

  const handleOptionToggle = (option) => {
    const isSelected = value.some(item => item.value === option.value);
    if (isSelected) {
      onChange(value.filter(item => item.value !== option.value));
    } else {
      onChange([...value, option]);
    }
  };

  const handleRemoveItem = (itemToRemove) => {
    onChange(value.filter(item => item.value !== itemToRemove.value));
  };

  const displayText = () => {
    if (value.length === 0) return placeholder;
    if (value.length <= maxDisplay) {
      return value.map(item => item.label.split('(')[0].trim()).join(', ');
    }
    return `${value.slice(0, maxDisplay).map(item => item.label.split('(')[0].trim()).join(', ')} +${value.length - maxDisplay} more`;
  };

  return (
    <div className={styles.multiSelect} ref={dropdownRef}>
      <div 
        className={styles.selectInput}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.selectText}>{displayText()}</span>
        <span className={`${styles.arrow} ${isOpen ? styles.open : ''}`}>▼</span>
      </div>

      {value.length > 0 && (
        <div className={styles.selectedItems}>
          {value.slice(0, maxDisplay).map(item => (
            <span key={item.value} className={styles.selectedItem}>
              {item.label.split('(')[0].trim()}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveItem(item);
                }}
                className={styles.removeButton}
              >
                ×
              </button>
            </span>
          ))}
          {value.length > maxDisplay && (
            <span className={styles.moreCount}>+{value.length - maxDisplay}</span>
          )}
        </div>
      )}

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className={styles.selectAllContainer}>
            <label className={styles.option}>
              <input
                type="checkbox"
                checked={value.length === filteredOptions.length && filteredOptions.length > 0}
                onChange={handleSelectAll}
              />
              <span className={styles.selectAllText}>
                Select All ({filteredOptions.length})
              </span>
            </label>
          </div>

          <div className={styles.optionsList}>
            {filteredOptions.map(option => (
              <label key={option.value} className={styles.option}>
                <input
                  type="checkbox"
                  checked={value.some(item => item.value === option.value)}
                  onChange={() => handleOptionToggle(option)}
                />
                <span className={styles.optionLabel}>{option.label}</span>
              </label>
            ))}
          </div>

          {filteredOptions.length === 0 && (
            <div className={styles.noResults}>No options found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
