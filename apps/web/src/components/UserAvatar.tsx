import type { User } from '@lanpapp/shared';

interface UserAvatarProps {
  user: Pick<User, 'avatar_url' | 'display_name' | 'username'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  namePosition?: 'right' | 'bottom';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export function UserAvatar({
  user,
  size = 'md',
  showName = false,
  namePosition = 'right',
}: UserAvatarProps) {
  const avatar = user.avatar_url ? (
    <img
      src={user.avatar_url}
      alt={user.display_name}
      className={`${sizeClasses[size]} rounded-full object-cover`}
    />
  ) : (
    <div
      className={`
        ${sizeClasses[size]} rounded-full
        bg-gradient-to-br from-indigo-400 to-purple-500
        flex items-center justify-center text-white font-medium
      `}
    >
      {getInitials(user.display_name)}
    </div>
  );

  if (!showName) {
    return avatar;
  }

  if (namePosition === 'bottom') {
    return (
      <div className="flex flex-col items-center gap-1">
        {avatar}
        <span className="text-sm text-gray-700 font-medium truncate max-w-[100px]">
          {user.display_name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {avatar}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {user.display_name}
        </p>
        <p className="text-xs text-gray-500 truncate">@{user.username}</p>
      </div>
    </div>
  );
}

interface UserAvatarGroupProps {
  users: Pick<User, 'id' | 'avatar_url' | 'display_name' | 'username'>[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function UserAvatarGroup({ users, max = 5, size = 'sm' }: UserAvatarGroupProps) {
  const displayUsers = users.slice(0, max);
  const remaining = users.length - max;

  const overlapClass = {
    xs: '-ml-2',
    sm: '-ml-2.5',
    md: '-ml-3',
  };

  return (
    <div className="flex items-center">
      {displayUsers.map((user, index) => (
        <div
          key={user.id}
          className={`
            relative ring-2 ring-white rounded-full
            ${index > 0 ? overlapClass[size] : ''}
          `}
          style={{ zIndex: displayUsers.length - index }}
          title={user.display_name}
        >
          <UserAvatar user={user} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`
            ${sizeClasses[size]} ${overlapClass[size]}
            rounded-full bg-gray-200 flex items-center justify-center
            text-gray-600 font-medium ring-2 ring-white
          `}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
