import React, { useState, useRef } from 'react';
import { getTemplates } from '../../utils/codingTemplates';
import './CodeSnippetToolbar.css';

const CodeSnippetToolbar = ({ language, onInsertSnippet, editor }) => {
  const [activeCategory, setActiveCategory] = useState('imports');
  const [showTooltip, setShowTooltip] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const tooltipTimeoutRef = useRef(null);

  const templates = getTemplates(language);
  
  if (!templates || Object.keys(templates).length === 0) {
    return null;
  }

  const categories = Object.keys(templates);

  const insertSnippet = (snippet) => {
    if (!editor) return;
    
    const selection = editor.getSelection();
    const position = selection ? selection.getStartPosition() : editor.getPosition();
    
    // Process snippet to handle placeholders
    const processedSnippet = snippet.replace(/\$\{(\d+):([^}]+)\}/g, (match, index, placeholder) => {
      return placeholder;
    });

    // Auto-indent the snippet based on current line indentation
    const currentLineContent = editor.getModel().getLineContent(position.lineNumber);
    const currentIndent = currentLineContent.match(/^\s*/)[0];
    const indentedSnippet = processedSnippet.split('\n').map((line, index) => {
      return index === 0 ? line : currentIndent + line;
    }).join('\n');
    
    editor.executeEdits('insert-snippet', [{
      range: new window.monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: indentedSnippet
    }]);
    
    editor.focus();
    setShowDropdown(false);
    onInsertSnippet && onInsertSnippet(indentedSnippet);
  };

  const showTooltipWithDelay = (key, snippet) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip({ key, snippet });
    }, 500);
  };

  const hideTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowTooltip(null);
  };

  return (
    <div className="snippet-icon-container">
      <button 
        className="snippet-icon-btn"
        onClick={() => setShowDropdown(!showDropdown)}
        title={`Code snippets for ${language.toUpperCase()}`}
      >
        📝
      </button>
      
      {showDropdown && (
        <div className="snippet-dropdown">
          <div className="snippet-header">
            <span>Code Snippets ({language.toUpperCase()})</span>
          </div>
          
          <div className="category-tabs">
            {categories.map(category => (
              <button
                key={category}
                className={`category-tab ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>

          <div className="snippets-grid">
            {Object.entries(templates[activeCategory] || {}).map(([key, snippet]) => (
              <div
                key={key}
                className="snippet-item"
                onClick={() => insertSnippet(snippet)}
                onMouseEnter={() => showTooltipWithDelay(key, snippet)}
                onMouseLeave={hideTooltip}
                title={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              >
                <div className="snippet-icon">
                  {getSnippetIcon(key, activeCategory)}
                </div>
                
                {showTooltip && showTooltip.key === key && (
                  <div className="snippet-tooltip">
                    <pre>{showTooltip.snippet.substring(0, 150)}...</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Helper function to get appropriate icon for snippet
  function getSnippetIcon(key, category) {
    const iconMap = {
      // Imports
      imports: '📦',
      // Control structures
      for_loop: '🔄',
      while_loop: '⭕',
      if_else: '🔀',
      try_catch: '🛡️',
      // Data structures
      list: '📋',
      dict: '🗂️',
      set: '🎯',
      tuple: '📦',
      // Functions
      function: '⚡',
      class: '🏗️',
      // Algorithms
      binary_search: '🔍',
      sort: '📊',
      // Default fallback
      default: '💻'
    };
    
    return iconMap[key] || iconMap[category] || iconMap.default;
  }
};

export default CodeSnippetToolbar;