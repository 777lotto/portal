import React, { useMemo } from 'react';

interface StyledDigitInputProps {
  value: string;
  onChange: (value: string) => void;
  digitCount: number;
  label: string;
  id: string;
  autoComplete?: string;
  format?: 'phone' | 'code';
}

const StyledDigitInput: React.FC<StyledDigitInputProps> = ({
  value,
  onChange,
  digitCount,
  label,
  id,
  autoComplete = 'off',
  format = 'code',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanedValue = e.target.value.replace(/\D/g, '').substring(0, digitCount);
    onChange(cleanedValue);
  };

  const displayBoxes = useMemo(() => {
    const digits = value.split('');
    const boxes = [];
    for (let i = 0; i < digitCount; i++) {
      boxes.push(
        <div key={i} className="sdi-box">
          {digits[i] || ''}
        </div>
      );
    }
    if (format === 'phone' && digitCount === 10) {
      return (
        <div className="sdi-container-phone">
          <span className="sdi-char">(</span>
          {boxes.slice(0, 3)}
          <span className="sdi-char">)</span>
          {boxes.slice(3, 6)}
          <span className="sdi-char">-</span>
          {boxes.slice(6, 10)}
        </div>
      );
    }
    return <div className="sdi-container-code">{boxes}</div>;
  }, [value, digitCount, format]);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="tel"
          value={value}
          onChange={handleChange}
          autoComplete={autoComplete}
          className="sdi-input"
        />
        <div className="sdi-display" aria-hidden="true">
          {displayBoxes}
        </div>
      </div>
    </div>
  );
};

export default StyledDigitInput;
