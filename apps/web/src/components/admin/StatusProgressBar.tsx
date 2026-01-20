import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@heroicons/react/24/solid';
import { LanpaStatus } from '@lanpapp/shared';

interface StatusProgressBarProps {
  currentStatus: LanpaStatus;
}

const STATUSES: LanpaStatus[] = [
  LanpaStatus.DRAFT,
  LanpaStatus.VOTING_GAMES,
  LanpaStatus.VOTING_ACTIVE,
  LanpaStatus.IN_PROGRESS,
  LanpaStatus.COMPLETED,
];

export function StatusProgressBar({ currentStatus }: StatusProgressBarProps) {
  const { t } = useTranslation();

  const currentIndex = STATUSES.indexOf(currentStatus);

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary-500 transition-all duration-300"
          style={{ width: `${(currentIndex / (STATUSES.length - 1)) * 100}%` }}
        />

        {/* Status circles */}
        {STATUSES.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={status} className="relative flex flex-col items-center z-10">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  transition-all duration-300 border-2
                  ${
                    isCompleted
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : isCurrent
                        ? 'bg-white border-primary-500 text-primary-500'
                        : 'bg-white border-gray-300 text-gray-400'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckIcon className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </div>
              <span
                className={`
                  mt-2 text-xs font-medium whitespace-nowrap
                  ${isCurrent ? 'text-primary-600' : isCompleted ? 'text-gray-600' : 'text-gray-400'}
                `}
              >
                {t(`lanpas.statusProgress.${status}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
