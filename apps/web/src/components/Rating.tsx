import { useState } from 'react';

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function Rating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  showValue = false,
}: RatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue ?? value;

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  const handleMouseEnter = (rating: number) => {
    if (!readonly) {
      setHoverValue(rating);
    }
  };

  const handleMouseLeave = () => {
    setHoverValue(null);
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => handleClick(rating)}
          onMouseEnter={() => handleMouseEnter(rating)}
          onMouseLeave={handleMouseLeave}
          disabled={readonly}
          className={`
            ${sizeClasses[size]}
            ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
            transition-transform focus:outline-none
          `}
          aria-label={`Rate ${rating} star${rating > 1 ? 's' : ''}`}
        >
          <svg
            className={`w-full h-full ${
              rating <= displayValue
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 fill-current'
            }`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
      {showValue && (
        <span className="ml-2 text-sm text-gray-600 font-medium">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

interface RatingDisplayProps {
  value: number | null;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingDisplay({ value, count, size = 'sm' }: RatingDisplayProps) {
  if (value === null) {
    return (
      <span className="text-sm text-gray-400 italic">No ratings yet</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Rating value={value} readonly size={size} />
      <span className="text-sm text-gray-600">
        {value.toFixed(1)}
        {count !== undefined && (
          <span className="text-gray-400 ml-1">({count})</span>
        )}
      </span>
    </div>
  );
}
