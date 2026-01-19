import { PunishmentSeverity, type Punishment } from '@lanpapp/shared';

interface PunishmentBadgeProps {
  severity: PunishmentSeverity;
  size?: 'sm' | 'md' | 'lg';
}

const severityConfig: Record<PunishmentSeverity, { label: string; color: string; bgColor: string; icon: string }> = {
  [PunishmentSeverity.WARNING]: {
    label: 'Warning',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: '⚠️',
  },
  [PunishmentSeverity.PENALTY]: {
    label: 'Penalty',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: '🚫',
  },
  [PunishmentSeverity.SUSPENSION]: {
    label: 'Suspension',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: '🔴',
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function PunishmentBadge({ severity, size = 'md' }: PunishmentBadgeProps) {
  const config = severityConfig[severity];

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.bgColor} ${config.color} ${sizeClasses[size]}
      `}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

interface PunishmentCardProps {
  punishment: Punishment;
  onClick?: () => void;
  selected?: boolean;
}

export function PunishmentCard({ punishment, onClick, selected }: PunishmentCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg border p-4
        ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm' : ''}
        ${selected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200'}
        transition-all duration-200
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{punishment.name}</h4>
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
            {punishment.description}
          </p>
        </div>
        <PunishmentBadge severity={punishment.severity} size="sm" />
      </div>

      {punishment.point_impact > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center text-sm">
          <span className="text-gray-500">Point impact:</span>
          <span className="ml-2 font-medium text-red-600">
            -{punishment.point_impact}
          </span>
        </div>
      )}
    </div>
  );
}
