interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  className?: string;
}

const sizes = {
  sm: 'h-6 w-6',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

export function LoadingSpinner({ size = 'md', fullPage = false, className }: LoadingSpinnerProps) {
  const spinner = (
    <div className={`animate-spin rounded-full border-b-2 border-primary-600 ${sizes[size]} ${className || ''}`} />
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center py-12">
        {spinner}
      </div>
    );
  }

  return spinner;
}
