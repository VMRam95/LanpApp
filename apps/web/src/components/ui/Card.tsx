import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  padding = 'md',
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden
        ${paddingStyles[padding]}
        ${hoverable ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div
      className={`mt-4 pt-4 border-t border-gray-200 flex items-center justify-end gap-3 ${className}`}
    >
      {children}
    </div>
  );
}

// Stat Card variant
interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  change?: {
    value: number;
    positive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  change,
  className = '',
}: StatCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p
              className={`text-sm mt-1 ${change.positive ? 'text-green-600' : 'text-red-600'}`}
            >
              {change.positive ? '+' : ''}
              {change.value}%
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-primary-50 rounded-xl text-primary-600">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
