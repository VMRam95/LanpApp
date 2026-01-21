// Lanpa status colors
export const lanpaStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  voting_games: 'bg-yellow-100 text-yellow-700',
  voting_active: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
};

// Member status colors
export const memberStatusColors: Record<string, string> = {
  invited: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  attended: 'bg-blue-100 text-blue-700',
  declined: 'bg-red-100 text-red-700',
};

// Punishment severity colors
export const severityColors: Record<string, string> = {
  warning: 'bg-yellow-100 text-yellow-700',
  penalty: 'bg-orange-100 text-orange-700',
  suspension: 'bg-red-100 text-red-700',
};

export const getLanpaStatusColor = (status: string): string =>
  lanpaStatusColors[status] || 'bg-gray-100 text-gray-700';

export const getMemberStatusColor = (status: string): string =>
  memberStatusColors[status] || 'bg-gray-100 text-gray-700';

export const getSeverityColor = (severity: string): string =>
  severityColors[severity] || 'bg-gray-100 text-gray-700';
