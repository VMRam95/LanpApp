import {
  LanpaStatus,
  MemberStatus,
  RatingType,
  PunishmentSeverity,
  NominationStatus,
  NotificationType,
} from './enums.js';

// Base entity with common fields
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// User entity (extends Supabase auth.users)
export interface User extends BaseEntity {
  username: string;
  display_name: string;
  avatar_url: string | null;
  locale: string;
  notification_preferences: NotificationPreferences;
}

export interface NotificationPreferences {
  in_app: boolean;
  push: boolean;
  email: boolean;
  lanpa_created: boolean;
  lanpa_updated: boolean;
  lanpa_invitation: boolean;
  game_voting: boolean;
  punishment_nomination: boolean;
  lanpa_reminder: boolean;
}

// Lanpa (Lan Party) entity
export interface Lanpa extends BaseEntity {
  name: string;
  description: string | null;
  admin_id: string;
  status: LanpaStatus;
  scheduled_date: string | null;
  actual_date: string | null;
  is_historical: boolean;
  selected_game_id: string | null;
}

// Lanpa with relations
export interface LanpaWithRelations extends Lanpa {
  admin?: User;
  members?: LanpaMember[];
  selected_game?: Game;
  game_suggestions?: GameSuggestion[];
  game_votes?: GameVote[];
}

// Lanpa Member entity
export interface LanpaMember {
  id: string;
  lanpa_id: string;
  user_id: string;
  status: MemberStatus;
  joined_at: string;
  user?: User;
}

// Lanpa Invitation entity
export interface LanpaInvitation {
  id: string;
  lanpa_id: string;
  token: string;
  expires_at: string;
  max_uses: number | null;
  uses: number;
}

// Game entity
export interface Game extends BaseEntity {
  name: string;
  description: string | null;
  cover_url: string | null;
  genre: string | null;
  min_players: number | null;
  max_players: number | null;
  created_by: string;
}

// Game with stats
export interface GameWithStats extends Game {
  times_played: number;
  average_rating: number | null;
}

// Game Suggestion entity
export interface GameSuggestion {
  id: string;
  lanpa_id: string;
  game_id: string;
  suggested_by: string;
  created_at: string;
  game?: Game;
  suggested_by_user?: User;
}

// Game Vote entity
export interface GameVote {
  id: string;
  lanpa_id: string;
  game_id: string;
  user_id: string;
  created_at: string;
}

// Rating entity
export interface Rating {
  id: string;
  lanpa_id: string;
  from_user_id: string;
  to_user_id: string;
  rating_type: RatingType;
  score: number;
  comment: string | null;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

// Lanpa Rating entity
export interface LanpaRating {
  id: string;
  lanpa_id: string;
  user_id: string;
  score: number;
  comment: string | null;
  created_at: string;
  user?: User;
}

// Punishment entity
export interface Punishment extends BaseEntity {
  name: string;
  description: string;
  severity: PunishmentSeverity;
  point_impact: number;
  created_by: string;
}

// Punishment Nomination entity
export interface PunishmentNomination {
  id: string;
  lanpa_id: string;
  punishment_id: string;
  nominated_user_id: string;
  nominated_by: string;
  reason: string;
  status: NominationStatus;
  voting_ends_at: string;
  created_at: string;
  punishment?: Punishment;
  nominated_user?: User;
  nominated_by_user?: User;
  votes?: PunishmentVote[];
}

// Punishment Vote entity
export interface PunishmentVote {
  id: string;
  nomination_id: string;
  user_id: string;
  vote: boolean;
  created_at: string;
  user?: User;
}

// User Punishment entity
export interface UserPunishment {
  id: string;
  user_id: string;
  punishment_id: string;
  lanpa_id: string | null;
  nomination_id: string | null;
  applied_at: string;
  notes: string | null;
  punishment?: Punishment;
  lanpa?: Lanpa;
}

// Notification entity
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// Push Subscription entity
export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  created_at: string;
}
